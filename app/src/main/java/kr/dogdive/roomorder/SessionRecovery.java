package kr.dogdive.roomorder;

/** Timing policy independent of WebView: a stable end screen, bounded GET retries, stable menu reset. */
final class SessionRecovery {
    static final int NONE = 0, RETURN = 1, EXHAUSTED = 2;
    private long endedSince = -1, readySince = -1;
    private int attempts;
    private long nextAllowed;
    SessionRecovery(int attempts, long nextAllowed) {
        this.attempts = Math.max(0, Math.min(3, attempts)); this.nextAllowed = nextAllowed;
    }
    int update(boolean ended, boolean ready, long now) {
        if (ready) {
            if (readySince < 0) readySince = now;
            if (now - readySince >= 10_000) { attempts = 0; nextAllowed = 0; }
        } else readySince = -1;
        if (!ended) { endedSince = -1; return NONE; }
        if (endedSince < 0) endedSince = now;
        if (now - endedSince < 4_000) return NONE;
        if (attempts >= 3) return EXHAUSTED;
        if (now < nextAllowed) return NONE;
        attempts++; nextAllowed = now + (attempts == 1 ? 30_000 : 120_000);
        endedSince = -1;
        return RETURN;
    }
    void pause() { endedSince = -1; readySince = -1; }
    int attempts() { return attempts; }
    long nextAllowed() { return nextAllowed; }
}
