// useVolumeShortcut.js
// Place this in: services/useVolumeShortcut.js
//
// HOW IT WORKS:
// - Listens for volume DOWN button presses
// - If pressed 3 times within 2 seconds → triggers SOS callback
// - Works in background when app is open
//
// REQUIRED PACKAGE:
// npx expo install react-native-volume-manager
// (or: npm install react-native-volume-manager)

import { useEffect, useRef } from 'react';
import { VolumeManager } from 'react-native-volume-manager';

const PRESS_COUNT_REQUIRED = 3;      // Number of presses needed
const TIME_WINDOW_MS = 2000;         // Time window in milliseconds (2 seconds)

export function useVolumeShortcut(onTriggered) {
const pressTimestamps = useRef([]);

useEffect(() => {
    // Subscribe to volume change events
    const subscription = VolumeManager.addVolumeListener((result) => {
      // Only react to volume DOWN (volume decreasing)
    if (result.volume !== undefined) {
        const now = Date.now();

        // Add this press timestamp
        pressTimestamps.current.push(now);

        // Remove timestamps outside the time window
        pressTimestamps.current = pressTimestamps.current.filter(
        (t) => now - t <= TIME_WINDOW_MS
        );

        // Check if we've hit the required press count
        if (pressTimestamps.current.length >= PRESS_COUNT_REQUIRED) {
          pressTimestamps.current = []; // Reset
          onTriggered();               // 🚨 Fire SOS!
        }
    }
    });

    return () => {
    subscription.remove();
    };
}, [onTriggered]);
}
