package kr.dogdive.roomorder;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.Button;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.ScriptHandler;
import java.util.Set;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

public abstract class MainActivity extends Activity {
    private static final int ADMIN_REQUEST = 41;
    private static boolean profileInitialized;
    protected abstract int roomNumber();
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private TextView status, errorMessage;
    private boolean failed, dark, wide = true;
    private int zoom = 120;
    private boolean animNumber = true, animComplete = true;
    private int animBounce = Motion.DEFAULT_BOUNCE;
    private String tabletScript = "";
    private String themeScript = "";
    private String interactionScript = "";
    private String maintenanceScript = "";
    private IdleRefresh idleRefresh;
    private TextView idleCountdown, maintenanceMessage;
    private LinearLayout maintenancePanel;
    // 0: idle, 1: delete original cart rows, 2: verify a fresh GET, 3: reopen QR.
    private int maintenancePhase, maintenanceLoadEpoch;
    private long maintenanceStarted, maintenanceQueryId, maintenanceProbeStarted;
    private boolean maintenanceProbe, maintenanceFailed, maintenanceAwaitingLoad;
    private String maintenanceCartUrl, lastOrderUrl;
    private static final String CLEANABLE_PATH = ".*/(menu(/[^/]+)?|cart|order/(history|complete))/?";
    private final Runnable maintenanceCheck = () -> checkMaintenance();
    private ScriptHandler documentScript;
    private boolean uiBridge;
    private LinearLayout transitionPanel;
    private ProgressBar transitionSpinner;
    private TextView transitionMessage;
    private Button backButton, homeButton, reviewButton;
    private long visualEpoch;
    private final Runnable uiPoll = () -> pollUiState();
    private String sessionScript = "";
    private SessionRecovery sessionRecovery;
    private SharedPreferences recoveryStore;
    private boolean discardEndedHistory;
    private boolean inspectHttpEnd;
    private boolean recoveryNotice;
    private int pageEpoch;
    private Ui ui;
    private final Handler reconnectHandler = new Handler(Looper.getMainLooper());
    private boolean startupRecovery, visible, retryScheduled, networkFailure;
    private int startupRetries;
    private final Runnable sessionCheck = () -> checkSession();
    private final Runnable startupRetry = () -> {
        retryScheduled = false;
        if (canRetryStartup()) { startupRetries++; loadRoom(); }
    };
    private final ConnectivityManager.NetworkCallback networkCallback = new ConnectivityManager.NetworkCallback() {
        @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
            if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) reconnectHandler.post(() -> scheduleStartupRetry());
        }
    };

    @Override public void onCreate(Bundle state) {
        dark = state == null ? getIntent().getBooleanExtra(SettingsStore.DARK, false) : state.getBoolean(SettingsStore.DARK, false);
        Ui.prepare(this, dark);
        super.onCreate(state); ui = new Ui(this);
        boolean processRecreated = state != null && !profileInitialized;
        recoveryNotice = processRecreated || getIntent().getBooleanExtra(RoomPickerActivity.RECOVERED, false);
        // Must happen before any WebView or CookieManager call in this process.
        if (!profileInitialized) { WebView.setDataDirectorySuffix("room_" + roomNumber()); profileInitialized = true; }
        wide = getIntent().getBooleanExtra(SettingsStore.WIDE, true);
        zoom = SettingsStore.clampZoom(getIntent().getIntExtra(SettingsStore.ZOOM, 120));
        if (state != null) { wide = state.getBoolean(SettingsStore.WIDE, wide); zoom = SettingsStore.clampZoom(state.getInt(SettingsStore.ZOOM, zoom)); }
        setMotion(getIntent());
        idleRefresh = new IdleRefresh(getIntent().getIntExtra(SettingsStore.IDLE_REFRESH, IdleRefresh.DEFAULT_SECONDS), SystemClock.elapsedRealtime());
        try (var input = getAssets().open("theme.js")) { themeScript = new String(input.readAllBytes(), StandardCharsets.UTF_8); }
        catch (IOException e) { /* The native theme remains available. */ }
        try (var input = getAssets().open("tablet.js")) { tabletScript = new String(input.readAllBytes(), StandardCharsets.UTF_8); }
        catch (IOException e) { /* Original page remains usable if the optional stylesheet is unavailable. */ }
        try (var input = getAssets().open("interaction.js")) { interactionScript = new String(input.readAllBytes(), StandardCharsets.UTF_8); }
        catch (IOException e) { /* Native loading cover remains available. */ }
        try (var input = getAssets().open("cart-maintenance.js")) { maintenanceScript = new String(input.readAllBytes(), StandardCharsets.UTF_8); }
        catch (IOException e) { /* Do not delete or refresh when the optional inspector is unavailable. */ }
        try (var input = getAssets().open("session-state.js")) {
            JSONArray titles = new JSONArray();
            for (String title : getResources().getStringArray(R.array.session_ended_titles)) titles.put(title);
            JSONArray expiredTitles = new JSONArray();
            for (String title : getResources().getStringArray(R.array.session_expired_titles)) expiredTitles.put(title);
            sessionScript = new String(input.readAllBytes(), StandardCharsets.UTF_8).replace("__ROOM_TERMINAL_TITLES__", titles.toString())
                .replace("__ROOM_EXPIRED_TITLES__", expiredTitles.toString());
        } catch (IOException e) { /* Manual menu navigation remains available. */ }
        recoveryStore = getSharedPreferences("session_recovery_" + roomNumber(), MODE_PRIVATE);
        sessionRecovery = new SessionRecovery(recoveryStore.getInt("attempts", 0), recoveryStore.getLong("next_allowed", 0));
        buildUi(); configureWeb();
        // Android can recreate a dead room behind Admin without returning a result to the host.
        // Open the original GET entry instead of restoring an interrupted checkout's history.
        if (processRecreated || state == null || web.restoreState(state) == null) { startupRecovery = true; loadRoom(); }
        getSystemService(ConnectivityManager.class).registerDefaultNetworkCallback(networkCallback);
        ui.immersive();
    }
    private void buildUi() {
        LinearLayout root = new LinearLayout(this); ui.background(root);
        ScrollView railScroll = new ScrollView(this); railScroll.setFillViewport(true);
        LinearLayout rail = ui.column(); rail.setPadding(ui.dp(12), ui.dp(24), ui.dp(12), ui.dp(16));
        railScroll.addView(rail); root.addView(railScroll, new LinearLayout.LayoutParams(ui.dp(168), -1));
        TextView room = ui.text(getString(R.string.room_name, roomNumber()), 34); room.setTypeface(null, Typeface.BOLD);
        room.setGravity(Gravity.CENTER); rail.addView(room);
        idleCountdown = ui.text("", 18); idleCountdown.setId(R.id.idle_countdown);
        idleCountdown.setGravity(Gravity.CENTER); idleCountdown.setPadding(0, ui.dp(16), 0, 0); rail.addView(idleCountdown);
        rail.addView(new View(this), new LinearLayout.LayoutParams(1, 0, 1));
        backButton = ui.button(R.string.back, v -> goBack(), true); rail.addView(backButton);
        homeButton = ui.button(R.string.menu_home, v -> confirmHome(), false); rail.addView(homeButton);
        rail.addView(ui.button(R.string.admin, v -> startActivityForResult(new Intent(this, AdminActivity.class), ADMIN_REQUEST), false));
        status = ui.text(R.string.loading, 16); ui.muted(status);
        status.setPadding(0, ui.dp(16), 0, 0); status.setGravity(Gravity.CENTER);
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE); rail.addView(status);
        FrameLayout content = new FrameLayout(this); root.addView(content, new LinearLayout.LayoutParams(0, -1, 1));
        web = new WebView(this); ui.surface(web); content.addView(web, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); progress.setMax(100);
        content.addView(progress, new FrameLayout.LayoutParams(-1, ui.dp(4), Gravity.TOP));
        errorPanel = ui.column(); errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(ui.dp(32), ui.dp(24), ui.dp(32), ui.dp(24)); ui.surface(errorPanel);
        errorPanel.addView(ui.title(R.string.load_failed));
        errorMessage = ui.text(R.string.network_error, 22); errorMessage.setGravity(Gravity.CENTER);
        errorMessage.setPadding(0, ui.dp(16), 0, ui.dp(20)); errorPanel.addView(errorMessage);
        errorPanel.addView(ui.button(R.string.retry, v -> loadRoom(), true));
        errorPanel.setVisibility(View.GONE); content.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        transitionPanel = ui.column(); transitionPanel.setGravity(Gravity.CENTER); ui.background(transitionPanel);
        transitionPanel.setPadding(ui.dp(32), ui.dp(24), ui.dp(32), ui.dp(24));
        transitionPanel.setClickable(true); transitionPanel.setFocusable(true);
        transitionSpinner = new ProgressBar(this); transitionPanel.addView(transitionSpinner);
        transitionMessage = ui.text(R.string.transition_loading, 24); transitionMessage.setGravity(Gravity.CENTER);
        transitionMessage.setPadding(0, ui.dp(24), 0, 0);
        transitionMessage.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        transitionPanel.addView(transitionMessage); content.addView(transitionPanel, new FrameLayout.LayoutParams(-1, -1));
        reviewButton = ui.button(R.string.transition_review_order, v -> {
            if (web != null && trustedPage(web.getUrl())) web.evaluateJavascript("window.__roomInteraction && window.__roomInteraction.review()", null);
        }, true);
        transitionPanel.addView(reviewButton); reviewButton.setVisibility(View.GONE);
        maintenancePanel = ui.column(); maintenancePanel.setGravity(Gravity.CENTER); ui.surface(maintenancePanel);
        maintenancePanel.setPadding(ui.dp(32), ui.dp(24), ui.dp(32), ui.dp(24));
        maintenancePanel.setClickable(true); maintenancePanel.setFocusable(true);
        maintenancePanel.addView(new ProgressBar(this));
        maintenanceMessage = ui.text(R.string.idle_clearing, 24); maintenanceMessage.setGravity(Gravity.CENTER);
        maintenanceMessage.setPadding(0, ui.dp(24), 0, 0); maintenancePanel.addView(maintenanceMessage);
        content.addView(maintenancePanel, new FrameLayout.LayoutParams(-1, -1)); maintenancePanel.setVisibility(View.GONE);
        setTransition(true, "loading");
        setContentView(root);
        ui.refresh(dark);
    }
    @SuppressLint("SetJavaScriptEnabled") private void configureWeb() {
        WebSettings s = web.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setUseWideViewPort(true); s.setLoadWithOverviewMode(true); s.setTextZoom(zoom);
        s.setSupportZoom(true); s.setBuiltInZoomControls(true); s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        uiBridge = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) WebViewCompat.addWebMessageListener(web, "RoomUi", Set.of("https://toss-order.tossplace.com"),
            (view, message, origin, mainFrame, reply) -> {
                if (view == web && mainFrame && "https".equals(origin.getScheme()) && "toss-order.tossplace.com".equals(origin.getHost()))
                    acceptUiState(message.getData());
            });
        installDocumentScript();
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                if (view != web) return;
                progress.setProgress(value); progress.setVisibility(value < 100 && !failed ? View.VISIBLE : View.GONE);
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme())) return false;
                if (request.isForMainFrame() && request.hasGesture()) {
                    ui.dialog(ui.dialogBuilder(R.string.external_title).setMessage(R.string.external_message)
                        .setNegativeButton(R.string.cancel, null).setPositiveButton(R.string.open, (d,w) -> {
                            String scheme = uri.getScheme();
                            if ("tel".equals(scheme) || "mailto".equals(scheme) || "supertoss".equals(scheme)) openExternal(uri);
                            else Toast.makeText(MainActivity.this, R.string.external_unsupported, Toast.LENGTH_LONG).show();
                        }));
                }
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (view != web) return;
                pageEpoch++; sessionRecovery.pause();
                setTransition(true, "loading");
                inspectHttpEnd = false;
                failed = false; networkFailure = false; errorPanel.setVisibility(View.GONE); status.setText(R.string.loading); progress.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (view != web) return;
                if (!failed) {
                    stopStartupRecovery(); showReadyStatus();
                    if (trustedPage(url)) applyLayout(); else setTransition(false, "loading");
                }
                else if (inspectHttpEnd) applyLayout();
                CookieManager.getInstance().flush();
            }
            @Override public void onPageCommitVisible(WebView view, String url) {
                if (view != web) return;
                // The previous document keeps answering scripts until the new one commits.
                if (maintenanceAwaitingLoad && pageEpoch != maintenanceLoadEpoch) maintenanceAwaitingLoad = false;
                if (trustedPage(url)) applyLayout();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (view != web) return;
                if (request.isForMainFrame()) {
                    showError(getString(R.string.network_error));
                    int code = error.getErrorCode();
                    networkFailure = "GET".equals(request.getMethod()) && (code == ERROR_HOST_LOOKUP || code == ERROR_CONNECT || code == ERROR_TIMEOUT);
                    scheduleStartupRetry();
                }
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (view != web) return;
                if (request.isForMainFrame()) {
                    int code = response.getStatusCode();
                    // Inspect authentication/expired-link error pages, but recover only
                    // when the page itself is a recognized terminal screen.
                    inspectHttpEnd = code == 401 || code == 403 || code == 404 || code == 410;
                    showError(getString(R.string.http_error, response.getStatusCode()));
                }
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); if (view == web) showError(getString(R.string.ssl_error));
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view != web) return true;
                web = null; pageEpoch++; visualEpoch++; stopStartupRecovery(); reconnectHandler.removeCallbacks(sessionCheck); reconnectHandler.removeCallbacks(uiPoll);
                sessionRecovery.pause();
                if (view.getParent() instanceof ViewGroup parent) parent.removeView(view);
                view.destroy();
                setResult(RoomPickerActivity.RENDERER_EXIT); finish();
                return true;
            }
            @Override public void doUpdateVisitedHistory(WebView view, String url, boolean reload) {
                if (view != web || url == null) return;
                if (trustedPage(url)) lastOrderUrl = url;
                Uri uri = Uri.parse(url);
                if ("https".equals(uri.getScheme()) && "toss-order.tossplace.com".equals(uri.getHost()) &&
                        uri.getPath() != null && uri.getPath().endsWith("/order/history")) recoveryNotice = false;
            }
        });
        web.setDownloadListener((url, userAgent, disposition, mime, size) -> Toast.makeText(this, R.string.download_help, Toast.LENGTH_LONG).show());
    }
    private boolean trustedPage(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url); return "https".equals(uri.getScheme()) && "toss-order.tossplace.com".equals(uri.getHost());
    }
    private String pageScript() {
        JSONObject config = new JSONObject();
        try {
            config.put("wide", wide).put("dark", dark).put("loading", getString(R.string.transition_loading))
                .put("processing", getString(R.string.transition_processing)).put("slow", getString(R.string.transition_slow))
                .put("uncertain_cart", getString(R.string.transition_uncertain_cart)).put("uncertain_order", getString(R.string.transition_uncertain_order))
                .put("motion", new JSONObject().put("number", animNumber).put("complete", animComplete).put("bounce", animBounce));
        } catch (JSONException e) { throw new IllegalStateException(e); }
        return "window.__roomConfig=" + config + ";\n" + themeScript + "\n" + interactionScript + "\n" + tabletScript + "\n" + maintenanceScript;
    }
    private void installDocumentScript() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            if (documentScript != null) documentScript.remove();
            documentScript = WebViewCompat.addDocumentStartJavaScript(web, pageScript(), Set.of("https://toss-order.tossplace.com"));
        }
    }
    private void setTransition(boolean busy, String phase) {
        setTransition(busy, busy, phase);
    }
    private void setTransition(boolean busy, boolean cover, String phase) {
        long request = ++visualEpoch;
        if (busy || transitionPanel.getVisibility() != View.VISIBLE) setNavigationBusy(busy);
        if (cover) {
            boolean uncertainCart = "uncertain_cart".equals(phase), uncertainOrder = "uncertain_order".equals(phase);
            transitionSpinner.setVisibility(uncertainCart || uncertainOrder ? View.GONE : View.VISIBLE);
            transitionMessage.setText(uncertainCart ? R.string.transition_uncertain_cart : uncertainOrder ? R.string.transition_uncertain_order : "slow".equals(phase) ? R.string.transition_slow : "processing".equals(phase) ? R.string.transition_processing : R.string.transition_loading);
            reviewButton.setText(uncertainCart ? R.string.transition_review_cart : R.string.transition_review_order);
            reviewButton.setVisibility(uncertainCart || uncertainOrder ? View.VISIBLE : View.GONE);
            transitionPanel.setVisibility(View.VISIBLE);
        } else if (web != null && transitionPanel.getVisibility() == View.VISIBLE) {
            WebView expected = web;
            web.postVisualStateCallback(request, new WebView.VisualStateCallback() {
                @Override public void onComplete(long id) {
                    if (web != expected || request != visualEpoch || isDestroyed()) return;
                    transitionPanel.setVisibility(View.GONE);
                    setNavigationBusy(busy);
                }
            });
        }
    }
    private void setNavigationBusy(boolean busy) {
        busy = busy || maintenancePhase != 0;
        backButton.setEnabled(!busy); homeButton.setEnabled(!busy);
        backButton.setAlpha(busy ? .4f : 1f); homeButton.setAlpha(busy ? .4f : 1f);
    }
    private void acceptUiState(String value) {
        if (web == null || value == null || value.length() > 4096) return;
        try {
            JSONObject state = new JSONObject(value);
            if (!state.optString("href").equals(web.getUrl())) return;
            setTransition(state.optBoolean("busy"), state.optBoolean("cover", state.optBoolean("busy")), state.optString("phase"));
            if (!uiBridge && state.optBoolean("busy")) {
                reconnectHandler.removeCallbacks(uiPoll); reconnectHandler.postDelayed(uiPoll, 200);
            }
        } catch (JSONException e) { /* Ignore obsolete/malformed page messages. */ }
    }
    private void pollUiState() {
        if (web != null && trustedPage(web.getUrl()))
            web.evaluateJavascript("window.__roomInteraction ? window.__roomInteraction.state() : ({busy:false,href:location.href})", this::acceptUiState);
    }
    private void applyLayout() {
        if (web == null) return;
        Uri uri = Uri.parse(web.getUrl() == null ? "" : web.getUrl());
        if (!"https".equals(uri.getScheme()) || !"toss-order.tossplace.com".equals(uri.getHost())) return;
        web.evaluateJavascript(pageScript() + ";window.__roomTablet && window.__roomTablet.setEnabled(" + wide + ");" +
            "window.__roomInteraction ? window.__roomInteraction.state() : ({busy:false,href:location.href})", this::acceptUiState);
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (web == null || request != ADMIN_REQUEST || result != RESULT_OK || data == null) return;
        int nextRoom = data.getIntExtra(SettingsStore.ROOM, roomNumber());
        if (nextRoom != roomNumber() && Rooms.valid(nextRoom)) {
            setResult(RESULT_OK); finish(); return;
        }
        wide = data.getBooleanExtra(SettingsStore.WIDE, wide); zoom = SettingsStore.clampZoom(data.getIntExtra(SettingsStore.ZOOM, zoom));
        dark = data.getBooleanExtra(SettingsStore.DARK, dark); ui.refresh(dark);
        configureIdleRefresh(data.getIntExtra(SettingsStore.IDLE_REFRESH, idleRefresh.intervalSeconds()));
        setMotion(data);
        // Keep the current session/cart and retain settings across process recreation.
        getIntent().putExtra(SettingsStore.WIDE, wide).putExtra(SettingsStore.ZOOM, zoom).putExtra(SettingsStore.DARK, dark);
        web.getSettings().setTextZoom(zoom); applyLayout();
        installDocumentScript();
        if (data.getBooleanExtra(SettingsStore.RELOAD, false)) web.reload();
    }
    /** Returns whether the page animations must be reapplied. Kept on the intent for in-process recreation. */
    private boolean setMotion(boolean number, boolean complete, int bounce) {
        bounce = Motion.clampBounce(bounce);
        boolean changed = number != animNumber || complete != animComplete || bounce != animBounce;
        animNumber = number; animComplete = complete; animBounce = bounce;
        getIntent().putExtra(SettingsStore.ANIM_NUMBER, number).putExtra(SettingsStore.ANIM_COMPLETE, complete).putExtra(SettingsStore.ANIM_BOUNCE, bounce);
        return changed;
    }
    private boolean setMotion(Intent source) {
        return setMotion(source.getBooleanExtra(SettingsStore.ANIM_NUMBER, animNumber), source.getBooleanExtra(SettingsStore.ANIM_COMPLETE, animComplete),
            source.getIntExtra(SettingsStore.ANIM_BOUNCE, animBounce));
    }
    private void loadRoom() { if (web != null) web.loadUrl(Rooms.url(this, roomNumber())); }
    private void showReadyStatus() { status.setText(recoveryNotice ? getString(R.string.engine_recovered_notice) : ""); }
    private void checkSession() {
        if (!visible || web == null || isDestroyed()) return;
        if (maintenancePhase != 0) { sessionRecovery.pause(); scheduleSessionCheck(); return; }
        Uri uri = Uri.parse(web.getUrl() == null ? "" : web.getUrl());
        if ((failed && !inspectHttpEnd) || !getWindow().getDecorView().hasWindowFocus() || sessionScript.isEmpty() || !"https".equals(uri.getScheme()) || !"toss-order.tossplace.com".equals(uri.getHost())) {
            sessionRecovery.pause(); scheduleSessionCheck(); return;
        }
        final int epoch = pageEpoch;
        web.evaluateJavascript(sessionScript, value -> {
            if (!visible || web == null || isDestroyed() || epoch != pageEpoch || maintenancePhase != 0) { scheduleSessionCheck(); return; }
            try {
                JSONObject state = new JSONObject(value);
                if (!state.optString("href").equals(web.getUrl())) { sessionRecovery.pause(); scheduleSessionCheck(); return; }
                boolean ended = state.optBoolean("ended"), ready = state.optBoolean("ready");
                if (ended && inspectHttpEnd) { failed = false; inspectHttpEnd = false; errorPanel.setVisibility(View.GONE); }
                int oldAttempts = sessionRecovery.attempts(); long oldNext = sessionRecovery.nextAllowed();
                int action = sessionRecovery.update(ended, ready, System.currentTimeMillis());
                if (oldAttempts != sessionRecovery.attempts() || oldNext != sessionRecovery.nextAllowed())
                    recoveryStore.edit().putInt("attempts", sessionRecovery.attempts()).putLong("next_allowed", sessionRecovery.nextAllowed()).apply();
                if (ready && discardEndedHistory) { web.clearHistory(); discardEndedHistory = false; }
                if (ended) status.setText(action == SessionRecovery.EXHAUSTED ? R.string.session_return_paused : R.string.session_returning);
                else if (!failed) showReadyStatus();
                if (action == SessionRecovery.RETURN) { discardEndedHistory = true; startupRecovery = true; startupRetries = 0; loadRoom(); }
            } catch (JSONException e) { sessionRecovery.pause(); }
            scheduleSessionCheck();
        });
    }
    private void scheduleSessionCheck() {
        reconnectHandler.removeCallbacks(sessionCheck);
        if (visible && web != null && !isDestroyed()) reconnectHandler.postDelayed(sessionCheck, 2_000);
    }
    private boolean canRetryStartup() {
        if (!startupRecovery || !networkFailure || !failed || !visible || isDestroyed() || startupRetries >= 3) return false;
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        NetworkCapabilities capabilities = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
    private void scheduleStartupRetry() {
        if (!retryScheduled && canRetryStartup()) { retryScheduled = true; reconnectHandler.postDelayed(startupRetry, 1500); }
    }
    private void stopStartupRecovery() {
        startupRecovery = false; retryScheduled = false; reconnectHandler.removeCallbacks(startupRetry);
    }
    @Override public void onUserInteraction() { super.onUserInteraction(); stopStartupRecovery(); if (maintenancePhase == 0) resetIdleRefresh(); }
    private void configureIdleRefresh(int seconds) {
        getIntent().putExtra(SettingsStore.IDLE_REFRESH, IdleRefresh.clamp(seconds));
        idleRefresh.configure(seconds, SystemClock.elapsedRealtime()); resetIdleRefresh();
    }
    private void resetIdleRefresh() {
        if (idleRefresh == null || maintenancePhase != 0) return;
        idleRefresh.touch(SystemClock.elapsedRealtime()); maintenanceFailed = false;
        maintenanceQueryId++; maintenanceProbe = false;
    }
    private void scheduleMaintenance() {
        reconnectHandler.removeCallbacks(maintenanceCheck);
        if (visible && web != null && !isDestroyed()) reconnectHandler.postDelayed(maintenanceCheck, 1000);
    }
    private void finishMaintenance(boolean success) {
        if (BuildConfig.DEBUG) android.util.Log.i("RoomMaintenance", "finish=" + success + " phase=" + maintenancePhase
            + " focused=" + getWindow().getDecorView().hasWindowFocus() + " pageFailed=" + failed);
        maintenancePhase = 0; maintenanceQueryId++; maintenanceProbe = false; maintenanceAwaitingLoad = false;
        maintenanceFailed = !success;
        // After a clean menu there is nothing left to clear; the next cycle starts with the next touch.
        if (success) idleRefresh.rest(SystemClock.elapsedRealtime()); else idleRefresh.touch(SystemClock.elapsedRealtime());
        maintenancePanel.setVisibility(View.GONE);
        if (success) idleCountdown.setVisibility(View.GONE); else idleCountdown.setText(R.string.idle_failed);
        setNavigationBusy(false); pollUiState();
    }
    /** The same table session's cart, or null outside an ordering route. */
    private static String cartUrl(String source) {
        if (source == null) return null;
        Uri uri = Uri.parse(source);
        String path = uri.getPath();
        if (path == null) return null;
        String base = path.replaceFirst("/(menu|cart|checkout|order)(/.*)?$", "");
        return base.equals(path) ? null : uri.buildUpon().path(base + "/cart").fragment(null).build().toString();
    }
    private void startMaintenance(String source) {
        maintenanceCartUrl = cartUrl(source);
        maintenanceStarted = SystemClock.elapsedRealtime();
        // Without a known ordering route only the room's QR is reopened; never guess a cart address.
        maintenancePhase = maintenanceCartUrl == null ? 3 : 1;
        maintenanceMessage.setText(maintenanceCartUrl == null ? R.string.idle_reloading : R.string.idle_clearing);
        maintenancePanel.setVisibility(View.VISIBLE); setNavigationBusy(true); stopStartupRecovery();
        // Always read a fresh cart before deleting; never act on a stale detail page.
        openForMaintenance(maintenanceCartUrl);
    }
    /** Loads a page and probes only the document it commits, never the one it replaces. */
    private void openForMaintenance(String url) {
        maintenanceAwaitingLoad = true; maintenanceLoadEpoch = pageEpoch;
        maintenanceQueryId++; maintenanceProbe = false;
        if (url == null) loadRoom(); else web.loadUrl(url);
    }
    private void showIdle(long remaining) {
        idleCountdown.setText(remaining > 60 ? getString(R.string.idle_countdown, remaining / 60, remaining % 60) : getString(R.string.idle_warning, remaining));
    }
    private void waitIdle(long now) { idleRefresh.postponeWarning(now); idleCountdown.setText(R.string.idle_waiting); }
    private void checkMaintenance() {
        if (!visible || web == null || isDestroyed()) return;
        scheduleMaintenance();
        long now = SystemClock.elapsedRealtime();
        boolean enabled = idleRefresh.enabled() && !maintenanceScript.isEmpty();
        boolean resting = maintenancePhase == 0 && !maintenanceFailed && idleRefresh.resting();
        idleCountdown.setVisibility(enabled && !resting ? View.VISIBLE : View.GONE);
        if (!enabled || resting) return;
        if (maintenanceFailed) { idleCountdown.setText(R.string.idle_failed); return; }
        if (maintenancePhase != 0 && now - maintenanceStarted > 120_000) { finishMaintenance(false); return; }
        if (!getWindow().getDecorView().hasWindowFocus() || failed) {
            if (maintenancePhase != 0) finishMaintenance(false); else waitIdle(now);
            return;
        }
        if (maintenanceAwaitingLoad) return;
        String url = web.getUrl();
        if (!trustedPage(url)) {
            // The saved QR is a toss.place short link before it redirects to the ordering origin.
            // Wait only at this room's exact QR entry, without injecting or invoking page scripts.
            if (maintenancePhase == 3 && Rooms.url(this, roomNumber()).equals(url)) return;
            if (maintenancePhase != 0) { finishMaintenance(false); return; }
            // No page script runs on another site. Return only when the visitor left from a page that
            // cleanup may leave; a checkout that continued to another site keeps waiting.
            String path = lastOrderUrl == null ? null : Uri.parse(lastOrderUrl).getPath();
            if (path == null || !path.matches(CLEANABLE_PATH)) { waitIdle(now); return; }
            long remaining = idleRefresh.remainingSeconds(now);
            showIdle(remaining);
            if (remaining == 0) startMaintenance(lastOrderUrl);
            return;
        }
        long remaining = idleRefresh.remainingSeconds(now);
        if (maintenancePhase == 0 && remaining > 60) { showIdle(remaining); return; }
        if (maintenanceProbe) {
            if (now - maintenanceProbeStarted > 5000) {
                maintenanceQueryId++; maintenanceProbe = false;
                if (maintenancePhase != 0) finishMaintenance(false);
                else idleRefresh.postponeWarning(now);
            }
            return;
        }
        final long query = ++maintenanceQueryId;
        final int phase = maintenancePhase;
        final int page = pageEpoch;
        maintenanceProbe = true; maintenanceProbeStarted = now;
        String expression = "window.__roomMaintenance ? window.__roomMaintenance." + (phase == 1 ? "step()" : "snapshot()") + " : null";
        web.evaluateJavascript(expression, value -> {
            if (query != maintenanceQueryId) return;
            maintenanceProbe = false;
            if (!visible || web == null || isDestroyed() || page != pageEpoch || phase != maintenancePhase || !getWindow().getDecorView().hasWindowFocus()) return;
            try {
                if ("null".equals(value)) {
                    if (phase == 0) waitIdle(SystemClock.elapsedRealtime());
                    return;
                }
                JSONObject state = new JSONObject(value);
                if (!state.optString("href").equals(web.getUrl())) return;
                boolean safe = state.optBoolean("safe");
                if (phase == 0) {
                    if (!safe) { waitIdle(SystemClock.elapsedRealtime()); return; }
                    long seconds = idleRefresh.remainingSeconds(SystemClock.elapsedRealtime());
                    showIdle(seconds);
                    if (seconds == 0) startMaintenance(web.getUrl());
                } else if (phase == 1) {
                    if (BuildConfig.DEBUG) android.util.Log.i("RoomMaintenance", "delete=" + state.optString("status") + " count=" + state.optInt("count") + " reason=" + state.optString("reason"));
                    if ("failed".equals(state.optString("status"))) { finishMaintenance(false); return; }
                    if ("empty".equals(state.optString("status"))) {
                        maintenancePhase = 2; maintenanceMessage.setText(R.string.idle_verifying); openForMaintenance(maintenanceCartUrl);
                    }
                } else if (phase == 2 && safe) {
                    if (BuildConfig.DEBUG) android.util.Log.i("RoomMaintenance", "verify cart=" + state.optBoolean("cart") + " empty=" + state.optBoolean("empty"));
                    if (!state.optBoolean("cart") || !state.optBoolean("empty")) { finishMaintenance(false); return; }
                    maintenancePhase = 3; maintenanceMessage.setText(R.string.idle_reloading); openForMaintenance(null);
                } else if (phase == 3 && safe && state.optBoolean("menu")) {
                    web.clearHistory(); finishMaintenance(true);
                }
            } catch (JSONException e) { if (phase != 0) finishMaintenance(false); }
        });
    }
    private void showError(String message) {
        setTransition(false, "loading");
        failed = true; status.setText(R.string.connection_check); progress.setVisibility(View.GONE);
        errorMessage.setText(message); errorPanel.setVisibility(View.VISIBLE);
    }
    private void confirmHome() {
        if (web == null || maintenancePhase != 0) return;
        web.evaluateJavascript("!window.__roomInteraction || window.__roomInteraction.canLeave()", value -> {
            if (!"true".equals(value) || isFinishing() || isDestroyed() || maintenancePhase != 0) return;
        ui.dialog(ui.dialogBuilder(getString(R.string.home_title, roomNumber())).setMessage(R.string.home_message)
            .setNegativeButton(R.string.cancel, null).setPositiveButton(R.string.open, (d,w) -> loadRoom()));
        });
    }
    private void goBack() {
        if (maintenancePhase != 0) return;
        if (web != null && web.canGoBack()) {
            if (trustedPage(web.getUrl())) web.evaluateJavascript("window.__roomInteraction ? window.__roomInteraction.back() : history.back()", null);
            else web.goBack();
        } else Toast.makeText(this, R.string.first_page, Toast.LENGTH_SHORT).show();
    }
    @Override public void onBackPressed() { goBack(); }
    private void openExternal(Uri uri) {
        if (getSystemService(android.app.ActivityManager.class).getLockTaskModeState() != android.app.ActivityManager.LOCK_TASK_MODE_NONE) {
            Toast.makeText(this, R.string.kiosk_external_blocked, Toast.LENGTH_LONG).show(); return;
        }
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException | SecurityException e) { Toast.makeText(this, R.string.external_missing, Toast.LENGTH_LONG).show(); }
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if (web == null) return;
        wide = intent.getBooleanExtra(SettingsStore.WIDE, wide);
        zoom = SettingsStore.clampZoom(intent.getIntExtra(SettingsStore.ZOOM, zoom));
        dark = intent.getBooleanExtra(SettingsStore.DARK, dark); ui.refresh(dark);
        configureIdleRefresh(intent.getIntExtra(SettingsStore.IDLE_REFRESH, idleRefresh.intervalSeconds()));
        setMotion(intent);
        web.getSettings().setTextZoom(zoom); installDocumentScript(); applyLayout();
    }
    @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus) ui.immersive(); }
    @Override protected void onSaveInstanceState(Bundle out) { if (web != null) web.saveState(out); out.putBoolean(SettingsStore.WIDE, wide); out.putInt(SettingsStore.ZOOM, zoom); out.putBoolean(SettingsStore.DARK, dark); super.onSaveInstanceState(out); }
    @Override protected void onPause() {
        if (maintenancePhase != 0) finishMaintenance(false);
        maintenanceQueryId++; maintenanceProbe = false; reconnectHandler.removeCallbacks(maintenanceCheck);
        visible = false; pageEpoch++; sessionRecovery.pause(); reconnectHandler.removeCallbacks(sessionCheck);
        if (web != null) { web.onPause(); CookieManager.getInstance().flush(); } super.onPause();
    }
    @Override protected void onResume() {
        super.onResume(); visible = true; if (web != null) web.onResume(); scheduleStartupRetry();
        resetIdleRefresh(); scheduleMaintenance();
        scheduleSessionCheck();
        try {
            Bundle runtime = KioskController.runtime(this);
            boolean savedDark = runtime.getBoolean(SettingsStore.DARK, dark);
            int savedIdle = runtime.getInt(SettingsStore.IDLE_REFRESH, idleRefresh.intervalSeconds());
            if (savedIdle != idleRefresh.intervalSeconds()) configureIdleRefresh(savedIdle);
            boolean motionChanged = setMotion(runtime.getBoolean(SettingsStore.ANIM_NUMBER, animNumber),
                runtime.getBoolean(SettingsStore.ANIM_COMPLETE, animComplete), runtime.getInt(SettingsStore.ANIM_BOUNCE, animBounce));
            if ((dark != savedDark || motionChanged) && web != null) {
                if (dark != savedDark) { dark = savedDark; getIntent().putExtra(SettingsStore.DARK, dark); ui.refresh(dark); }
                installDocumentScript(); applyLayout();
            }
            KioskController.resume(this);
        }
        catch (IllegalStateException | SecurityException e) { Toast.makeText(this, R.string.kiosk_apply_failed, Toast.LENGTH_LONG).show(); }
    }
    @Override protected void onDestroy() {
        getSystemService(ConnectivityManager.class).unregisterNetworkCallback(networkCallback);
        reconnectHandler.removeCallbacksAndMessages(null);
        if (web != null) { web.stopLoading(); web.destroy(); } super.onDestroy();
    }
}
