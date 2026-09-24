package kr.dogdive.roomorder;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Native task root deliberately never loads WebView; it survives a room's native engine crash. */
public class RoomPickerActivity extends Activity {
    static final int RENDERER_EXIT = RESULT_FIRST_USER + 1;
    static final String RECOVERED = "recovered_room";
    private static final int ROOM_REQUEST = 71, ADMIN_REQUEST = 72;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable launchPending = () -> launchRoom();
    private SettingsStore settings;
    private SharedPreferences recoveryStore;
    private CrashRecovery recovery;
    private Ui ui;
    private TextView message;
    private boolean childActive, resumed, pending, recovered;
    private long retryAt;

    @Override public void onCreate(Bundle state) {
        settings = new SettingsStore(this); Ui.prepare(this, settings.dark());
        super.onCreate(state);
        // A repeated launcher tap must leave the existing room/admin screen intact.
        if (!isTaskRoot()) {
            boolean hasHost = getSystemService(ActivityManager.class).getAppTasks().stream().anyMatch(t ->
                t.getTaskInfo().taskId == getTaskId() && t.getTaskInfo().baseActivity != null &&
                RoomPickerActivity.class.getName().equals(t.getTaskInfo().baseActivity.getClassName()));
            if (!hasHost) startActivity(new Intent(this, RoomPickerActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
            finish(); return;
        }
        ui = new Ui(this);
        recoveryStore = getSharedPreferences("engine_recovery", MODE_PRIVATE);
        recovery = new CrashRecovery(recoveryStore.getLong("window_start", 0), recoveryStore.getInt("count", 0));
        LinearLayout root = ui.column(); root.setGravity(Gravity.CENTER); ui.background(root);
        root.setPadding(ui.dp(48), ui.dp(32), ui.dp(48), ui.dp(32));
        root.addView(ui.title(R.string.app_name));
        message = ui.text(R.string.loading, 24); message.setGravity(Gravity.CENTER);
        message.setPadding(0, ui.dp(20), 0, ui.dp(24)); root.addView(message);
        root.addView(ui.button(R.string.recovery_open, v -> {
            recovery.reset(); persistBudget(); recovered = true; pending = true; retryAt = 0; scheduleLaunch();
        }, true));
        root.addView(ui.button(R.string.admin, v -> {
            pending = false; handler.removeCallbacks(launchPending);
            startActivityForResult(new Intent(this, AdminActivity.class), ADMIN_REQUEST);
        }, false));
        setContentView(root);
        if (state != null) {
            childActive = state.getBoolean("child_active"); pending = state.getBoolean("pending");
            recovered = state.getBoolean("recovered"); retryAt = state.getLong("retry_at");
            message.setText(pending ? R.string.engine_recovering : R.string.engine_recovery_stopped);
        } else { pending = true; }
    }
    private void launchRoom() {
        if (!resumed || !pending || childActive || isFinishing()) return;
        pending = false;
        if (!settings.hasPin() || !Rooms.valid(settings.room())) {
            message.setText(R.string.recovery_setup);
            startActivityForResult(new Intent(this, AdminActivity.class).putExtra(SettingsStore.INITIAL, true), ADMIN_REQUEST);
            return;
        }
        childActive = true;
        // A native-only boundary absorbs Android's forced finish of the crashing room's caller.
        startActivityForResult(new Intent(this, RoomBoundaryActivity.class)
            .putExtra(RECOVERED, recovered), ROOM_REQUEST);
    }
    private void scheduleLaunch() {
        handler.removeCallbacks(launchPending);
        if (resumed && pending && !childActive) handler.postDelayed(launchPending, Math.max(0, retryAt - SystemClock.elapsedRealtime()));
    }
    private void persistBudget() {
        recoveryStore.edit().putLong("window_start", recovery.windowStart()).putInt("count", recovery.count()).apply();
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == ROOM_REQUEST) {
            childActive = false;
            if (result == RESULT_OK) { pending = true; recovered = false; retryAt = 0; }
            else {
                recovered = true;
                long delay = recovery.record(System.currentTimeMillis()); persistBudget();
                pending = delay >= 0; retryAt = SystemClock.elapsedRealtime() + Math.max(0, delay);
                message.setText(pending ? R.string.engine_recovering : R.string.engine_recovery_stopped);
                android.util.Log.w("RoomRecovery", "Room exited; renderer=" + (result == RENDERER_EXIT) + "; attempt=" + recovery.count());
            }
        } else if (request == ADMIN_REQUEST) {
            pending = result == RESULT_OK; retryAt = 0;
        }
        scheduleLaunch();
    }
    @Override protected void onResume() {
        super.onResume(); if (ui == null) return;
        ui.refresh(settings.dark());
        resumed = true;
        try { KioskController.resume(this); }
        catch (IllegalStateException | SecurityException e) { message.setText(R.string.kiosk_apply_failed); }
        scheduleLaunch();
    }
    @Override protected void onPause() { resumed = false; handler.removeCallbacks(launchPending); super.onPause(); }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); super.onDestroy(); }
    @Override protected void onSaveInstanceState(Bundle out) {
        out.putBoolean("child_active", childActive); out.putBoolean("pending", pending);
        out.putBoolean("recovered", recovered); out.putLong("retry_at", retryAt); super.onSaveInstanceState(out);
    }
    @Override public void onBackPressed() { /* Keep the recovery host inside the ordering task. */ }
    @Override public void onWindowFocusChanged(boolean focused) { super.onWindowFocusChanged(focused); if (focused && ui != null) ui.immersive(); }

    /** Used by HOME: bring the whole task forward without discarding its live WebView or PIN gate. */
    static void openSavedRoom(Activity source) {
        for (ActivityManager.AppTask task : source.getSystemService(ActivityManager.class).getAppTasks()) {
            var info = task.getTaskInfo();
            if (info.baseActivity != null && source.getPackageName().equals(info.baseActivity.getPackageName()) &&
                    RoomPickerActivity.class.getName().equals(info.baseActivity.getClassName())) {
                task.moveToFront(); return;
            }
        }
        source.startActivity(new Intent(source, RoomPickerActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
}
