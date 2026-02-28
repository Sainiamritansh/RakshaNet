package com.rakshanet.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.telephony.SmsManager;
import android.util.Log;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class SOSAccessibilityService extends AccessibilityService {

    private static final String TAG = "RakshaNetSOS";
    private static final int PRESS_COUNT_REQUIRED = 3;
    private static final long TIME_WINDOW_MS = 2000;
    private static final String PREFS_NAME = "RakshaNetPrefs";
    private static final String CONTACTS_KEY = "emergency_contacts";

    private int volumeUpCount = 0;
    private long firstPressTime = 0;
    private boolean sosInProgress = false;

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_UP
                && event.getAction() == KeyEvent.ACTION_DOWN) {

            long now = System.currentTimeMillis();

            if (volumeUpCount == 0)
                firstPressTime = now;

            if (now - firstPressTime <= TIME_WINDOW_MS) {
                volumeUpCount++;
                Log.d(TAG, "Volume UP press #" + volumeUpCount);

                if (volumeUpCount >= PRESS_COUNT_REQUIRED && !sosInProgress) {
                    volumeUpCount = 0;
                    sosInProgress = true;
                    Log.d(TAG, "🚨 SOS TRIGGERED from background!");
                    triggerSOS();
                }
            } else {
                volumeUpCount = 1;
                firstPressTime = now;
            }
        }
        return false; // Don't consume the event
    }

    private void triggerSOS() {
        // Step 1: Get location and send SMS
        getLocationAndSendSMS();

        // Step 2: Launch the app with SOS intent
        launchApp();

        // Reset after a delay to prevent rapid re-triggering
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            sosInProgress = false;
        }, 5000);
    }

    private void getLocationAndSendSMS() {
        try {
            LocationManager locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) {
                Log.e(TAG, "LocationManager is null");
                return;
            }

            // Try to get last known location first (fastest)
            Location lastKnown = null;
            try {
                lastKnown = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (lastKnown == null) {
                    lastKnown = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                }
            } catch (SecurityException e) {
                Log.e(TAG, "Location permission not granted: " + e.getMessage());
            }

            if (lastKnown != null) {
                Log.d(TAG, "Using last known location");
                sendSOSMessages(lastKnown.getLatitude(), lastKnown.getLongitude());
            } else {
                Log.d(TAG, "No last known location, requesting fresh location...");
                requestFreshLocation(locationManager);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting location: " + e.getMessage());
            // Still send SMS without location
            sendSOSMessages(0, 0);
        }
    }

    private void requestFreshLocation(LocationManager locationManager) {
        try {
            LocationListener listener = new LocationListener() {
                @Override
                public void onLocationChanged(Location location) {
                    Log.d(TAG, "Got fresh location: " + location.getLatitude() + ", " + location.getLongitude());
                    sendSOSMessages(location.getLatitude(), location.getLongitude());
                    try {
                        locationManager.removeUpdates(this);
                    } catch (SecurityException e) {
                        Log.e(TAG, "Error removing updates: " + e.getMessage());
                    }
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {
                }

                @Override
                public void onProviderEnabled(String provider) {
                }

                @Override
                public void onProviderDisabled(String provider) {
                }
            };

            // Try GPS first, then network
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestSingleUpdate(LocationManager.GPS_PROVIDER, listener, Looper.getMainLooper());
            } else if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestSingleUpdate(LocationManager.NETWORK_PROVIDER, listener, Looper.getMainLooper());
            } else {
                Log.e(TAG, "No location provider available");
                sendSOSMessages(0, 0);
            }

            // Timeout: send without precise location after 5 seconds
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    locationManager.removeUpdates(listener);
                } catch (Exception e) {
                    // ignore
                }
            }, 5000);

        } catch (SecurityException e) {
            Log.e(TAG, "Location permission error: " + e.getMessage());
            sendSOSMessages(0, 0);
        }
    }

    private void sendSOSMessages(double latitude, double longitude) {
        List<String> phoneNumbers = getEmergencyContacts();

        if (phoneNumbers.isEmpty()) {
            Log.w(TAG, "No emergency contacts found!");
            return;
        }

        String timestamp = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault()).format(new Date());

        String message;
        if (latitude != 0 && longitude != 0) {
            message = "🚨 EMERGENCY SOS from RakshaNet! 🚨\n\n"
                    + "📍 Location: https://maps.google.com/?q=" + latitude + "," + longitude + "\n"
                    + "⏰ Time: " + timestamp + "\n\n"
                    + "This is an automated emergency alert. Please respond immediately!";
        } else {
            message = "🚨 EMERGENCY SOS from RakshaNet! 🚨\n\n"
                    + "📍 Location could not be determined\n"
                    + "⏰ Time: " + timestamp + "\n\n"
                    + "This is an automated emergency alert. Please respond immediately!";
        }

        try {
            SmsManager smsManager = SmsManager.getDefault();
            ArrayList<String> parts = smsManager.divideMessage(message);

            for (String phone : phoneNumbers) {
                try {
                    smsManager.sendMultipartTextMessage(phone, null, parts, null, null);
                    Log.d(TAG, "✅ SMS sent to: " + phone);
                } catch (Exception e) {
                    Log.e(TAG, "❌ Failed to send SMS to " + phone + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "SMS sending error: " + e.getMessage());
        }
    }

    private List<String> getEmergencyContacts() {
        List<String> phones = new ArrayList<>();
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String contactsJson = prefs.getString(CONTACTS_KEY, "[]");
            JSONArray contacts = new JSONArray(contactsJson);

            for (int i = 0; i < contacts.length(); i++) {
                JSONObject contact = contacts.getJSONObject(i);
                String phone = contact.optString("phone", "");
                if (phone.isEmpty()) {
                    phone = contact.optString("phoneNumber", "");
                }
                if (!phone.isEmpty()) {
                    phones.add(phone);
                }
            }
            Log.d(TAG, "Found " + phones.size() + " emergency contacts");
        } catch (Exception e) {
            Log.e(TAG, "Error reading contacts: " + e.getMessage());
        }
        return phones;
    }

    private void launchApp() {
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("TRIGGER_SOS", true);
            startActivity(intent);
            Log.d(TAG, "App launched with SOS intent");
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Not used, but required
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted");
    }

    @Override
    public void onServiceConnected() {
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.flags = AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS;
        info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        setServiceInfo(info);
        Log.d(TAG, "✅ SOS Accessibility Service connected and active");
    }
}
