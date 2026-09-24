package kr.dogdive.roomorder;

/** A five-minute retry budget survives recreation of the native host. */
final class CrashRecovery {
    private static final long WINDOW_MS = 300_000;
    private long windowStart;
    private int count;
    CrashRecovery(long windowStart, int count) { this.windowStart = windowStart; this.count = Math.max(0, count); }
    long record(long now) {
        if (now < windowStart || now - windowStart >= WINDOW_MS) { windowStart = now; count = 0; }
        count++;
        return count > 3 ? -1 : 1_500L * (1L << (count - 1));
    }
    void reset() { windowStart = 0; count = 0; }
    long windowStart() { return windowStart; }
    int count() { return count; }
}
