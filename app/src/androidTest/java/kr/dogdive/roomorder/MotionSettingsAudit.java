package kr.dogdive.roomorder;

import android.app.Instrumentation;
import android.content.Intent;
import android.widget.CheckBox;
import android.widget.Spinner;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/** Test APK only. Stub authentication without reading or modifying any PIN. */
final class MotionSettingsAudit {
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    static String run(Instrumentation test, SettingsStore settings) throws Exception {
        int room = settings.room(), zoom = settings.zoom(), idle = settings.idleRefreshSeconds();
        boolean wide = settings.wide(), dark = settings.dark();
        boolean number = settings.animNumber(), complete = settings.animComplete(); int bounce = settings.animBounce();
        var prefs = test.getTargetContext().getSharedPreferences("admin", android.content.Context.MODE_PRIVATE);
        try {
            check(prefs.edit().remove(SettingsStore.ANIM_NUMBER).remove(SettingsStore.ANIM_COMPLETE).remove(SettingsStore.ANIM_BOUNCE).commit(), "Default fixture failed");
            check(settings.animNumber() && settings.animComplete() && settings.animBounce() == 20, "Defaults must keep the original animations");
            check(prefs.edit().putInt(SettingsStore.ANIM_BOUNCE, 7).commit() && settings.animBounce() == 20, "Invalid travel must fall back to the original");
            String[] labels = test.getTargetContext().getResources().getStringArray(R.array.motion_bounce_options);
            check(labels.length == Motion.BOUNCE.length, "Bounce labels do not match the choices");
            for (Object[] choice : new Object[][]{{false, false, 0}, {true, false, 5}, {false, true, 10}, {true, true, 20}}) {
                boolean nextNumber = (boolean)choice[0], nextComplete = (boolean)choice[1]; int nextBounce = (int)choice[2];
                boolean beforeNumber = settings.animNumber(), beforeComplete = settings.animComplete(); int beforeBounce = settings.animBounce();
                AdminActivity admin = (AdminActivity)test.startActivitySync(new Intent(test.getTargetContext(), AdminActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                test.runOnMainSync(() -> {
                    check(admin.findViewById(R.id.motion_number) == null, "Animation settings escaped PIN gate");
                    try {
                        Field auth = AdminActivity.class.getDeclaredField("authenticated"); auth.setAccessible(true); auth.setBoolean(admin, true);
                        Method show = AdminActivity.class.getDeclaredMethod("showSettings"); show.setAccessible(true); show.invoke(admin);
                    } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
                    CheckBox numberBox = admin.findViewById(R.id.motion_number), completeBox = admin.findViewById(R.id.motion_complete);
                    Spinner travel = admin.findViewById(R.id.motion_bounce);
                    check(numberBox.isChecked() == beforeNumber && completeBox.isChecked() == beforeComplete, "Initial toggles mismatch");
                    check(Motion.BOUNCE[travel.getSelectedItemPosition()] == beforeBounce, "Initial travel mismatch");
                    numberBox.setChecked(nextNumber); completeBox.setChecked(nextComplete);
                    for (int n = 0; n < Motion.BOUNCE.length; n++) if (Motion.BOUNCE[n] == nextBounce) travel.setSelection(n);
                    check(travel.getSelectedItem().equals(labels[travel.getSelectedItemPosition()]), "Incorrect travel label");
                    check(settings.animNumber() == beforeNumber && settings.animBounce() == beforeBounce, "Selection saved before Save");
                    admin.findViewById(R.id.save_settings).performClick();
                });
                test.waitForIdleSync();
                check(settings.animNumber() == nextNumber && settings.animComplete() == nextComplete && settings.animBounce() == nextBounce, "Selection did not persist");
                Intent snapshot = settings.snapshot();
                check(snapshot.getBooleanExtra(SettingsStore.ANIM_NUMBER, !nextNumber) == nextNumber && snapshot.getBooleanExtra(SettingsStore.ANIM_COMPLETE, !nextComplete) == nextComplete
                    && snapshot.getIntExtra(SettingsStore.ANIM_BOUNCE, -1) == nextBounce, "Intent setting mismatch");
                var runtime = KioskController.runtime(test.getTargetContext());
                check(runtime.getBoolean(SettingsStore.ANIM_NUMBER, !nextNumber) == nextNumber && runtime.getBoolean(SettingsStore.ANIM_COMPLETE, !nextComplete) == nextComplete
                    && runtime.getInt(SettingsStore.ANIM_BOUNCE, -1) == nextBounce, "IPC setting mismatch");
                check(settings.room() == room && settings.zoom() == zoom && settings.wide() == wide && settings.dark() == dark && settings.idleRefreshSeconds() == idle, "Unrelated settings changed");
            }
        } finally { check(settings.save(room, wide, zoom, dark, idle, number, complete, bounce), "Could not restore animation settings"); }
        return "PASS: original defaults and invalid travel; PIN gate, number/completion toggles, off/5/10/20 px labels, Save, persistence, intent and private IPC; unrelated settings preserved";
    }
}
