package kr.dogdive.roomorder;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/** Accessed only by the default process. Room processes receive immutable intent snapshots. */
final class SettingsStore {
    static final String ROOM = "room", WIDE = "wide", ZOOM = "zoom", RELOAD = "reload", INITIAL = "initial";
    static final String LOCK = "kiosk_lock", AWAKE = "keep_awake";
    static final String DARK = "dark_mode";
    static final String IDLE_REFRESH = "idle_refresh_seconds";
    static final String ANIM_NUMBER = "anim_number", ANIM_COMPLETE = "anim_complete", ANIM_BOUNCE = "anim_bounce_px";
    private static final String LEGACY_IDLE_MINUTES = "idle_refresh_minutes";
    private final SharedPreferences prefs;
    SettingsStore(Context context) { prefs = context.getSharedPreferences("admin", Context.MODE_PRIVATE); }
    String credential() { return prefs.getString("credential", null); }
    boolean hasPin() { return credential() != null; }
    boolean savePin(String credential) { return prefs.edit().putString("credential", credential).remove("failures").remove("lockedUntil").commit(); }
    long lockedSeconds() { return Math.max(0, (prefs.getLong("lockedUntil", 0) - System.currentTimeMillis() + 999) / 1000); }
    boolean failedAttempt() {
        int count = prefs.getInt("failures", 0) + 1; SharedPreferences.Editor edit = prefs.edit();
        if (count >= 5) edit.putInt("failures", 0).putLong("lockedUntil", System.currentTimeMillis() + 30_000);
        else edit.putInt("failures", count);
        return edit.commit();
    }
    boolean clearAttempts() { return prefs.edit().remove("failures").remove("lockedUntil").commit(); }
    int room() { return prefs.getInt(ROOM, 0); }
    boolean locked() { return prefs.getBoolean(LOCK, false); }
    boolean awake() { return prefs.getBoolean(AWAKE, true); }
    boolean autoStart() { return prefs.getBoolean("auto_start", true); }
    boolean saveAutoStart(boolean enabled) {
        if (!hasPin() || !Rooms.valid(room())) return false;
        return prefs.edit().putBoolean("auto_start", enabled).commit();
    }
    boolean saveKiosk(boolean locked, boolean awake) {
        if (!hasPin() || !Rooms.valid(room())) return false;
        return prefs.edit().putBoolean(LOCK, locked).putBoolean(AWAKE, awake).commit();
    }
    boolean wide() { return prefs.getBoolean(WIDE, true); }
    boolean dark() { return prefs.getBoolean(DARK, false); }
    int idleRefreshSeconds() {
        if (prefs.contains(IDLE_REFRESH)) return IdleRefresh.clamp(prefs.getInt(IDLE_REFRESH, IdleRefresh.DEFAULT_SECONDS));
        // Preserve disabled mode; old 60 means minutes, never 60 seconds.
        return prefs.getInt(LEGACY_IDLE_MINUTES, 30) == 0 ? 0 : IdleRefresh.DEFAULT_SECONDS;
    }
    int zoom() { return clampZoom(prefs.getInt(ZOOM, 120)); }
    static int clampZoom(int value) { return value == 100 || value == 140 ? value : 120; }
    boolean animNumber() { return prefs.getBoolean(ANIM_NUMBER, true); }
    boolean animComplete() { return prefs.getBoolean(ANIM_COMPLETE, true); }
    int animBounce() { return Motion.clampBounce(prefs.getInt(ANIM_BOUNCE, Motion.DEFAULT_BOUNCE)); }
    boolean save(int room, boolean wide, int zoom, boolean dark) {
        return save(room, wide, zoom, dark, idleRefreshSeconds());
    }
    boolean save(int room, boolean wide, int zoom, boolean dark, int idleSeconds) {
        return save(room, wide, zoom, dark, idleSeconds, animNumber(), animComplete(), animBounce());
    }
    boolean save(int room, boolean wide, int zoom, boolean dark, int idleSeconds, boolean animNumber, boolean animComplete, int animBounce) {
        if (!hasPin() || !Rooms.valid(room)) return false;
        return prefs.edit().putInt(ROOM, room).putBoolean(WIDE, wide).putInt(ZOOM, clampZoom(zoom)).putBoolean(DARK, dark)
            .putInt(IDLE_REFRESH, IdleRefresh.clamp(idleSeconds)).remove(LEGACY_IDLE_MINUTES)
            .putBoolean(ANIM_NUMBER, animNumber).putBoolean(ANIM_COMPLETE, animComplete).putInt(ANIM_BOUNCE, Motion.clampBounce(animBounce)).commit();
    }
    Intent snapshot() {
        return new Intent().putExtra(ROOM, room()).putExtra(WIDE, wide()).putExtra(ZOOM, zoom()).putExtra(DARK, dark()).putExtra(IDLE_REFRESH, idleRefreshSeconds())
            .putExtra(ANIM_NUMBER, animNumber()).putExtra(ANIM_COMPLETE, animComplete()).putExtra(ANIM_BOUNCE, animBounce());
    }
}
