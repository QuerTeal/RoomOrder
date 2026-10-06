package kr.dogdive.roomorder;

import java.util.Locale;

/** When and what to install. Installing closes the order screen, so it happens only off-hours on an idle tablet. */
final class UpdatePolicy {
    static final int WINDOW_START_HOUR = 3, WINDOW_END_HOUR = 5;
    static final long CHECK_INTERVAL_MS = 6 * 3_600_000L;
    private UpdatePolicy() { }
    static boolean inWindow(int hourOfDay) { return hourOfDay >= WINDOW_START_HOUR && hourOfDay < WINDOW_END_HOUR; }
    /** A wall clock moved backwards counts as due, so a wrong clock cannot block checks for months. */
    static boolean checkDue(long now, long lastCheck) { return lastCheck <= 0 || now < lastCheck || now - lastCheck >= CHECK_INTERVAL_MS; }
    /** Resting means cleanup verified an empty cart and nobody touched the tablet since. */
    static boolean installNow(boolean resting, int hourOfDay, boolean verified, boolean needsConfirmation) {
        return resting && inWindow(hourOfDay) && verified && !needsConfirmation;
    }
    static String manifestUrl(String repo, boolean debug) {
        if (!validRepo(repo)) return "";
        return "https://github.com/" + repo + "/releases/latest/download/" + (debug ? "update-dev.json" : "update.json");
    }
    static boolean validRepo(String repo) { return repo != null && repo.matches("[A-Za-z0-9-]+/[A-Za-z0-9._-]+") && !repo.contains(".."); }
    /** Only this repository's release assets over HTTPS, a newer version and a well-formed SHA-256. */
    static boolean acceptable(String repo, int available, int installed, String apkUrl, String sha256) {
        return validRepo(repo) && available > installed && apkUrl != null
            && apkUrl.startsWith("https://github.com/" + repo + "/releases/download/") && !apkUrl.contains("..")
            && sha256 != null && sha256.toLowerCase(Locale.ROOT).matches("[0-9a-f]{64}");
    }
}
