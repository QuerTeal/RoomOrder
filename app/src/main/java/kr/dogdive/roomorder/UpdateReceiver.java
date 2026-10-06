package kr.dogdive.roomorder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;

/** Install results and the restart after this app replaced itself. */
public final class UpdateReceiver extends BroadcastReceiver {
    static final String RESULT = "kr.dogdive.roomorder.UPDATE_RESULT";
    @Override public void onReceive(Context c, Intent intent) {
        SharedPreferences p = UpdateManager.prefs(c);
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            p.edit().putString("status", "installed").putBoolean("needs_confirmation", false).apply();
            // Reopen the order screen; a kiosk home app does the same when Android returns home.
            try { c.startActivity(new Intent(c, RoomPickerActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
            catch (RuntimeException ignored) { /* Background start refused; the home screen reopens the room. */ }
            return;
        }
        if (!RESULT.equals(intent.getAction())) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
            if (p.getBoolean("interactive", false) && confirm != null) {
                p.edit().putString("status", "confirming").apply();
                c.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } else {
                // Never leave Android's install prompt in front of customers; an administrator installs it.
                try { c.getPackageManager().getPackageInstaller().abandonSession(intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1)); }
                catch (RuntimeException ignored) { /* The pending session expires by itself. */ }
                p.edit().putBoolean("needs_confirmation", true).putString("status", "needs_confirmation").apply();
            }
        } else if (status == PackageInstaller.STATUS_SUCCESS) p.edit().putString("status", "installed").apply();
        else p.edit().putString("status", "error").putString("error", "install " + status).apply();
    }
}
