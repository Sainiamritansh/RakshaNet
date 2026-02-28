package com.rakshanet.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class SMSModule extends ReactContextBaseJavaModule {

    private static final String TAG = "RakshaNetSMS";
    private SMSReceiver smsReceiver;

    public SMSModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SMSModule";
    }

    /**
     * Start listening for incoming SMS messages.
     */
    @ReactMethod
    public void startSMSListener(Promise promise) {
        try {
            if (smsReceiver == null) {
                smsReceiver = new SMSReceiver();
                IntentFilter filter = new IntentFilter("android.provider.Telephony.SMS_RECEIVED");
                filter.setPriority(999);
                getReactApplicationContext().registerReceiver(smsReceiver, filter);
                Log.d(TAG, "✅ SMS listener started");
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start SMS listener: " + e.getMessage());
            promise.reject("SMS_ERROR", e.getMessage());
        }
    }

    /**
     * Stop listening for SMS messages.
     */
    @ReactMethod
    public void stopSMSListener(Promise promise) {
        try {
            if (smsReceiver != null) {
                getReactApplicationContext().unregisterReceiver(smsReceiver);
                smsReceiver = null;
                Log.d(TAG, "SMS listener stopped");
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SMS_ERROR", e.getMessage());
        }
    }

    /**
     * Read recent SMS messages from inbox (last 50).
     */
    @ReactMethod
    public void getRecentSMS(int limit, Promise promise) {
        try {
            if (ContextCompat.checkSelfPermission(getReactApplicationContext(),
                    Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_ERROR", "READ_SMS permission not granted");
                return;
            }

            ContentResolver cr = getReactApplicationContext().getContentResolver();
            Cursor cursor = cr.query(
                    Uri.parse("content://sms/inbox"),
                    new String[] { "_id", "address", "body", "date", "read" },
                    null, null,
                    "date DESC LIMIT " + limit);

            WritableArray messages = Arguments.createArray();

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap msg = Arguments.createMap();
                    msg.putString("id", cursor.getString(0));
                    msg.putString("sender", cursor.getString(1));
                    msg.putString("body", cursor.getString(2));
                    msg.putDouble("timestamp", cursor.getLong(3));
                    msg.putBoolean("read", cursor.getInt(4) == 1);
                    messages.pushMap(msg);
                }
                cursor.close();
            }

            promise.resolve(messages);
        } catch (Exception e) {
            Log.e(TAG, "Error reading SMS: " + e.getMessage());
            promise.reject("SMS_ERROR", e.getMessage());
        }
    }

    /**
     * Check if SMS permissions are granted.
     */
    @ReactMethod
    public void checkSMSPermission(Promise promise) {
        boolean hasRead = ContextCompat.checkSelfPermission(getReactApplicationContext(),
                Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasReceive = ContextCompat.checkSelfPermission(getReactApplicationContext(),
                Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        promise.resolve(hasRead && hasReceive);
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN event emitter
    }

    @ReactMethod
    public void removeListeners(int count) {
        // Required for RN event emitter
    }
}
