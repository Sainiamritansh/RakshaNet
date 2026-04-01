// services/SOSSirenReceiver.js
// Uses Expo Notifications (works with web Firebase SDK)

import { useEffect, useRef } from "react";
import { Alert, Vibration, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";

const SOS_VIBRATION_PATTERN = [
    0,
    200, 100, 200, 100, 200,
    300,
    500, 100, 500, 100, 500,
    300,
    200, 100, 200, 100, 200,
    1000,
];

/**
 * Add this hook to your App.jsx to handle incoming SOS siren notifications.
 *
 * Usage:
 *   import { useSOSSirenReceiver } from './services/SOSSirenReceiver';
 *   export default function App() {
 *     useSOSSirenReceiver();
 *     ...
 *   }
 */
export function useSOSSirenReceiver() {
    const soundRef = useRef(null);

    useEffect(() => {
        // Handle notification received while app is in FOREGROUND
        const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
            const data = notification.request.content.data;
            if (data?.type === "SOS_SIREN") {
                activateSiren(data.senderName, data.senderPhone, data.location, soundRef);
            }
        });

        // Handle notification TAPPED (app in background/killed)
        const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data;
            if (data?.type === "SOS_SIREN") {
                showSOSAlert(data.senderName, data.senderPhone, data.location, () =>
                    stopSiren(soundRef)
                );
            }
        });

        return () => {
            foregroundSub.remove();
            responseSub.remove();
            stopSiren(soundRef);
        };
    }, []);
}

async function activateSiren(senderName, senderPhone, location, soundRef) {
    try {
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
            require("../assets/eas.mp3"),
            { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        soundRef.current = sound;

        Vibration.vibrate(SOS_VIBRATION_PATTERN, true);

        showSOSAlert(senderName, senderPhone, location, () => stopSiren(soundRef));
    } catch (error) {
        console.error("[SOSSiren] Failed to activate siren:", error);
        showSOSAlert(senderName, senderPhone, location, () => { });
    }
}

function showSOSAlert(senderName, senderPhone, location, onDismiss) {
    Alert.alert(
        "🚨 SOS EMERGENCY ALERT",
        `${senderName} needs help!\n\nPhone: ${senderPhone}\nLocation: ${location}\n\nPlease contact them immediately!`,
        [
            { text: "DISMISS ALARM", style: "destructive", onPress: onDismiss },
            {
                text: `Call ${senderPhone}`,
                onPress: () => {
                    onDismiss();
                    Linking.openURL(`tel:${senderPhone}`);
                },
            },
        ],
        { cancelable: false }
    );
}

async function stopSiren(soundRef) {
    try {
        Vibration.cancel();
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
    } catch (e) {
        console.warn("[SOSSiren] Error stopping siren:", e);
    }
}