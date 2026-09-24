package kr.dogdive.roomorder;

public final class SessionRecoveryTest {
    private static void expect(int actual, int expected) {
        if (actual != expected) throw new AssertionError(actual + " != " + expected);
    }
    public static void main(String[] args) {
        SessionRecovery g = new SessionRecovery(0, 0);
        expect(g.update(true, false, 0), SessionRecovery.NONE);
        expect(g.update(true, false, 3999), SessionRecovery.NONE);
        expect(g.update(false, false, 4000), SessionRecovery.NONE);
        expect(g.update(true, false, 5000), SessionRecovery.NONE);
        g.pause(); // Opening administrator settings must cancel a pending return.
        expect(g.update(true, false, 9000), SessionRecovery.NONE);
        expect(g.update(true, false, 13000), SessionRecovery.RETURN);
        expect(g.update(true, false, 17000), SessionRecovery.NONE);
        expect(g.update(true, false, 42999), SessionRecovery.NONE);
        expect(g.update(true, false, 43000), SessionRecovery.RETURN);
        // Process recreation preserves the attempt budget/cooldown.
        g = new SessionRecovery(g.attempts(), g.nextAllowed());
        expect(g.update(true, false, 50000), SessionRecovery.NONE);
        expect(g.update(true, false, 163000), SessionRecovery.RETURN);
        g.update(true, false, 164000);
        expect(g.update(true, false, 168000), SessionRecovery.EXHAUSTED);
        g.update(false, true, 170000);
        g.update(false, false, 175000); // A briefly rendered menu does not reset the budget.
        expect(g.attempts(), 3);
        g.update(false, true, 180000);
        g.update(false, true, 190000);
        expect(g.attempts(), 0);
        g.update(true, false, 200000);
        expect(g.update(true, false, 204000), SessionRecovery.RETURN);
        System.out.println("PASS: stable end detection, interrupted return, cooldown, persistent budget, stable-menu reset");
    }
}
