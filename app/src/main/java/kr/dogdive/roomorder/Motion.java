package kr.dogdive.roomorder;

/** Original page animations the administrator may turn off; the bottom button bounce travel in CSS px. */
final class Motion {
    static final int[] BOUNCE = {0, 5, 10, 20};
    static final int DEFAULT_BOUNCE = 20;
    private Motion() {}
    static int clampBounce(int value) {
        for (int candidate : BOUNCE) if (candidate == value) return value;
        return DEFAULT_BOUNCE;
    }
}
