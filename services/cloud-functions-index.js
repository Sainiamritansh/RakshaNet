// cloud-functions/index.js
// Deploy this to Firebase Cloud Functions.
// It listens for new siren_triggers in Firestore and sends loud FCM push notifications.
//
// SETUP:
//   cd cloud-functions
//   npm install firebase-admin firebase-functions
//   firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Firestore trigger: fires when a new document is added to `siren_triggers`.
 * Sends a high-priority FCM notification to all emergency contact tokens.
 */
exports.sendSOSSiren = functions.firestore
    .document('siren_triggers/{triggerId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const { tokens, senderName, senderPhone, location, alertId } = data;

        if (!tokens || tokens.length === 0) {
            console.log('No tokens to notify.');
            return null;
        }

        // Build the FCM message payload
        // - android.priority: 'high' wakes up locked screens
        // - android.sound: 'sos_siren' plays a custom loud sound (see setup below)
        // - notification_priority: PRIORITY_MAX ensures heads-up display
        const message = {
            notification: {
                title: `🚨 SOS ALERT from ${senderName}`,
                body: `${senderName} (${senderPhone}) needs help!\nLocation: ${location}`,
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'eas',           // custom sound file (see README below)
                    channelId: 'sos_siren_channel',
                    priority: 'max',
                    vibrateTimingsMillis: [0, 500, 200, 500, 200, 500],
                    defaultVibrateTimings: false,
                    sticky: true,                 // stays until dismissed
                    localOnly: false,
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'eas.mp3',     // iOS custom sound file
                        'content-available': 1,
                        badge: 1,
                    },
                },
                headers: {
                    'apns-priority': '10',        // highest iOS priority
                },
            },
            data: {
                alertId,
                senderName,
                senderPhone,
                location,
                type: 'SOS_SIREN',
            },
            tokens,
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`[SOSSiren] Sent to ${response.successCount}/${tokens.length} devices.`);

            // Log any failures
            response.responses.forEach((res, i) => {
                if (!res.success) {
                    console.error(`Token ${tokens[i]} failed:`, res.error?.message);
                }
            });

            // Mark the siren as sent in Firestore
            await snap.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
        } catch (error) {
            console.error('[SOSSiren] FCM send error:', error);
        }

        return null;
    });

/**
 * OPTIONAL: Auto-resolve alerts after 30 minutes if not manually resolved.
 * Runs every 30 minutes.
 */
exports.autoResolveAlerts = functions.pubsub
    .schedule('every 30 minutes')
    .onRun(async () => {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const snapshot = await admin
            .firestore()
            .collection('sos_alerts')
            .where('resolved', '==', false)
            .where('timestamp', '<', thirtyMinutesAgo)
            .get();

        const batch = admin.firestore().batch();
        snapshot.forEach((doc) => {
            batch.update(doc.ref, { resolved: true, autoResolved: true });
        });
        await batch.commit();
        console.log(`[SOSSiren] Auto-resolved ${snapshot.size} stale alerts.`);
        return null;
    });