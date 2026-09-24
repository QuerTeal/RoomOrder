package kr.dogdive.roomorder;

/** Monotonic idle deadline. No background catch-up or wall-clock based deletion. */
final class IdleRefresh {
    static final int DEFAULT_SECONDS = 100;
    static final int[] SECONDS = {0, 60, 80, 100};
    private int seconds;
    private long lastActivity;
    private boolean resting;
    IdleRefresh(int seconds, long now) { configure(seconds, now); }
    static int clamp(int value) {
        for (int candidate : SECONDS) if (candidate == value) return value;
        return DEFAULT_SECONDS;
    }
    void configure(int value, long now) { seconds = clamp(value); touch(now); }
    void touch(long now) { lastActivity = now; resting = false; }
    /** A completed cleanup leaves nothing to clear; wait for the next touch instead of repeating unattended reloads. */
    void rest(long now) { lastActivity = now; resting = true; }
    boolean resting() { return resting; }
    void postponeWarning(long now) { lastActivity = Math.max(lastActivity, now - Math.max(0, seconds * 1000L - 60_000)); }
    boolean enabled() { return seconds > 0; }
    int intervalSeconds() { return seconds; }
    long remainingSeconds(long now) {
        long elapsed = Math.max(0, now - lastActivity);
        return enabled() ? Math.max(0, (seconds * 1000L - elapsed + 999) / 1000) : 0;
    }
}
