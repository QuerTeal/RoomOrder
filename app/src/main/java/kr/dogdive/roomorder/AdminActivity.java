package kr.dogdive.roomorder;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.app.role.RoleManager;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import java.security.GeneralSecurityException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class AdminActivity extends Activity {
    private SettingsStore settings;
    private Ui ui;
    private boolean authenticated, busy, stopped;
    private int epoch, selectedRoom;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler idleHandler = new Handler(Looper.getMainLooper());
    private final Runnable lockIdleSettings = () -> { authenticated = false; epoch++; showPin(false); };
    private void resetIdleLock() {
        idleHandler.removeCallbacks(lockIdleSettings);
        if (authenticated) idleHandler.postDelayed(lockIdleSettings, 120_000);
    }

    @Override public void onCreate(Bundle state) {
        settings = new SettingsStore(this); Ui.prepare(this, settings.dark());
        super.onCreate(state); ui = new Ui(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        showPin(false);
    }
    private LinearLayout screen(boolean narrow) {
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); ui.background(scroll);
        LinearLayout outside = ui.column(); outside.setGravity(Gravity.CENTER);
        outside.setPadding(ui.dp(24), ui.dp(24), ui.dp(24), ui.dp(24)); scroll.addView(outside);
        LinearLayout root = ui.column();
        int width = narrow ? Math.min(ui.dp(560), getResources().getDisplayMetrics().widthPixels - ui.dp(48)) : -1;
        outside.addView(root, new LinearLayout.LayoutParams(width, -2)); setContentView(scroll); return root;
    }
    private EditText pinField(int hint) {
        EditText field = new EditText(this); field.setHint(hint); field.setTextSize(24);
        field.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        field.setFilters(new InputFilter[]{new InputFilter.LengthFilter(6)}); field.setSingleLine();
        field.setMinHeight(ui.dp(64)); field.setSaveEnabled(false);
        field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        field.setSelectAllOnFocus(true); return field;
    }
    private void showPin(boolean change) {
        if (change && !authenticated) return;
        boolean create = !settings.hasPin() || change;
        LinearLayout root = screen(true);
        root.addView(ui.title(create ? R.string.pin_setup_title : R.string.admin));
        root.addView(ui.text(create ? R.string.pin_setup_help : R.string.pin_auth_help, 20));
        EditText pin = pinField(R.string.pin_hint); root.addView(pin);
        EditText repeat = pinField(R.string.pin_repeat); if (create) root.addView(repeat);
        TextView error = ui.text("", 20); error.setTextColor(ui.error); error.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        root.addView(error);
        Button submit = ui.button(create ? R.string.pin_create : R.string.pin_unlock, null, true); root.addView(submit);
        submit.setOnClickListener(v -> {
            if (busy) return;
            if (create && !change && settings.hasPin()) { showPin(false); return; }
            if (change && !authenticated) { showPin(false); return; }
            long seconds = settings.lockedSeconds();
            if (!create && seconds > 0) { error.setText(getString(R.string.pin_locked, seconds)); return; }
            String value = pin.getText().toString();
            if (!PinCredentials.valid(value)) { error.setText(R.string.pin_invalid); return; }
            if (create && !value.equals(repeat.getText().toString())) { error.setText(R.string.pin_mismatch); return; }
            busy = true; submit.setEnabled(false); submit.setText(R.string.working);
            pin.setText(""); repeat.setText(""); final int requestEpoch = epoch;
            worker.execute(() -> {
                boolean ok = false, persistenceError = false;
                try {
                    if (create) { ok = settings.savePin(PinCredentials.create(value)); persistenceError = !ok; }
                    else {
                        ok = PinCredentials.matches(value, settings.credential());
                        boolean saved = ok ? settings.clearAttempts() : settings.failedAttempt();
                        persistenceError = !saved; if (!saved) ok = false;
                    }
                } catch (GeneralSecurityException e) { persistenceError = true; }
                final boolean success = ok, storageFailure = persistenceError;
                runOnUiThread(() -> {
                    busy = false;
                    if (isFinishing() || isDestroyed()) return;
                    if (requestEpoch != epoch) { if (!stopped) showPin(false); return; }
                    if (success) {
                        authenticated = true;
                        ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(pin.getWindowToken(), 0);
                        if (change) Toast.makeText(this, R.string.pin_changed, Toast.LENGTH_SHORT).show();
                        showSettings();
                    } else {
                        submit.setEnabled(true); submit.setText(create ? R.string.pin_create : R.string.pin_unlock);
                        long remaining = settings.lockedSeconds();
                        error.setText(storageFailure ? getString(R.string.save_failed) : remaining > 0 ? getString(R.string.pin_locked, remaining) : getString(R.string.pin_wrong));
                    }
                });
            });
        });
        root.addView(ui.button(R.string.cancel, v -> { if (change) showSettings(); else finish(); }, false));
    }
    private CheckBox check(int text, boolean selected) {
        CheckBox c = new CheckBox(this); c.setText(text); c.setTextSize(20); c.setTextColor(ui.ink);
        c.setChecked(selected); c.setMinHeight(ui.dp(64)); return c;
    }
    private void showSettings() {
        if (!authenticated) { showPin(false); return; }
        resetIdleLock();
        selectedRoom = settings.room();
        LinearLayout root = screen(false); root.addView(ui.title(R.string.admin));
        LinearLayout columns = new LinearLayout(this); root.addView(columns);
        LinearLayout rooms = ui.column(), display = ui.column();
        rooms.setPadding(0, 0, ui.dp(24), 0); display.setPadding(ui.dp(24), 0, 0, 0);
        columns.addView(rooms, new LinearLayout.LayoutParams(0, -2, 1)); columns.addView(display, new LinearLayout.LayoutParams(0, -2, 1));
        rooms.addView(ui.text(R.string.room_setting, 24)); rooms.addView(ui.text(R.string.room_setting_help, 18));
        Button[] buttons = new Button[Rooms.NUMBERS.length];
        for (int i = 0; i < Rooms.NUMBERS.length; i += 2) {
            LinearLayout row = new LinearLayout(this); rooms.addView(row);
            for (int j = i; j < i + 2; j++) {
                final int number = Rooms.NUMBERS[j];
                Button b = ui.button(getString(R.string.room_name, number), v -> {
                    selectedRoom = number;
                    for (int k = 0; k < buttons.length; k++) { buttons[k].setSelected(Rooms.NUMBERS[k] == number); buttons[k].setTextColor(Rooms.NUMBERS[k] == number ? ui.accent : ui.ink); buttons[k].setTypeface(null, Rooms.NUMBERS[k] == number ? Typeface.BOLD : Typeface.NORMAL); }
                }, false);
                buttons[j] = b; b.setSelected(number == selectedRoom); b.setTextSize(24);
                b.setTextColor(number == selectedRoom ? ui.accent : ui.ink); b.setTypeface(null, number == selectedRoom ? Typeface.BOLD : Typeface.NORMAL);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ui.dp(76), 1); lp.setMargins(0, ui.dp(12), ui.dp(12), 0); row.addView(b, lp);
            }
        }
        display.addView(ui.text(R.string.display_setting, 24));
        CheckBox wide = check(R.string.wide_enabled, settings.wide()); display.addView(wide);
        display.addView(ui.text(R.string.wide_help, 18)); display.addView(ui.text(R.string.text_size, 20));
        RadioGroup sizes = new RadioGroup(this); sizes.setOrientation(RadioGroup.HORIZONTAL);
        for (int value : new int[]{100, 120, 140}) {
            RadioButton option = new RadioButton(this); option.setId(value); option.setText(getString(R.string.text_size_value, value));
            option.setTextSize(20); option.setMinHeight(ui.dp(64)); sizes.addView(option, new RadioGroup.LayoutParams(0, -2, 1));
        }
        sizes.check(settings.zoom()); display.addView(sizes);
        CheckBox dark = check(R.string.dark_mode, settings.dark()); dark.setId(R.id.dark_mode_toggle); display.addView(dark);
        display.addView(ui.text(R.string.dark_mode_help, 18));
        display.addView(ui.text(R.string.motion_setting, 24));
        CheckBox number = check(R.string.motion_number, settings.animNumber()); number.setId(R.id.motion_number); display.addView(number);
        CheckBox complete = check(R.string.motion_complete, settings.animComplete()); complete.setId(R.id.motion_complete); display.addView(complete);
        display.addView(ui.text(R.string.motion_bounce, 20));
        String[] bounceOptions = getResources().getStringArray(R.array.motion_bounce_options);
        int selectedBounce = 0;
        for (int i = 0; i < Motion.BOUNCE.length; i++) if (Motion.BOUNCE[i] == settings.animBounce()) selectedBounce = i;
        Spinner bounce = choices(R.id.motion_bounce, bounceOptions, selectedBounce);
        display.addView(bounce, new LinearLayout.LayoutParams(-1, -2));
        display.addView(ui.text(R.string.motion_help, 18));
        display.addView(ui.text(R.string.idle_refresh_setting, 24));
        String[] refreshOptions = new String[IdleRefresh.SECONDS.length];
        int selectedRefresh = 0;
        for (int i = 0; i < refreshOptions.length; i++) {
            int seconds = IdleRefresh.SECONDS[i];
            refreshOptions[i] = seconds == 0 ? getString(R.string.idle_refresh_off) : getString(R.string.idle_refresh_seconds, seconds);
            if (seconds == settings.idleRefreshSeconds()) selectedRefresh = i;
        }
        Spinner refresh = choices(R.id.idle_refresh_setting, refreshOptions, selectedRefresh);
        display.addView(refresh, new LinearLayout.LayoutParams(-1, -2));
        display.addView(ui.text(R.string.idle_refresh_help, 18));
        CheckBox reload = check(R.string.reload_setting, false); display.addView(reload); display.addView(ui.text(R.string.reload_help, 18));
        display.addView(ui.button(R.string.pin_change, v -> showPin(true), false));
        display.addView(ui.button(R.string.kiosk_settings, v -> showKioskSettings(), false));
        display.addView(ui.button(R.string.update_settings, v -> showUpdateSettings(), false));
        Button saveSettings = ui.button(R.string.save, v -> {
            if (!authenticated) return;
            if (!Rooms.valid(selectedRoom)) { Toast.makeText(this, R.string.choose_room, Toast.LENGTH_LONG).show(); return; }
            Runnable save = () -> saveAndClose(wide.isChecked(), sizes.getCheckedRadioButtonId(), dark.isChecked(), reload.isChecked(), IdleRefresh.SECONDS[refresh.getSelectedItemPosition()],
                number.isChecked(), complete.isChecked(), Motion.BOUNCE[bounce.getSelectedItemPosition()]);
            if (selectedRoom != settings.room()) ui.dialog(ui.dialogBuilder(getString(R.string.room_change_title, selectedRoom))
                .setMessage(R.string.room_change_message).setNegativeButton(R.string.cancel, null).setPositiveButton(R.string.confirm, (d,w) -> save.run()));
            else save.run();
        }, true);
        saveSettings.setId(R.id.save_settings); root.addView(saveSettings);
        root.addView(ui.button(R.string.cancel, v -> finish(), false));
    }
    /** Large, readable choices; the selection is saved only with Save. */
    private Spinner choices(int id, String[] options, int selected) {
        Spinner spinner = new Spinner(this); spinner.setId(id);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, options) {
            private View readable(View view) {
                TextView text = (TextView)view; text.setTextSize(20); text.setTextColor(ui.ink);
                text.setMinHeight(ui.dp(64)); text.setGravity(Gravity.CENTER_VERTICAL);
                android.view.ViewGroup.LayoutParams params = text.getLayoutParams();
                if (params != null) { params.height = -2; text.setLayoutParams(params); }
                text.setPadding(ui.dp(12), ui.dp(10), ui.dp(12), ui.dp(10)); return text;
            }
            @Override public View getView(int position, View reuse, android.view.ViewGroup parent) { return readable(super.getView(position, reuse, parent)); }
            @Override public View getDropDownView(int position, View reuse, android.view.ViewGroup parent) { return readable(super.getDropDownView(position, reuse, parent)); }
        };
        spinner.setAdapter(adapter); spinner.setSelection(selected); spinner.setMinimumHeight(ui.dp(64));
        return spinner;
    }
    private void saveAndClose(boolean wide, int zoom, boolean dark, boolean reload, int idleSeconds, boolean animNumber, boolean animComplete, int animBounce) {
        if (!authenticated) return;
        if (!settings.save(selectedRoom, wide, zoom, dark, idleSeconds, animNumber, animComplete, animBounce)) { Toast.makeText(this, R.string.save_failed, Toast.LENGTH_LONG).show(); return; }
        if (getIntent().getBooleanExtra(SettingsStore.INITIAL, false)) {
            startActivity(new Intent(this, RoomPickerActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
        } else setResult(RESULT_OK, settings.snapshot().putExtra(SettingsStore.RELOAD, reload));
        finish();
    }
    private void showKioskSettings() {
        if (!authenticated) { showPin(false); return; }
        resetIdleLock();
        LinearLayout root = screen(false); root.addView(ui.title(R.string.kiosk_settings));
        boolean ready = Rooms.valid(settings.room());
        if (!ready) root.addView(ui.text(R.string.kiosk_save_room_first, 20));
        LinearLayout columns = new LinearLayout(this); root.addView(columns);
        LinearLayout startup = ui.column(), protection = ui.column();
        startup.setPadding(0, 0, ui.dp(24), 0); protection.setPadding(ui.dp(24), 0, 0, 0);
        columns.addView(startup, new LinearLayout.LayoutParams(0, -2, 1));
        columns.addView(protection, new LinearLayout.LayoutParams(0, -2, 1));
        startup.addView(ui.text(R.string.kiosk_startup, 24));
        startup.addView(ui.text(!settings.autoStart() ? R.string.kiosk_home_paused : KioskController.isHome(this) ? R.string.kiosk_home_on : R.string.kiosk_home_off, 20));
        startup.addView(ui.text(R.string.kiosk_home_help, 18));
        Button enableHome = ui.button(R.string.kiosk_enable_home, v -> enableHome(), true);
        enableHome.setEnabled(ready); startup.addView(enableHome);
        Button changeHome = ui.button(R.string.kiosk_change_home, v -> openDeviceSettings(true), false);
        changeHome.setEnabled(ready); startup.addView(changeHome);
        protection.addView(ui.text(R.string.kiosk_protection, 24));
        boolean owner = KioskController.isOwner(this);
        protection.addView(ui.text(owner ? R.string.kiosk_managed : R.string.kiosk_unmanaged, 20));
        CheckBox locked = check(R.string.kiosk_lock, settings.locked());
        locked.setEnabled(ready && owner); protection.addView(locked);
        protection.addView(ui.text(R.string.kiosk_lock_help, 18));
        CheckBox awake = check(R.string.kiosk_awake, settings.awake()); protection.addView(awake);
        protection.addView(ui.text(R.string.kiosk_awake_help, 18));
        Button device = ui.button(R.string.kiosk_device_settings, v -> openDeviceSettings(false), false);
        device.setEnabled(ready); protection.addView(device);
        Button save = ui.button(R.string.kiosk_save, v -> {
            if (!authenticated || !saveKiosk(locked.isChecked(), awake.isChecked())) return;
            setResult(RESULT_OK, settings.snapshot()); finish();
        }, true);
        save.setEnabled(ready); root.addView(save);
        root.addView(ui.button(R.string.back, v -> showSettings(), false));
    }
    private void showUpdateSettings() {
        if (!authenticated) { showPin(false); return; }
        resetIdleLock();
        LinearLayout root = screen(true); root.addView(ui.title(R.string.update_settings));
        UpdateManager.refresh(this);
        boolean configured = !UpdateManager.manifestUrl().isEmpty();
        root.addView(ui.text(getString(R.string.update_current, BuildConfig.VERSION_NAME), 20));
        root.addView(ui.text(configured ? updateStatus() : getString(R.string.update_unconfigured), 20));
        root.addView(ui.text(R.string.update_help, 18));
        Button check = ui.button(R.string.update_check, null, false);
        check.setOnClickListener(v -> {
            check.setEnabled(false); check.setText(R.string.working); final int requestEpoch = epoch;
            UpdateManager.checkNow(this, () -> runOnUiThread(() -> { if (!isDestroyed() && authenticated && requestEpoch == epoch) showUpdateSettings(); }));
        });
        check.setEnabled(configured); check.setAlpha(configured ? 1f : .4f); root.addView(check);
        int ready = UpdateManager.readyVersion(this);
        Button install = ui.button(R.string.update_install, v -> ui.dialog(ui.dialogBuilder(R.string.update_install)
            .setMessage(R.string.update_install_message).setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.confirm, (d, w) -> { if (authenticated) { UpdateManager.installNow(this); Toast.makeText(this, R.string.update_installing, Toast.LENGTH_LONG).show(); } })), true);
        install.setEnabled(ready > 0); install.setAlpha(ready > 0 ? 1f : .4f); root.addView(install);
        // Without device-owner enrollment Android asks once to allow installs from this app.
        if (!KioskController.isOwner(this) && !getPackageManager().canRequestPackageInstalls())
            root.addView(ui.button(R.string.update_allow, v -> {
                try { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, android.net.Uri.parse("package:" + getPackageName()))); }
                catch (ActivityNotFoundException e) { Toast.makeText(this, R.string.kiosk_settings_missing, Toast.LENGTH_LONG).show(); }
            }, false));
        root.addView(ui.button(R.string.back, v -> showSettings(), false));
    }
    private String updateStatus() {
        android.content.SharedPreferences p = UpdateManager.prefs(this);
        long checked = p.getLong("checked_at", 0);
        String when = checked == 0 ? getString(R.string.update_never) : android.text.format.DateFormat.format("MM-dd HH:mm", checked).toString();
        String name = p.getString("available_name", "");
        int text = switch (p.getString("status", "")) {
            case "current" -> R.string.update_status_current;
            case "installed" -> R.string.update_status_installed;
            case "ready" -> R.string.update_status_ready;
            case "needs_confirmation" -> R.string.update_status_confirm;
            case "installing", "confirming" -> R.string.update_status_installing;
            case "rejected" -> R.string.update_status_rejected;
            case "error" -> R.string.update_status_error;
            default -> R.string.update_status_unknown;
        };
        return getString(text, name) + "\n" + getString(R.string.update_checked_at, when);
    }
    private boolean saveKiosk(boolean locked, boolean awake) {
        if (!authenticated) return false;
        boolean previous = settings.locked();
        try {
            KioskController.applyPolicy(this, locked);
            if (settings.saveKiosk(locked, awake)) return true;
            KioskController.applyPolicy(this, previous);
        } catch (SecurityException | IllegalStateException e) {
            Toast.makeText(this, R.string.kiosk_apply_failed, Toast.LENGTH_LONG).show(); return false;
        }
        Toast.makeText(this, R.string.save_failed, Toast.LENGTH_LONG).show(); return false;
    }
    private void enableHome() {
        if (!authenticated || !Rooms.valid(settings.room())) return;
        if (!settings.saveAutoStart(true)) { Toast.makeText(this, R.string.save_failed, Toast.LENGTH_LONG).show(); return; }
        try {
            if (KioskController.isOwner(this)) { KioskController.setManagedHome(this); showKioskSettings(); }
            else {
                RoleManager roles = getSystemService(RoleManager.class);
                if (roles.isRoleAvailable(RoleManager.ROLE_HOME) && !roles.isRoleHeld(RoleManager.ROLE_HOME))
                    startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_HOME), 62);
                else showKioskSettings();
            }
        } catch (ActivityNotFoundException | SecurityException | IllegalStateException e) {
            Toast.makeText(this, R.string.kiosk_apply_failed, Toast.LENGTH_LONG).show();
        }
    }
    private void openDeviceSettings(boolean home) {
        if (!authenticated) return;
        ui.dialog(ui.dialogBuilder(home ? R.string.kiosk_change_home : R.string.kiosk_device_settings)
            .setMessage(home ? R.string.kiosk_change_home_help : R.string.kiosk_maintenance_help)
            .setNegativeButton(R.string.cancel, null).setPositiveButton(R.string.open, (d,w) -> {
                if (!authenticated || !saveKiosk(false, settings.awake())) return;
                if (home && !settings.saveAutoStart(false)) { Toast.makeText(this, R.string.save_failed, Toast.LENGTH_LONG).show(); return; }
                try {
                    if (home) KioskController.clearManagedHome(this);
                    startActivity(new Intent(home ? Settings.ACTION_HOME_SETTINGS : Settings.ACTION_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (ActivityNotFoundException | SecurityException e) {
                    Toast.makeText(this, R.string.kiosk_settings_missing, Toast.LENGTH_LONG).show();
                }
            }));
    }
    @Override public void onUserInteraction() { super.onUserInteraction(); resetIdleLock(); }
    @Override protected void onStop() { super.onStop(); idleHandler.removeCallbacks(lockIdleSettings); authenticated = false; stopped = true; epoch++; if (!isFinishing()) showPin(false); }
    @Override protected void onResume() {
        super.onResume(); KioskController.applyWindow(this, settings.awake());
        if (stopped) { stopped = false; showPin(false); }
    }
    @Override protected void onDestroy() { epoch++; idleHandler.removeCallbacks(lockIdleSettings); worker.shutdown(); super.onDestroy(); }
    @Override public void onWindowFocusChanged(boolean focused) { super.onWindowFocusChanged(focused); if (focused) ui.immersive(); }
}
