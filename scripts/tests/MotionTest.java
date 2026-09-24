package kr.dogdive.roomorder;
public final class MotionTest {
    private static void check(boolean value) { if (!value) throw new AssertionError(); }
    public static void main(String[] args) {
        for (int value : Motion.BOUNCE) check(Motion.clampBounce(value) == value);
        for (int invalid : new int[]{-1, 1, 7, 15, 21, 40}) check(Motion.clampBounce(invalid) == Motion.DEFAULT_BOUNCE);
        check(Motion.DEFAULT_BOUNCE == 20 && Motion.BOUNCE[0] == 0);
        System.out.println("PASS: bounce off/5/10/20 px, original default and invalid settings");
    }
}
