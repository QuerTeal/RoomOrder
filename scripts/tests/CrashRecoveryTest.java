package kr.dogdive.roomorder;

public final class CrashRecoveryTest {
    private static void expect(long actual, long expected) {
        if (actual != expected) throw new AssertionError(actual + " != " + expected);
    }
    public static void main(String[] args) {
        long now = 1_000_000;
        CrashRecovery guard = new CrashRecovery(0, 0);
        expect(guard.record(now), 1500);
        expect(guard.record(now + 10000), 3000);
        guard = new CrashRecovery(guard.windowStart(), guard.count());
        expect(guard.record(now + 20000), 6000);
        expect(guard.record(now + 30000), -1);
        expect(guard.record(now + 299999), -1);
        expect(guard.record(now + 300000), 1500);
        expect(guard.record(now - 1000), 1500); // A corrected clock must not lock out recovery forever.
        guard.reset();
        expect(guard.record(now), 1500);
        System.out.println("PASS: crash backoff, three-retry limit, persisted budget, expiry, clock correction and manual retry");
    }
}
