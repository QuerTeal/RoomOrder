package kr.dogdive.roomorder;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.content.res.ColorStateList;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.Button;
import android.webkit.WebView;
import android.widget.ProgressBar;
import android.widget.LinearLayout;
import android.widget.TextView;

final class Ui {
    int ink, accent, muted, bg, surface, border, error;
    boolean dark;
    private final Activity activity;
    static void prepare(Activity activity, boolean dark) { activity.setTheme(dark ? R.style.AppThemeDark : R.style.AppTheme); }
    Ui(Activity activity) {
        this.activity = activity;
        TypedValue light = new TypedValue();
        activity.getTheme().resolveAttribute(android.R.attr.isLightTheme, light, true);
        palette(light.data == 0);
    }
    private void palette(boolean dark) {
        this.dark = dark;
        ink = dark ? 0xfff3f6fc : 0xff192438; accent = dark ? 0xff91baff : 0xff205bd3;
        muted = dark ? 0xffb5c1d2 : 0xff4c596b; bg = dark ? 0xff11151c : 0xfff4f6fa;
        surface = dark ? 0xff1b222d : Color.WHITE; border = dark ? 0xff3b485a : 0xffd7dee8;
        error = dark ? 0xffffb4ab : 0xffb42318;
    }
    void refresh(boolean dark) {
        prepare(activity, dark); palette(dark);
        activity.getWindow().setBackgroundDrawable(new ColorDrawable(bg));
        paintTree(activity.findViewById(android.R.id.content));
    }
    private void paintTree(View view) {
        if (view == null) return;
        paint(view);
        if (view instanceof WebView) return;
        if (view instanceof ViewGroup group) for (int i = 0; i < group.getChildCount(); i++) paintTree(group.getChildAt(i));
    }
    private void paint(View view) {
        Object role = view.getTag(R.id.ui_role);
        if ("background".equals(role)) view.setBackgroundColor(bg);
        else if ("surface".equals(role)) view.setBackgroundColor(surface);
        else if ("text".equals(role)) ((TextView)view).setTextColor(ink);
        else if ("muted".equals(role)) ((TextView)view).setTextColor(muted);
        else if ("primary".equals(role) || "secondary".equals(role)) {
            boolean primary = "primary".equals(role);
            ((Button)view).setTextColor(primary ? Color.WHITE : view.isSelected() ? accent : ink);
            GradientDrawable shape = new GradientDrawable(); shape.setColor(primary ? 0xff205bd3 : surface);
            shape.setCornerRadius(dp(14)); shape.setStroke(dp(1), primary ? 0xff205bd3 : border);
            view.setBackground(new RippleDrawable(ColorStateList.valueOf(dark ? 0x447daaff : 0x22667799), shape, null));
        }
        if (view instanceof ProgressBar progress) {
            progress.setIndeterminateTintList(ColorStateList.valueOf(accent));
            progress.setProgressTintList(ColorStateList.valueOf(accent));
            progress.setProgressBackgroundTintList(ColorStateList.valueOf(border));
        }
    }
    void background(View view) { view.setTag(R.id.ui_role, "background"); paint(view); }
    void surface(View view) { view.setTag(R.id.ui_role, "surface"); paint(view); }
    void muted(TextView view) { view.setTag(R.id.ui_role, "muted"); paint(view); }
    int dp(int value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }
    TextView text(int resource, int size) { return text(activity.getString(resource), size); }
    TextView text(String value, int size) {
        TextView t = new TextView(activity); t.setText(value); t.setTextSize(size); t.setTag(R.id.ui_role, "text"); paint(t);
        t.setLineSpacing(dp(3), 1); return t;
    }
    TextView title(int resource) {
        TextView t = text(resource, 28); t.setTypeface(null, Typeface.BOLD); t.setPadding(0, 0, 0, dp(12)); return t;
    }
    LinearLayout column() { LinearLayout box = new LinearLayout(activity); box.setOrientation(LinearLayout.VERTICAL); return box; }
    Button button(int resource, View.OnClickListener action, boolean primary) { return button(activity.getString(resource), action, primary); }
    Button button(String value, View.OnClickListener action, boolean primary) {
        Button b = new Button(activity); b.setText(value); b.setTextSize(20); b.setAllCaps(false);
        b.setGravity(Gravity.CENTER); b.setPadding(dp(12), dp(10), dp(12), dp(10)); b.setMinHeight(dp(64));
        b.setTag(R.id.ui_role, primary ? "primary" : "secondary"); paint(b);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.topMargin = dp(12); b.setLayoutParams(lp);
        b.setOnClickListener(action); return b;
    }
    AlertDialog.Builder dialogBuilder(int resource) { return dialogBuilder(activity.getString(resource)); }
    AlertDialog.Builder dialogBuilder(String value) {
        TextView title = text(value, 24); title.setTypeface(null, Typeface.BOLD); title.setAccessibilityHeading(true);
        title.setPadding(dp(24), dp(24), dp(24), dp(12));
        return new AlertDialog.Builder(activity).setTitle(value).setCustomTitle(title);
    }
    AlertDialog dialog(AlertDialog.Builder builder) {
        AlertDialog dialog = builder.create();
        dialog.setOnShowListener(ignored -> {
            TextView message = dialog.findViewById(android.R.id.message);
            if (message != null) { message.setTextSize(20); message.setTextColor(ink); message.setLineSpacing(dp(4), 1); }
            for (int which : new int[]{AlertDialog.BUTTON_POSITIVE, AlertDialog.BUTTON_NEGATIVE, AlertDialog.BUTTON_NEUTRAL}) {
                Button button = dialog.getButton(which);
                if (button == null) continue;
                button.setTextSize(20); button.setAllCaps(false); button.setMinHeight(dp(64)); button.setMinimumHeight(dp(64));
                button.setMinWidth(dp(112)); button.setTextColor(accent);
                button.setPadding(dp(16), dp(12), dp(16), dp(12));
            }
            var window = dialog.getWindow();
            if (window != null) {
                int width = activity.getResources().getDisplayMetrics().widthPixels;
                window.setLayout(Math.min(dp(720), width - dp(48)), -2);
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) { controller.hide(WindowInsets.Type.systemBars()); controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
            }
        });
        dialog.show(); return dialog;
    }
    void immersive() {
        WindowInsetsController c = activity.getWindow().getInsetsController();
        if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
    }
}
