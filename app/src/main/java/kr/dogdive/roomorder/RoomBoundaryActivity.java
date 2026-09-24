package kr.dogdive.roomorder;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

/** Android may also finish the immediate caller of a crashed activity. Keep the host below it. */
public final class RoomBoundaryActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean returning;
    private int returnCode = RESULT_CANCELED;
    private Ui ui;
    private final Runnable complete = () -> { setResult(returnCode); finish(); };

    @Override public void onCreate(Bundle state) {
        Ui.prepare(this, new SettingsStore(this).dark());
        super.onCreate(state);
        ui = new Ui(this);
        var root = ui.column(); root.setGravity(android.view.Gravity.CENTER);
        ui.background(root); root.addView(ui.text(R.string.engine_recovering, 24));
        setContentView(root); ui.immersive();
        if (state != null) {
            returning = state.getBoolean("returning"); returnCode = state.getInt("result", RESULT_CANCELED);
            if (returning) handler.postDelayed(complete, 1000);
        } else {
            SettingsStore settings = new SettingsStore(this);
            if (!Rooms.valid(settings.room()) || !settings.hasPin()) { complete.run(); return; }
            startActivityForResult(settings.snapshot().setClass(this, Rooms.activity(settings.room()))
                .putExtra(RoomPickerActivity.RECOVERED, getIntent().getBooleanExtra(RoomPickerActivity.RECOVERED, false)), 1);
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != 1) return;
        returning = true; returnCode = result;
        // Let Android finish this boundary first on a native crash; do not expose the host mid-cleanup.
        handler.postDelayed(complete, 1000);
    }
    @Override protected void onSaveInstanceState(Bundle out) {
        out.putBoolean("returning", returning); out.putInt("result", returnCode); super.onSaveInstanceState(out);
    }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); super.onDestroy(); }
    @Override protected void onResume() { super.onResume(); ui.refresh(new SettingsStore(this).dark()); }
    @Override public void onBackPressed() { /* The room or host handles navigation. */ }
}
