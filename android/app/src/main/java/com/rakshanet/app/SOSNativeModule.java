package com.rakshanet.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class SOSNativeModule extends ReactContextBaseJavaModule {

    private static final String TAG = "RakshaNetSOS";
    private static final String PREFS_NAME = "RakshaNetPrefs";
    private static final String CONTACTS_KEY = "emergency_contacts";

    public SOSNativeModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SOSNativeModule";
    }

    /**
     * Sync emergency contacts from JS to SharedPreferences (native storage).
     * Called whenever contacts change so the AccessibilityService can read them.
     */
    @ReactMethod
    public void syncContacts(String contactsJson, Promise promise) {
        try {
            SharedPreferences prefs = getReactApplicationContext()
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(CONTACTS_KEY, contactsJson).apply();
            Log.d(TAG, "✅ Contacts synced to native: " + contactsJson);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to sync contacts: " + e.getMessage());
            promise.reject("SYNC_ERROR", e.getMessage());
        }
    }

    /**
     * Check if the app was launched via the SOS volume shortcut.
     */
    @ReactMethod
    public void checkSOSIntent(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity != null) {
                Intent intent = activity.getIntent();
                boolean triggerSOS = intent.getBooleanExtra("TRIGGER_SOS", false);
                if (triggerSOS) {
                    // Clear the flag so it doesn't re-trigger
                    intent.removeExtra("TRIGGER_SOS");
                    Log.d(TAG, "✅ SOS intent detected!");
                }
                promise.resolve(triggerSOS);
            } else {
                promise.resolve(false);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking SOS intent: " + e.getMessage());
            promise.resolve(false);
        }
    }

    /**
     * Open Android Accessibility Settings so user can enable the SOS service.
     */
    @ReactMethod
    public void openAccessibilitySettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error opening settings: " + e.getMessage());
            promise.reject("SETTINGS_ERROR", e.getMessage());
        }
    }

    /**
     * Check if the accessibility service is currently enabled.
     */
    @ReactMethod
    public void isServiceEnabled(Promise promise) {
        try {
            String enabledServices = Settings.Secure.getString(
                    getReactApplicationContext().getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            boolean isEnabled = enabledServices != null
                    && enabledServices.contains(getReactApplicationContext().getPackageName()
                            + "/" + SOSAccessibilityService.class.getName());
            promise.resolve(isEnabled);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }
}
