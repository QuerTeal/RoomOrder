package kr.dogdive.roomorder;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.widget.CheckBox;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/** Installed only as a separate test APK. Never reads/changes PIN material or ships in release. */
public final class DarkModeCheck extends Instrumentation {
    private Bundle arguments;
    @Override public void onCreate(Bundle args) { arguments = args; start(); }
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    /** Screenshot of the unlocked settings scrolled to the animation section, saved in the app's external files. */
    private String previewMotion() throws Exception {
        AdminActivity admin = (AdminActivity)startActivitySync(new Intent(getTargetContext(), AdminActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
            runOnMainSync(() -> {
                try {
                    Field auth = AdminActivity.class.getDeclaredField("authenticated"); auth.setAccessible(true); auth.setBoolean(admin, true);
                    Method show = AdminActivity.class.getDeclaredMethod("showSettings"); show.setAccessible(true); show.invoke(admin);
                } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
                admin.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
            });
            waitForIdleSync(); Thread.sleep(300);
            runOnMainSync(() -> { android.view.View title = admin.findViewById(R.id.motion_number);
                android.graphics.Rect r = new android.graphics.Rect(); title.getDrawingRect(r); title.requestRectangleOnScreen(r, true); });
            waitForIdleSync(); Thread.sleep(500);
            java.io.File file = new java.io.File(getTargetContext().getExternalFilesDir(null), "admin-motion.png");
            try (var out = new java.io.FileOutputStream(file)) { getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out); }
            return "SAVED: " + file;
        } finally { runOnMainSync(admin::finish); waitForIdleSync(); }
    }
    /** Screenshot of one unlocked settings screen, saved in the app's external files. */
    private String previewScreen(String method, String name) throws Exception {
        AdminActivity admin = (AdminActivity)startActivitySync(new Intent(getTargetContext(), AdminActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
            runOnMainSync(() -> {
                try {
                    Field auth = AdminActivity.class.getDeclaredField("authenticated"); auth.setAccessible(true); auth.setBoolean(admin, true);
                    Method show = AdminActivity.class.getDeclaredMethod(method); show.setAccessible(true); show.invoke(admin);
                } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
                admin.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
            });
            waitForIdleSync(); Thread.sleep(500);
            java.io.File file = new java.io.File(getTargetContext().getExternalFilesDir(null), name);
            try (var out = new java.io.FileOutputStream(file)) { getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out); }
            return "SAVED: " + file;
        } finally { runOnMainSync(admin::finish); waitForIdleSync(); }
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        SettingsStore settings = new SettingsStore(getTargetContext());
        boolean original = settings.dark();
        int room = settings.room(), zoom = settings.zoom(); boolean wide = settings.wide();
        try {
            check(Rooms.valid(room) && settings.hasPin(), "Use an already configured debug installation");
            if ("audit".equals(arguments.getString("action"))) {
                result.putString("stream", NativeUiAudit.run(this, settings) + "\n"); finish(Activity.RESULT_OK, result); return;
            } else if ("idleSettings".equals(arguments.getString("action"))) {
                result.putString("stream", IdleSettingsAudit.run(this, settings) + "\n"); finish(Activity.RESULT_OK, result); return;
            } else if ("motionSettings".equals(arguments.getString("action"))) {
                result.putString("stream", MotionSettingsAudit.run(this, settings) + "\n"); finish(Activity.RESULT_OK, result); return;
            } else if ("previewMotion".equals(arguments.getString("action"))) {
                result.putString("stream", previewMotion() + "\n"); finish(Activity.RESULT_OK, result); return;
            } else if ("updateAudit".equals(arguments.getString("action"))) {
                result.putString("stream", UpdateAudit.run(this, Integer.parseInt(arguments.getString("code"))) + "\n"); finish(Activity.RESULT_OK, result); return;
            } else if ("updateCleanup".equals(arguments.getString("action"))) {
                result.putString("stream", UpdateAudit.cleanup(this) + "\n"); finish(Activity.RESULT_OK, result); return;
            } else if ("previewUpdate".equals(arguments.getString("action"))) {
                result.putString("stream", previewScreen("showUpdateSettings", "admin-update.png") + "\n"); finish(Activity.RESULT_OK, result); return;
            } else if ("set".equals(arguments.getString("action"))) {
                boolean dark = Boolean.parseBoolean(arguments.getString("dark"));
                int nextZoom = Integer.parseInt(arguments.getString("zoom", Integer.toString(zoom)));
                int idleSeconds = Integer.parseInt(arguments.getString("idleSeconds", Integer.toString(settings.idleRefreshSeconds())));
                boolean animNumber = Boolean.parseBoolean(arguments.getString("animNumber", Boolean.toString(settings.animNumber())));
                boolean animComplete = Boolean.parseBoolean(arguments.getString("animComplete", Boolean.toString(settings.animComplete())));
                int animBounce = Integer.parseInt(arguments.getString("animBounce", Integer.toString(settings.animBounce())));
                int nextRoom = Integer.parseInt(arguments.getString("room", Integer.toString(room)));
                check(settings.save(nextRoom, wide, nextZoom, dark, idleSeconds, animNumber, animComplete, animBounce), "Save failed");
                check(KioskController.runtime(getTargetContext()).getBoolean(SettingsStore.DARK) == dark, "IPC mismatch");
            } else {
                for (boolean dark : new boolean[]{true, false}) {
                    check(settings.save(room, wide, zoom, dark), "Initial save failed");
                    AdminActivity admin = (AdminActivity)startActivitySync(new Intent(getTargetContext(), AdminActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    runOnMainSync(() -> {
                        Ui ui = new Ui(admin);
                        check(ui.dark == dark, "Admin theme mismatch");
                        check(((ColorDrawable)admin.getWindow().getDecorView().getBackground()).getColor() == ui.bg, "Window background mismatch");
                        check(admin.findViewById(R.id.dark_mode_toggle) == null, "Setting escaped PIN gate");
                        // Stub successful authentication only inside the instrumented test process.
                        // No credentials are read and no test entry point is present in production.
                        try {
                            Field authenticated = AdminActivity.class.getDeclaredField("authenticated"); authenticated.setAccessible(true); authenticated.setBoolean(admin, true);
                            Method show = AdminActivity.class.getDeclaredMethod("showSettings"); show.setAccessible(true); show.invoke(admin);
                        } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
                        CheckBox toggle = admin.findViewById(R.id.dark_mode_toggle);
                        check(toggle != null && toggle.isChecked() == dark, "Toggle state mismatch");
                        toggle.performClick();
                        check(settings.dark() == dark, "Setting changed before Save");
                        admin.findViewById(R.id.save_settings).performClick();
                    });
                    waitForIdleSync();
                    check(new SettingsStore(getTargetContext()).dark() == !dark, "Admin save did not persist");
                    check(settings.snapshot().getBooleanExtra(SettingsStore.DARK, dark) == !dark, "Room snapshot mismatch");
                    check(KioskController.runtime(getTargetContext()).getBoolean(SettingsStore.DARK) == !dark, "Runtime IPC mismatch");
                    check(settings.room() == room && settings.zoom() == zoom && settings.wide() == wide, "Unrelated settings changed");
                }
                check(settings.save(room, wide, zoom, original), "Restore failed");
            }
            result.putString("stream", "PASS: dark setting, PIN gate, native palette, admin toggle/Save, persistence and private IPC\n");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            settings.save(room, wide, zoom, original);
            result.putString("stream", "FAIL: " + error + "\n"); finish(Activity.RESULT_CANCELED, result);
        }
    }
}
