package kr.dogdive.roomorder;

public final class PageRecoveryTest {
    private static void expect(long actual, long expected) {
        if (actual != expected) throw new AssertionError(actual + " != " + expected);
    }
    public static void main(String[] args) {
        PageRecovery p = new PageRecovery();
        expect(p.update(false, true, 0), PageRecovery.NONE);
        expect(p.update(true, false, 1_000), PageRecovery.NONE);
        expect(p.update(true, false, 4_999), PageRecovery.NONE);
        expect(p.update(false, false, 5_000), PageRecovery.NONE); // A screen that clears by itself is left alone.
        expect(p.update(true, false, 6_000), PageRecovery.NONE);
        p.pause(); // A new document or leaving the app restarts the 4-second check.
        expect(p.update(true, false, 9_000), PageRecovery.NONE);
        expect(p.update(true, false, 13_000), PageRecovery.RELOAD); // First try keeps the visitor's page.
        expect(p.update(true, false, 17_000), PageRecovery.NONE);
        expect(p.update(true, false, 42_999), PageRecovery.NONE);
        expect(p.update(true, false, 43_000), PageRecovery.REOPEN); // 30 s later the room QR is reopened.
        expect(p.update(true, false, 50_000), PageRecovery.NONE); // The reopened page is stuck again.
        expect(p.update(true, false, 162_999), PageRecovery.NONE);
        expect(p.update(true, false, 163_000), PageRecovery.REOPEN); // then 2 minutes
        p.update(true, false, 170_000); expect(p.update(true, false, 463_000), PageRecovery.REOPEN); // then every 5 minutes, without a cap
        p.update(true, false, 470_000); expect(p.update(true, false, 763_000), PageRecovery.REOPEN);
        expect(p.attempts(), 5);
        p.update(false, true, 800_000); p.update(false, false, 805_000); // A brief normal page keeps the backoff.
        expect(p.attempts(), 5);
        p.update(false, true, 810_000); p.update(false, true, 820_000);
        expect(p.attempts(), 0);
        expect(p.update(true, false, 830_000), PageRecovery.NONE);
        expect(p.update(true, false, 834_000), PageRecovery.RELOAD);
        // Network back: retry at once after the first attempt, but never within 4 seconds of the last one.
        PageRecovery n = new PageRecovery();
        expect(n.retryNow(0) ? 1 : 0, 0);
        n.update(true, false, 0); expect(n.update(true, false, 4_000), PageRecovery.RELOAD);
        expect(n.retryNow(6_000) ? 1 : 0, 0);
        expect(n.retryNow(9_000) ? 1 : 0, 1);
        expect(n.attempts(), 2);
        expect(n.update(true, false, 20_000), PageRecovery.NONE);
        expect(n.update(true, false, 128_999), PageRecovery.NONE);
        expect(n.update(true, false, 129_000), PageRecovery.REOPEN);
        System.out.println("PASS: stuck-page 4-second check, reload then QR, 30 s/2 min/5 min unlimited backoff, stable reset and network-back retry");
    }
}
