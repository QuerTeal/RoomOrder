package kr.dogdive.roomorder;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.KeyguardManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;

final class KioskController {
    private KioskController() { }
    static ComponentName admin(Context c) { return new ComponentName(c, KioskAdminReceiver.class); }
    static boolean isOwner(Context c) { return c.getSystemService(DevicePolicyManager.class).isDeviceOwnerApp(c.getPackageName()); }
    static boolean isHome(Context c) {
        var resolved = c.getPackageManager().resolveActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
        return resolved != null && resolved.activityInfo != null && c.getPackageName().equals(resolved.activityInfo.packageName)
            && KioskHomeActivity.class.getName().equals(resolved.activityInfo.name);
    }
    static void setManagedHome(Context c) {
        IntentFilter filter = new IntentFilter(Intent.ACTION_MAIN);
        filter.addCategory(Intent.CATEGORY_HOME); filter.addCategory(Intent.CATEGORY_DEFAULT);
        c.getSystemService(DevicePolicyManager.class).addPersistentPreferredActivity(admin(c), filter, new ComponentName(c, KioskHomeActivity.class));
    }
    static void clearManagedHome(Context c) {
        if (isOwner(c)) c.getSystemService(DevicePolicyManager.class).clearPackagePersistentPreferredActivities(admin(c), c.getPackageName());
    }
    static void applyPolicy(Context c, boolean locked) {
        DevicePolicyManager dpm = c.getSystemService(DevicePolicyManager.class);
        if (!isOwner(c)) {
            if (locked) throw new SecurityException("Device-owner enrollment required");
            return;
        }
        // Keep the power menu available for a controlled restart. Navigation and notifications stay blocked.
        if (locked) dpm.setLockTaskFeatures(admin(c), DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS);
        else if (c instanceof Activity activity && c.getSystemService(ActivityManager.class).getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_LOCKED) {
            // Stop our task first so removing it from the allowlist does not finish the order WebView.
            try { activity.stopLockTask(); } catch (SecurityException ignored) { /* The owner can still remove the allowlist below. */ }
        }
        dpm.setLockTaskPackages(admin(c), locked ? new String[]{c.getPackageName()} : new String[0]);
    }
    static Bundle runtime(Context c) {
        Bundle result = c.getContentResolver().call(Uri.parse("content://" + c.getPackageName() + ".runtime"), "kiosk", null, null);
        if (result == null) throw new IllegalStateException("Runtime settings unavailable");
        return result;
    }
    static void applyWindow(Activity activity, boolean awake) {
        if (awake) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    static void resume(Activity activity) {
        Bundle settings = runtime(activity);
        applyWindow(activity, settings.getBoolean(SettingsStore.AWAKE, true));
        boolean locked = settings.getBoolean(SettingsStore.LOCK);
        applyPolicy(activity, locked);
        if (!locked || activity.getSystemService(KeyguardManager.class).isKeyguardLocked()) return;
        ActivityManager manager = activity.getSystemService(ActivityManager.class);
        if (manager.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_NONE
                && activity.getSystemService(DevicePolicyManager.class).isLockTaskPermitted(activity.getPackageName())) activity.startLockTask();
    }
}
