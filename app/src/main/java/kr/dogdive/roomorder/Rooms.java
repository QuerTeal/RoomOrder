package kr.dogdive.roomorder;

/** One installable app; independent WebView process and disk profile per room. */
public final class Rooms {
    private Rooms() {}
    public static final int[] NUMBERS = {1,2,3,5,6,7,8,9};
    public static String url(android.content.Context context, int room) {
        String[] urls = context.getResources().getStringArray(R.array.room_urls);
        for (int i = 0; i < NUMBERS.length; i++) if (NUMBERS[i] == room) return urls[i];
        throw new IllegalArgumentException("Unknown room: " + room);
    }
    public static Class<? extends MainActivity> activity(int room) {
        return switch(room) {
            case 1 -> Room1.class; case 2 -> Room2.class; case 3 -> Room3.class;
            case 5 -> Room5.class; case 6 -> Room6.class; case 7 -> Room7.class;
            case 8 -> Room8.class; case 9 -> Room9.class;
            default -> throw new IllegalArgumentException("Unknown room: " + room);
        };
    }
    public static boolean valid(int room) { for(int n:NUMBERS) if(n==room) return true; return false; }
    public static class Room1 extends MainActivity { @Override protected int roomNumber() { return 1; } }
    public static class Room2 extends MainActivity { @Override protected int roomNumber() { return 2; } }
    public static class Room3 extends MainActivity { @Override protected int roomNumber() { return 3; } }
    public static class Room5 extends MainActivity { @Override protected int roomNumber() { return 5; } }
    public static class Room6 extends MainActivity { @Override protected int roomNumber() { return 6; } }
    public static class Room7 extends MainActivity { @Override protected int roomNumber() { return 7; } }
    public static class Room8 extends MainActivity { @Override protected int roomNumber() { return 8; } }
    public static class Room9 extends MainActivity { @Override protected int roomNumber() { return 9; } }
}
