package kr.dogdive.roomorder;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.os.Bundle;

/** Install results arrive as an activity, not a broadcast: some tablets suppress broadcasts to this app
    after it replaced itself, but the system still starts the result activity of the new version, which
    then reopens the room. Shows nothing and finishes at once. */
public final class UpdateResultActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        Intent intent = getIntent();
        SharedPreferences p = UpdateManager.prefs(this);
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
            if (p.getBoolean("interactive", false) && confirm != null) {
                p.edit().putString("status", "confirming").apply();
                startActivity(confirm);
            } else {
                // Never leave Android's install prompt in front of customers; an administrator installs it.
                try { getPackageManager().getPackageInstaller().abandonSession(intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1)); }
                catch (RuntimeException ignored) { /* The pending session expires by itself. */ }
                p.edit().putBoolean("needs_confirmation", true).putString("status", "needs_confirmation").apply();
            }
        } else if (status == PackageInstaller.STATUS_SUCCESS) {
            UpdateManager.refresh(this);
            RoomPickerActivity.openSavedRoom(this);
        } else p.edit().putString("status", "error").putString("error", "install " + status).apply();
        finish();
    }
}
