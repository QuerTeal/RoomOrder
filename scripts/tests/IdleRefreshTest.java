package kr.dogdive.roomorder;
public final class IdleRefreshTest {
    private static void check(boolean value) { if (!value) throw new AssertionError(); }
    public static void main(String[] args) {
        for (int seconds : new int[]{60, 80, 100}) {
            IdleRefresh idle = new IdleRefresh(seconds, 10_000);
            long deadline = 10_000 + seconds * 1000L;
            check(idle.remainingSeconds(10_000) == seconds);
            check(idle.remainingSeconds(deadline - 60_000) == 60);
            check(idle.remainingSeconds(deadline - 999) == 1);
            check(idle.remainingSeconds(deadline - 1) == 1);
            check(idle.remainingSeconds(deadline) == 0);
            idle.touch(deadline); check(idle.remainingSeconds(deadline) == seconds);
            idle.postponeWarning(4_000_000); check(idle.remainingSeconds(4_000_000) == 60);
            check(idle.remainingSeconds(4_060_000) == 0);
        }
        IdleRefresh idle = new IdleRefresh(100, 0);
        idle.configure(0, 5_000_000); check(!idle.enabled());
        idle.configure(80, 5_000_000); check(idle.remainingSeconds(4_000_000) == 80);
        for (int invalid : new int[]{-1, 5, 10, 15, 30, 1800}) { idle.configure(invalid, 0); check(idle.intervalSeconds() == 100); }
        for (int value : IdleRefresh.SECONDS) check(IdleRefresh.clamp(value) == value);
        IdleRefresh rest = new IdleRefresh(60, 0);
        check(!rest.resting());
        rest.rest(70_000); check(rest.resting());
        rest.postponeWarning(200_000); check(rest.resting());
        rest.touch(300_000); check(!rest.resting()); check(rest.remainingSeconds(300_000) == 60);
        rest.rest(400_000); rest.configure(80, 400_000); check(!rest.resting());
        System.out.println("PASS: 60/80/100-second deadlines, warning, touch cancellation, busy postponement, disabled mode, invalid settings and rest until touch");
    }
}
