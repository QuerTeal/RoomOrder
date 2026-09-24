package kr.dogdive.roomorder;

import android.app.Instrumentation;
import android.content.Intent;
import android.widget.Spinner;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/** Test APK only. Stub authentication without reading or modifying any PIN. */
final class IdleSettingsAudit {
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    static String run(Instrumentation test, SettingsStore settings) throws Exception {
        int original = settings.idleRefreshSeconds(), room = settings.room(), zoom = settings.zoom();
        boolean wide = settings.wide(), dark = settings.dark();
        try {
            var prefs = test.getTargetContext().getSharedPreferences("admin", android.content.Context.MODE_PRIVATE);
            for (int oldMinutes : new int[]{0, 5, 10, 15, 30, 60}) {
                check(prefs.edit().remove(SettingsStore.IDLE_REFRESH).putInt("idle_refresh_minutes", oldMinutes).commit(), "Legacy fixture failed");
                check(settings.idleRefreshSeconds() == (oldMinutes == 0 ? 0 : 100), "Legacy minutes interpreted as seconds");
            }
            check(prefs.edit().remove(SettingsStore.IDLE_REFRESH).remove("idle_refresh_minutes").commit(), "Default fixture failed");
            check(settings.idleRefreshSeconds() == 100, "Default must be 100 seconds");
            for (int seconds : new int[]{60, 80, 100, 0}) {
                int before = settings.idleRefreshSeconds();
                AdminActivity admin = (AdminActivity)test.startActivitySync(new Intent(test.getTargetContext(), AdminActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                test.runOnMainSync(() -> {
                    check(admin.findViewById(R.id.idle_refresh_setting) == null, "Idle setting escaped PIN gate");
                    try {
                        Field auth = AdminActivity.class.getDeclaredField("authenticated"); auth.setAccessible(true); auth.setBoolean(admin, true);
                        Method show = AdminActivity.class.getDeclaredMethod("showSettings"); show.setAccessible(true); show.invoke(admin);
                    } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
                    Spinner spinner = admin.findViewById(R.id.idle_refresh_setting);
                    check(IdleRefresh.SECONDS[spinner.getSelectedItemPosition()] == before, "Initial selection mismatch");
                    for (int n = 0; n < IdleRefresh.SECONDS.length; n++) if (IdleRefresh.SECONDS[n] == seconds) spinner.setSelection(n);
                    check(spinner.getSelectedItem().equals(seconds == 0 ? admin.getString(R.string.idle_refresh_off) : admin.getString(R.string.idle_refresh_seconds, seconds)), "Incorrect seconds label");
                    check(settings.idleRefreshSeconds() == before, "Selection saved before Save");
                    admin.findViewById(R.id.save_settings).performClick();
                });
                test.waitForIdleSync();
                check(settings.idleRefreshSeconds() == seconds, "Selected interval did not persist");
                check(!prefs.contains("idle_refresh_minutes"), "Legacy setting retained after Save");
                check(settings.snapshot().getIntExtra(SettingsStore.IDLE_REFRESH, -1) == seconds, "Intent setting mismatch");
                check(KioskController.runtime(test.getTargetContext()).getInt(SettingsStore.IDLE_REFRESH, -1) == seconds, "IPC setting mismatch");
                check(settings.room() == room && settings.zoom() == zoom && settings.wide() == wide && settings.dark() == dark, "Unrelated settings changed");
            }
        } finally { check(settings.save(room, wide, zoom, dark, original), "Could not restore original interval"); }
        return "PASS: legacy minute migration and disabled mode; PIN gate, 60/80/100 seconds/off labels, Save, persistence, intent and private IPC; unrelated settings preserved";
    }
}
