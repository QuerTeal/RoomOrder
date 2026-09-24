package kr.dogdive.roomorder;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;

/** Same-UID, read-only IPC: room processes never cache the administrator's preferences. */
public final class RuntimeSettingsProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }
    @Override public Bundle call(String method, String arg, Bundle extras) {
        if (!"kiosk".equals(method)) throw new IllegalArgumentException("Unknown method");
        SettingsStore settings = new SettingsStore(requireContext());
        Bundle result = new Bundle();
        result.putBoolean(SettingsStore.LOCK, settings.locked());
        result.putBoolean(SettingsStore.AWAKE, settings.awake());
        result.putBoolean(SettingsStore.DARK, settings.dark());
        result.putInt(SettingsStore.IDLE_REFRESH, settings.idleRefreshSeconds());
        return result;
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) { throw new UnsupportedOperationException(); }
    @Override public String getType(Uri uri) { return null; }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
}
