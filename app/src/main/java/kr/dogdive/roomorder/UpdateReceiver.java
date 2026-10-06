package kr.dogdive.roomorder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restart after this app replaced itself, on devices that deliver the broadcast. Install results go to
    {@link UpdateResultActivity}, which also covers devices that suppress it. */
public final class UpdateReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent intent) {
        if (!Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) return;
        UpdateManager.refresh(c);
        // Reopen the order screen; a kiosk home app does the same when Android returns home.
        try { c.startActivity(new Intent(c, RoomPickerActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (RuntimeException ignored) { /* Background start refused; the result activity or home screen reopens the room. */ }
    }
}
