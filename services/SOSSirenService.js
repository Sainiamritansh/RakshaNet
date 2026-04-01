// services/SOSSirenService.js
// Triggers a siren push notification to emergency contacts via Firebase Cloud Messaging

import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';

/**
 * Call this when SOS is triggered.
 * It stores the alert in Firestore and sends FCM push notifications
 * to all registered emergency contact tokens.
 *
 * @param {string} senderName  - Name of the person in distress
 * @param {string} senderPhone - Phone number of the person in distress
 * @param {string} location    - Location string or coordinates
 * @param {string[]} contactPhones - Array of emergency contact phone numbers
 */
export async function triggerSOSSiren(senderName, senderPhone, location, contactPhones) {
    try {
        // 1. Write the SOS alert to Firestore so contacts can see it in-app later
        const alertRef = await firestore().collection('sos_alerts').add({
            senderName,
            senderPhone,
            location,
            contactPhones,
            timestamp: firestore.FieldValue.serverTimestamp(),
            resolved: false,
        });

        // 2. Look up FCM tokens for each emergency contact phone number
        const tokens = await getContactFCMTokens(contactPhones);

        if (tokens.length === 0) {
            console.warn('[SOSSiren] No FCM tokens found for contacts. Only SMS will be sent.');
            return { success: false, reason: 'no_tokens', alertId: alertRef.id };
        }

        // 3. Send siren push notification to each token via Firestore trigger
        //    (The actual FCM send happens via Cloud Function — see cloud-function.js)
        await firestore().collection('siren_triggers').add({
            alertId: alertRef.id,
            tokens,
            senderName,
            senderPhone,
            location,
            timestamp: firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[SOSSiren] Siren triggered for ${tokens.length} contact(s).`);
        return { success: true, alertId: alertRef.id, notifiedCount: tokens.length };
    } catch (error) {
        console.error('[SOSSiren] Failed to trigger siren:', error);
        throw error;
    }
}

/**
 * Register the current device's FCM token linked to a phone number.
 * Emergency contacts must open the app at least once to register.
 * After that, they receive sirens even without the app open.
 *
 * @param {string} phoneNumber - The user's phone number (used as lookup key)
 */
export async function registerDeviceForSiren(phoneNumber) {
    try {
        // Request notification permission
        const authStatus = await messaging().requestPermission();
        const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
            console.warn('[SOSSiren] Notification permission denied.');
            return false;
        }

        // Get the device FCM token
        const fcmToken = await messaging().getToken();

        // Save it to Firestore linked to their phone number
        await firestore().collection('user_fcm_tokens').doc(phoneNumber).set({
            token: fcmToken,
            phoneNumber,
            updatedAt: firestore.FieldValue.serverTimestamp(),
        });

        console.log('[SOSSiren] Device registered for siren notifications.');
        return true;
    } catch (error) {
        console.error('[SOSSiren] Failed to register device:', error);
        return false;
    }
}

/**
 * Fetch FCM tokens for a list of phone numbers from Firestore.
 * @param {string[]} phoneNumbers
 * @returns {Promise<string[]>} Array of FCM tokens
 */
async function getContactFCMTokens(phoneNumbers) {
    const tokens = [];
    await Promise.all(
        phoneNumbers.map(async (phone) => {
            try {
                const doc = await firestore().collection('user_fcm_tokens').doc(phone).get();
                if (doc.exists && doc.data().token) {
                    tokens.push(doc.data().token);
                }
            } catch (e) {
                console.warn(`[SOSSiren] Could not fetch token for ${phone}`);
            }
        })
    );
    return tokens;
}