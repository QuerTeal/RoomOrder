package kr.dogdive.roomorder;

import android.app.Instrumentation;
import android.content.Context;
import android.content.SharedPreferences;
import java.io.File;

/** Test APK only. Uses APKs already copied to files/update/: app-<code>.apk (a newer build of this
    package) and app-wrong.apk (another package or key). Never changes device security settings. */
final class UpdateAudit {
    private UpdateAudit() { }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static String waitStatus(SharedPreferences p, String from) throws InterruptedException {
        // Package verification can take a while on devices without a verifier; the process must stay alive.
        for (int i = 0; i < 480 && from.equals(p.getString("status", "")); i++) Thread.sleep(250);
        return p.getString("status", "");
    }
    /** Abandons this app's install sessions and removes downloaded files and update state. */
    static String cleanup(Instrumentation instrumentation) {
        Context c = instrumentation.getTargetContext();
        android.content.pm.PackageInstaller installer = c.getPackageManager().getPackageInstaller();
        int abandoned = 0;
        for (android.content.pm.PackageInstaller.SessionInfo info : installer.getMySessions()) { installer.abandonSession(info.getSessionId()); abandoned++; }
        File dir = UpdateManager.apkFile(c, 0).getParentFile(); int deleted = 0;
        File[] files = dir.listFiles(); if (files != null) for (File f : files) if (f.delete()) deleted++;
        UpdateManager.prefs(c).edit().clear().commit();
        return "UPDATE CLEANUP: abandoned sessions=" + abandoned + " deleted files=" + deleted + " remaining sessions=" + installer.getMySessions().size();
    }
    static String run(Instrumentation instrumentation, int code) throws Exception {
        Context c = instrumentation.getTargetContext();
        SharedPreferences p = UpdateManager.prefs(c);
        int installed = UpdateManager.installedVersion(c);
        File good = UpdateManager.apkFile(c, code), wrong = new File(good.getParentFile(), "app-wrong.apk");
        check(code > installed && good.isFile() && wrong.isFile(), "Copy app-" + code + ".apk and app-wrong.apk first");
        String sha = UpdateManager.sha256(good);
        StringBuilder out = new StringBuilder();
        // 1. A file whose hash differs from the manifest is refused before any install session.
        p.edit().putInt("verified_code", code).putString("verified_sha", "0".repeat(64)).putBoolean("needs_confirmation", false).putString("status", "ready").commit();
        UpdateManager.install(c, false);
        check("rejected".equals(p.getString("status", "")), "Hash mismatch not rejected: " + p.getString("status", ""));
        out.append("hash mismatch rejected; ");
        // 2. Another package or signing key is refused even with a matching hash.
        File swapped = new File(good.getParentFile(), "app-" + code + ".good");
        check(good.renameTo(swapped) && copy(wrong, good), "Swap failed");
        p.edit().putString("verified_sha", UpdateManager.sha256(good)).putString("status", "ready").commit();
        UpdateManager.install(c, false);
        check("rejected".equals(p.getString("status", "")), "Foreign APK not rejected: " + p.getString("status", ""));
        check(good.delete() && swapped.renameTo(good), "Restore failed");
        out.append("other package/key rejected; ");
        // 3. The genuine newer build: unattended install never leaves Android's prompt on screen.
        p.edit().putString("verified_sha", sha).putString("status", "ready").remove("error").commit();
        check(UpdateManager.readyVersion(c) == code, "Ready version mismatch");
        UpdateManager.install(c, false);
        String status = waitStatus(p, "installing");
        out.append("verified build -> ").append(status).append(" needs_confirmation=").append(p.getBoolean("needs_confirmation", false))
            .append(" installed=").append(UpdateManager.installedVersion(c)).append(" error=").append(p.getString("error", "-"));
        return "UPDATE: " + out;
    }
    private static boolean copy(File from, File to) {
        try (var in = new java.io.FileInputStream(from); var o = new java.io.FileOutputStream(to)) { in.transferTo(o); return true; }
        catch (java.io.IOException e) { return false; }
    }
}
