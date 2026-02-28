package com.rakshanet.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class SMSReceiver extends BroadcastReceiver {

    private static final String TAG = "RakshaNetSMS";
    private static final String EVENT_NAME = "onSMSReceived";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null)
            return;

        if ("android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            Bundle bundle = intent.getExtras();
            if (bundle == null)
                return;

            Object[] pdus = (Object[]) bundle.get("pdus");
            if (pdus == null)
                return;

            String format = bundle.getString("format");

            // Reassemble multi-part SMS
            StringBuilder fullMessage = new StringBuilder();
            String senderNumber = "";

            for (Object pdu : pdus) {
                SmsMessage smsMessage;
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                } else {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                }

                if (smsMessage != null) {
                    senderNumber = smsMessage.getDisplayOriginatingAddress();
                    fullMessage.append(smsMessage.getMessageBody());
                }
            }

            String body = fullMessage.toString();
            long timestamp = System.currentTimeMillis();

            Log.d(TAG, "SMS received from: " + senderNumber);

            // Send event to React Native
            sendEventToJS(context, senderNumber, body, timestamp);
        }
    }

    private void sendEventToJS(Context context, String sender, String body, long timestamp) {
        try {
            ReactApplication reactApp = (ReactApplication) context.getApplicationContext();
            ReactInstanceManager reactInstanceManager = reactApp.getReactNativeHost().getReactInstanceManager();
            ReactContext reactContext = reactInstanceManager.getCurrentReactContext();

            if (reactContext != null && reactContext.hasActiveReactInstance()) {
                WritableMap params = Arguments.createMap();
                params.putString("sender", sender);
                params.putString("body", body);
                params.putDouble("timestamp", timestamp);

                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit(EVENT_NAME, params);

                Log.d(TAG, "Event sent to JS: " + sender);
            } else {
                Log.d(TAG, "React context not available, SMS will be processed when app opens");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending event to JS: " + e.getMessage());
        }
    }
}
