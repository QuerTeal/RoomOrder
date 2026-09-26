package kr.dogdive.roomorder;

/** Monotonic idle deadline. No background catch-up or wall-clock based deletion. */
final class IdleRefresh {
    static final int DEFAULT_SECONDS = 100;
    static final int[] SECONDS = {0, 60, 80, 100};
    /** Toss ends an unused table session after an undisclosed time; a resting tablet reopens its QR well before that. */
    static final long SESSION_REFRESH_MS = 10 * 60_000L;
    private int seconds;
    private long lastActivity, sessionOpened;
    private boolean resting;
    IdleRefresh(int seconds, long now) { configure(seconds, now); }
    static int clamp(int value) {
        for (int candidate : SECONDS) if (candidate == value) return value;
        return DEFAULT_SECONDS;
    }
    void configure(int value, long now) { seconds = clamp(value); touch(now); }
    void touch(long now) { lastActivity = now; resting = false; }
    /** A completed cleanup leaves nothing to clear; wait for the next touch instead of repeating unattended reloads. */
    void rest(long now) { lastActivity = now; sessionOpened = now; resting = true; }
    boolean resting() { return resting; }
    /** Rest starts right after the room QR opened a verified-empty menu; rest(now) again after each reopen. */
    boolean sessionRefreshDue(long now) { return resting && now - sessionOpened >= SESSION_REFRESH_MS; }
    void postponeWarning(long now) { lastActivity = Math.max(lastActivity, now - Math.max(0, seconds * 1000L - 60_000)); }
    boolean enabled() { return seconds > 0; }
    int intervalSeconds() { return seconds; }
    long remainingSeconds(long now) {
        long elapsed = Math.max(0, now - lastActivity);
        return enabled() ? Math.max(0, (seconds * 1000L - elapsed + 999) / 1000) : 0;
    }
}
