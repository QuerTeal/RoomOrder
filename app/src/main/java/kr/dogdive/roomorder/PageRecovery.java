package kr.dogdive.roomorder;

/** Paces GET reloads of a page stuck after a failed request. The first try keeps the visitor's page;
    later tries reopen the room QR. Unlimited but slow, since the cause may be a store-wide outage. */
final class PageRecovery {
    static final int NONE = 0, RELOAD = 1, REOPEN = 2;
    private long stuckSince = -1, readySince = -1, nextAllowed;
    private int attempts;
    int update(boolean stuck, boolean ready, long now) {
        if (ready) {
            if (readySince < 0) readySince = now;
            if (now - readySince >= 10_000) { attempts = 0; nextAllowed = 0; }
        } else readySince = -1;
        if (!stuck) { stuckSince = -1; return NONE; }
        if (stuckSince < 0) stuckSince = now;
        if (now - stuckSince < 4_000 || now < nextAllowed) return NONE;
        attempts++; nextAllowed = now + delay(attempts); stuckSince = -1;
        return attempts == 1 ? RELOAD : REOPEN;
    }
    /** Retry now, e.g. when Android reports the network is back; the pacing still applies afterwards. */
    boolean retryNow(long now) {
        if (attempts == 0 || now - (nextAllowed - delay(attempts)) < 4_000) return false;
        attempts++; nextAllowed = now + delay(attempts); stuckSince = -1;
        return true;
    }
    static long delay(int attempts) { return attempts <= 1 ? 30_000 : attempts == 2 ? 120_000 : 300_000; }
    void pause() { stuckSince = -1; readySince = -1; }
    int attempts() { return attempts; }
}
