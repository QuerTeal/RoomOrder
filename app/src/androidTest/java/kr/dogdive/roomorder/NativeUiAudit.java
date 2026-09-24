package kr.dogdive.roomorder;

import android.app.AlertDialog;
import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Rect;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ScrollView;
import android.widget.TextView;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/** Geometry checks inside the test APK; no PIN input or production test hook. */
final class NativeUiAudit {
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static void show(AdminActivity activity, String screen) {
        try {
            Field authenticated = AdminActivity.class.getDeclaredField("authenticated"); authenticated.setAccessible(true); authenticated.setBoolean(activity, true);
            Method method = AdminActivity.class.getDeclaredMethod(screen); method.setAccessible(true); method.invoke(activity);
        } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
    }
    private static void audit(View view, Ui ui) {
        if (view.getVisibility() != View.VISIBLE || view.getWidth() == 0) return;
        if (view instanceof TextView text && !(view instanceof EditText) && text.getText().length() > 0 && text.getLayout() != null) {
            var layout = text.getLayout();
            for (int line = 0; line < layout.getLineCount(); line++) {
                check(layout.getEllipsisCount(line) == 0, "Ellipsized: " + text.getText());
                // LineWidth includes invisible trailing spaces; audit the visible line extent.
                check(layout.getLineMax(line) <= text.getWidth() - text.getCompoundPaddingLeft() - text.getCompoundPaddingRight() + 2, "Horizontal text clipping: " + text.getText());
            }
            check(layout.getLineBottom(layout.getLineCount() - 1) <= text.getHeight() - text.getCompoundPaddingTop() - text.getCompoundPaddingBottom() + 2, "Vertical text clipping: " + text.getText());
            if (text instanceof Button) check(view.getHeight() >= ui.dp(64), "Short touch target: " + text.getText());
        }
        if (view instanceof ViewGroup group) for (int n = 0; n < group.getChildCount(); n++) audit(group.getChildAt(n), ui);
    }
    private static ScrollView scroll(View view) {
        if (view instanceof ScrollView s) return s;
        if (view instanceof ViewGroup g) for (int n = 0; n < g.getChildCount(); n++) { ScrollView s = scroll(g.getChildAt(n)); if (s != null) return s; }
        return null;
    }
    static String run(Instrumentation test, SettingsStore settings) throws Exception {
        boolean original = settings.dark(); int screens = 0;
        try {
            for (boolean dark : new boolean[]{false, true}) {
                check(settings.save(settings.room(), settings.wide(), settings.zoom(), dark), "Theme save failed");
                AdminActivity admin = (AdminActivity)test.startActivitySync(new Intent(test.getTargetContext(), AdminActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                Ui ui = new Ui(admin);
                try {
                    test.waitForIdleSync(); Thread.sleep(150);
                    test.runOnMainSync(() -> audit(admin.findViewById(android.R.id.content), ui)); screens++;
                    for (String name : new String[]{"showSettings", "showKioskSettings"}) {
                        test.runOnMainSync(() -> show(admin, name)); test.waitForIdleSync(); Thread.sleep(150);
                        test.runOnMainSync(() -> {
                            View content = admin.findViewById(android.R.id.content); audit(content, ui);
                            ScrollView s = scroll(content); check(s != null, "Settings must scroll"); s.fullScroll(View.FOCUS_DOWN);
                        });
                        test.waitForIdleSync(); Thread.sleep(200);
                        if (name.equals("showSettings")) test.runOnMainSync(() -> {
                            View save = admin.findViewById(R.id.save_settings); Rect visible = new Rect();
                            check(save.getGlobalVisibleRect(visible) && visible.height() >= ui.dp(64), "Save cannot be fully reached");
                        });
                        screens++;
                    }
                    final AlertDialog[] dialog = new AlertDialog[1];
                    test.runOnMainSync(() -> dialog[0] = ui.dialog(ui.dialogBuilder(R.string.kiosk_change_home)
                        .setMessage(R.string.kiosk_change_home_help).setNegativeButton(R.string.cancel, null).setPositiveButton(R.string.open, null)));
                    test.waitForIdleSync(); Thread.sleep(200);
                    test.runOnMainSync(() -> {
                        audit(dialog[0].getWindow().getDecorView(), ui);
                        for (int which : new int[]{AlertDialog.BUTTON_POSITIVE, AlertDialog.BUTTON_NEGATIVE}) {
                            Button button = dialog[0].getButton(which); Rect r = new Rect();
                            check(button.getGlobalVisibleRect(r) && r.height() >= ui.dp(64), "Dialog action clipped");
                            check(button.getTextSize() >= 20 * admin.getResources().getDisplayMetrics().scaledDensity - 1, "Small dialog text");
                        }
                        dialog[0].dismiss();
                    }); screens++;
                } finally { test.runOnMainSync(admin::finish); test.waitForIdleSync(); }
            }
        } finally { check(settings.save(settings.room(), settings.wide(), settings.zoom(), original), "Restore failed"); }
        return "PASS: " + screens + " native screens; PIN, display/kiosk settings, scroll-to-Save and large dialog actions; both themes";
    }
}
