package kr.dogdive.roomorder;

import android.app.Activity;
import android.app.role.RoleManager;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.widget.TextView;
import android.widget.LinearLayout;

/** Android launches the selected HOME after boot/unlock; no background-launch workaround is needed. */
public final class KioskHomeActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int homeChecks;
    private final Runnable checkSelectedHome = new Runnable() {
        @Override public void run() {
            if (getSystemService(RoleManager.class).isRoleHeld(RoleManager.ROLE_HOME) || homeChecks++ >= 10) return;
            // Starting an implicit activity is not limited by package-query visibility.
            // Let Android route to its selected home instead of trusting a filtered resolveActivity result.
            startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            if (homeChecks < 10) handler.postDelayed(this, 1000);
        }
    };
    @Override public void onCreate(Bundle state) {
        Ui.prepare(this, new SettingsStore(this).dark());
        super.onCreate(state);
        TextView loading = new Ui(this).text(R.string.loading, 24);
        loading.setGravity(Gravity.CENTER); setContentView(loading);
    }
    @Override protected void onResume() {
        super.onResume();
        Ui.prepare(this, new SettingsStore(this).dark());
        if (new SettingsStore(this).autoStart() && KioskController.isHome(this)) { RoomPickerActivity.openSavedRoom(this); return; }
        // Android can invoke the old HOME before the new role holder has finished restoring at boot.
        // An explicit administrator stop is authoritative even during that brief transition.
        Ui ui = new Ui(this); LinearLayout root = ui.column(); root.setGravity(Gravity.CENTER); ui.background(root);
        root.setPadding(ui.dp(40), ui.dp(24), ui.dp(40), ui.dp(24));
        root.addView(ui.title(R.string.kiosk_home_paused)); root.addView(ui.text(R.string.kiosk_home_paused_help, 20));
        root.addView(ui.button(R.string.kiosk_open_order, v -> RoomPickerActivity.openSavedRoom(this), true));
        root.addView(ui.button(R.string.admin, v -> startActivity(new Intent(this, AdminActivity.class).putExtra(SettingsStore.INITIAL, true)), false));
        setContentView(root);
        if (homeChecks < 10) handler.postDelayed(checkSelectedHome, 1000);
    }
    @Override protected void onPause() { handler.removeCallbacks(checkSelectedHome); super.onPause(); }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); super.onDestroy(); }
    @Override public void onBackPressed() { /* A home activity remains the root of its own task. */ }
}
