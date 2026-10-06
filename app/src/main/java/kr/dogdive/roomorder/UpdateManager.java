package kr.dogdive.roomorder;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

/** Default process only. Reads the GitHub release manifest, keeps one verified APK and installs it with
    PackageInstaller. Android itself refuses an APK signed with another key or an older version. */
final class UpdateManager {
    private static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final long MAX_APK = 64L * 1024 * 1024;
    private UpdateManager() { }
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("update", Context.MODE_PRIVATE); }
    static String manifestUrl() { return UpdatePolicy.manifestUrl(BuildConfig.UPDATE_REPO, BuildConfig.DEBUG); }
    static int installedVersion(Context c) {
        try { return (int)c.getPackageManager().getPackageInfo(c.getPackageName(), 0).getLongVersionCode(); }
        catch (PackageManager.NameNotFoundException e) { return 0; }
    }
    /** The resting room reports about once a minute; only the 03:00-05:00 window does any work. */
    static void idle(Context context) {
        Context c = context.getApplicationContext();
        worker.execute(() -> {
            int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
            if (!UpdatePolicy.inWindow(hour) || manifestUrl().isEmpty()) return;
            SharedPreferences p = prefs(c);
            if (UpdatePolicy.checkDue(System.currentTimeMillis(), p.getLong("checked_at", 0))) check(c);
            if (UpdatePolicy.installNow(true, hour, readyVersion(c) > 0, p.getBoolean("needs_confirmation", false))) install(c, false);
        });
    }
    static void checkNow(Context context, Runnable done) { Context c = context.getApplicationContext(); worker.execute(() -> { check(c); done.run(); }); }
    /** Administrator request: Android may show its own confirmation, which the administrator answers. */
    static void installNow(Context context) { Context c = context.getApplicationContext(); worker.execute(() -> install(c, true)); }
    /** Version of a downloaded, verified APK newer than the installed one, or 0. */
    static int readyVersion(Context c) {
        int code = prefs(c).getInt("verified_code", 0);
        return code > installedVersion(c) && apkFile(c, code).isFile() ? code : 0;
    }
    static File apkFile(Context c, int code) { return new File(new File(c.getFilesDir(), "update"), "app-" + code + ".apk"); }
    private static void check(Context c) {
        SharedPreferences.Editor e = prefs(c).edit().putLong("checked_at", System.currentTimeMillis());
        try {
            JSONObject manifest = new JSONObject(new String(read(manifestUrl(), 64 * 1024), StandardCharsets.UTF_8));
            int code = manifest.getInt("versionCode"), installed = installedVersion(c);
            String apk = manifest.getString("apk"), sha = manifest.getString("sha256").toLowerCase(Locale.ROOT);
            e.putInt("available_code", code).putString("available_name", manifest.optString("versionName", ""));
            if (code <= installed) { e.putString("status", "current").remove("error").apply(); return; }
            if (!UpdatePolicy.acceptable(BuildConfig.UPDATE_REPO, code, installed, apk, sha)) { e.putString("status", "rejected").apply(); return; }
            File file = apkFile(c, code);
            if (!file.isFile() || !sha.equals(sha256(file))) download(apk, file);
            if (!sha.equals(sha256(file)) || !matchesInstalled(c, file, code)) { file.delete(); e.putString("status", "rejected").apply(); return; }
            File[] others = file.getParentFile().listFiles();
            if (others != null) for (File old : others) if (!old.equals(file)) old.delete();
            if (prefs(c).getInt("verified_code", 0) != code) e.putBoolean("needs_confirmation", false);
            e.putInt("verified_code", code).putString("verified_sha", sha).putString("status", "ready").remove("error").apply();
        } catch (IOException | JSONException | NoSuchAlgorithmException | RuntimeException error) {
            e.putString("status", "error").putString("error", error.getClass().getSimpleName()).apply();
        }
    }
    /** The state is committed synchronously: installing this package kills the process right after commit. */
    @android.annotation.SuppressLint("ApplySharedPref")
    static void install(Context c, boolean interactive) {
        SharedPreferences p = prefs(c);
        int code = readyVersion(c);
        try {
            File file = apkFile(c, code);
            if (code == 0 || !p.getString("verified_sha", "").equals(sha256(file)) || !matchesInstalled(c, file, code)) {
                p.edit().putString("status", "rejected").apply(); return;
            }
            PackageInstaller installer = c.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(c.getPackageName());
            // A device owner, or this app once it has installed itself, updates without a prompt.
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            int id = installer.createSession(params);
            try (PackageInstaller.Session session = installer.openSession(id)) {
                try (InputStream in = new FileInputStream(file); OutputStream out = session.openWrite("app.apk", 0, file.length())) {
                    in.transferTo(out); session.fsync(out);
                }
                p.edit().putBoolean("interactive", interactive).putString("status", "installing").commit();
                Intent result = new Intent(c, UpdateReceiver.class).setAction(UpdateReceiver.RESULT);
                session.commit(PendingIntent.getBroadcast(c, id, result, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE).getIntentSender());
            }
        } catch (IOException | NoSuchAlgorithmException | RuntimeException error) {
            p.edit().putString("status", "error").putString("error", error.getClass().getSimpleName()).apply();
        }
    }
    private static boolean matchesInstalled(Context c, File file, int code) {
        try {
            PackageManager pm = c.getPackageManager();
            PackageInfo archive = pm.getPackageArchiveInfo(file.getPath(), PackageManager.GET_SIGNING_CERTIFICATES);
            PackageInfo installed = pm.getPackageInfo(c.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (archive == null || archive.signingInfo == null || installed.signingInfo == null) return false;
            Signature[] a = archive.signingInfo.getApkContentsSigners(), b = installed.signingInfo.getApkContentsSigners();
            return c.getPackageName().equals(archive.packageName) && archive.getLongVersionCode() == code && Arrays.equals(a, b);
        } catch (PackageManager.NameNotFoundException e) { return false; }
    }
    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection)new URL(url).openConnection();
        connection.setConnectTimeout(15_000); connection.setReadTimeout(30_000); connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("Accept", "application/octet-stream, application/json");
        int code = connection.getResponseCode();
        // Redirects to GitHub's asset storage stay on HTTPS; anything else is refused.
        if (code != 200 || !"https".equals(connection.getURL().getProtocol())) { connection.disconnect(); throw new IOException("HTTP " + code); }
        return connection;
    }
    private static byte[] read(String url, int limit) throws IOException {
        HttpURLConnection connection = open(url);
        try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int n;
            while ((n = in.read(buffer)) > 0) { out.write(buffer, 0, n); if (out.size() > limit) throw new IOException("Too large"); }
            return out.toByteArray();
        } finally { connection.disconnect(); }
    }
    private static void download(String url, File target) throws IOException {
        File dir = target.getParentFile(), part = new File(dir, target.getName() + ".part");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("No update directory");
        HttpURLConnection connection = open(url);
        try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(part)) {
            byte[] buffer = new byte[65536]; long total = 0; int n;
            while ((n = in.read(buffer)) > 0) { total += n; if (total > MAX_APK) throw new IOException("Too large"); out.write(buffer, 0, n); }
        } finally { connection.disconnect(); }
        if (!part.renameTo(target)) { part.delete(); throw new IOException("Rename failed"); }
    }
    static String sha256(File file) throws IOException, NoSuchAlgorithmException {
        if (!file.isFile()) return "";
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) { byte[] buffer = new byte[65536]; int n; while ((n = in.read(buffer)) > 0) digest.update(buffer, 0, n); }
        StringBuilder hex = new StringBuilder();
        for (byte b : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", b));
        return hex.toString();
    }
}
