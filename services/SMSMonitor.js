/**
 * SMSMonitor.js — Orchestrates SMS monitoring, spam checking,
 * blocklist management, and Firebase spam reporting.
 */

import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { fullAnalysis } from './SpamChecker';
import { extractLinks, processMessageLinks, analyzeLinkSafety } from './LinkBlocker';

const { SMSModule } = NativeModules;

const BLOCKLIST_KEY = '@spam_blocklist';
const SPAM_HISTORY_KEY = '@spam_history';
const SHIELD_ACTIVE_KEY = '@shield_active';

let smsEventEmitter = null;
let smsSubscription = null;
let onSpamDetectedCallback = null;

// ───────────── Blocklist Management ─────────────

/**
 * Get all blocked numbers.
 */
export async function getBlocklist() {
    try {
        const data = await AsyncStorage.getItem(BLOCKLIST_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Add a number to the blocklist.
 */
export async function blockNumber(phoneNumber, reason = '') {
    try {
        const blocklist = await getBlocklist();
        if (!blocklist.find(b => b.number === phoneNumber)) {
            blocklist.push({
                number: phoneNumber,
                reason,
                blockedAt: new Date().toISOString(),
            });
            await AsyncStorage.setItem(BLOCKLIST_KEY, JSON.stringify(blocklist));
        }
        return true;
    } catch (error) {
        console.error('Failed to block number:', error);
        return false;
    }
}

/**
 * Remove a number from the blocklist.
 */
export async function unblockNumber(phoneNumber) {
    try {
        const blocklist = await getBlocklist();
        const updated = blocklist.filter(b => b.number !== phoneNumber);
        await AsyncStorage.setItem(BLOCKLIST_KEY, JSON.stringify(updated));
        return true;
    } catch (error) {
        console.error('Failed to unblock number:', error);
        return false;
    }
}

/**
 * Check if a number is blocked.
 */
export async function isBlocked(phoneNumber) {
    const blocklist = await getBlocklist();
    return blocklist.some(b => b.number === phoneNumber);
}

// ───────────── Spam History ─────────────

/**
 * Get spam history.
 */
export async function getSpamHistory() {
    try {
        const data = await AsyncStorage.getItem(SPAM_HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Save a spam record to history.
 */
export async function saveToHistory(record) {
    try {
        const history = await getSpamHistory();
        history.unshift(record); // Add to top
        // Keep last 200 records
        const trimmed = history.slice(0, 200);
        await AsyncStorage.setItem(SPAM_HISTORY_KEY, JSON.stringify(trimmed));
    } catch (error) {
        console.error('Failed to save to history:', error);
    }
}

/**
 * Clear spam history.
 */
export async function clearHistory() {
    await AsyncStorage.setItem(SPAM_HISTORY_KEY, JSON.stringify([]));
}

/**
 * Update action on a history record.
 */
export async function updateHistoryAction(id, action) {
    try {
        const history = await getSpamHistory();
        const idx = history.findIndex(h => h.id === id);
        if (idx !== -1) {
            history[idx].action = action;
            await AsyncStorage.setItem(SPAM_HISTORY_KEY, JSON.stringify(history));
        }
    } catch (error) {
        console.error('Failed to update history:', error);
    }
}

// ───────────── Firebase Reporting ─────────────

/**
 * Report a spam number to Firebase community database.
 */
export async function reportSpamToFirebase(phoneNumber, messagePreview) {
    try {
        if (!db) {
            console.warn('Firebase not available');
            return false;
        }

        let location = null;
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
                location = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
            }
        } catch {
            // Location not required
        }

        await addDoc(collection(db, 'spamReports'), {
            number: phoneNumber,
            messagePreview: messagePreview.substring(0, 100),
            timestamp: serverTimestamp(),
            location,
            reportedBy: 'anonymous',
        });

        console.log('✅ Spam reported to Firebase:', phoneNumber);
        return true;
    } catch (error) {
        console.error('Failed to report spam:', error);
        return false;
    }
}

// ───────────── SMS Processing ─────────────

/**
 * Process an incoming SMS message.
 */
async function processIncomingSMS(sender, body, timestamp) {
    console.log('📨 Processing SMS from:', sender);

    // 1. Check blocklist
    const blocked = await isBlocked(sender);
    if (blocked) {
        console.log('🚫 Blocked sender:', sender);
        const record = {
            id: `sms_${timestamp}`,
            sender,
            body,
            timestamp,
            confidence: 'blocked',
            score: 100,
            reasons: ['Number is on blocklist'],
            links: [],
            action: 'blocked',
        };
        await saveToHistory(record);
        return;
    }

    // 2. Analyze for spam
    const analysis = await fullAnalysis(body, sender);

    // 3. Check links
    const links = extractLinks(body);
    const { safeText, blockedLinks } = processMessageLinks(body);

    // Check links against Safe Browsing (async, don't block)
    if (links.length > 0) {
        links.forEach(async (link) => {
            const linkResult = await analyzeLinkSafety(link);
            if (linkResult.confirmedDangerous) {
                analysis.score = Math.min(analysis.score + 30, 100);
                analysis.reasons.push(`Dangerous link: ${linkResult.threatType}`);
                analysis.confidence = 'high';
                analysis.isSpam = true;

                // Auto-block and report dangerous links
                await blockNumber(sender, 'Dangerous link detected');
                await reportSpamToFirebase(sender, body);
            }
        });
    }

    // 4. Save to history
    const record = {
        id: `sms_${timestamp}`,
        sender,
        body,
        safeText: blockedLinks.length > 0 ? safeText : body,
        timestamp,
        confidence: analysis.confidence,
        score: analysis.score,
        reasons: analysis.reasons,
        isSpam: analysis.isSpam,
        links,
        blockedLinks,
        action: 'none',
    };
    await saveToHistory(record);

    // 5. Show notification if spam or suspicious
    if (analysis.isSpam || analysis.confidence === 'low') {
        const confidenceEmoji = {
            high: '🔴',
            medium: '🟡',
            low: '🟢',
        };

        await Notifications.scheduleNotificationAsync({
            content: {
                title: `${confidenceEmoji[analysis.confidence] || '⚠️'} Spam ${analysis.confidence === 'high' ? 'DETECTED' : 'Suspected'} — ${sender}`,
                body: `${body.substring(0, 80)}...`,
                data: { type: 'spam_alert', recordId: record.id },
                sound: true,
            },
            trigger: null,
        });

        // 6. Trigger in-app callback
        if (onSpamDetectedCallback) {
            onSpamDetectedCallback(record);
        }
    }
}

// ───────────── SMS Listener Control ─────────────

/**
 * Request SMS permissions.
 */
export async function requestSMSPermissions() {
    if (Platform.OS !== 'android') return false;

    try {
        const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        ]);

        const allGranted =
            granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED;

        return allGranted;
    } catch (error) {
        console.error('Permission error:', error);
        return false;
    }
}

/**
 * Start the SMS monitoring service.
 * @param {function} onSpamDetected - Callback when spam is detected
 */
export async function startMonitoring(onSpamDetected) {
    if (Platform.OS !== 'android' || !SMSModule) {
        console.log('SMS monitoring only available on Android');
        return false;
    }

    onSpamDetectedCallback = onSpamDetected;

    try {
        // Request permissions
        const hasPermission = await requestSMSPermissions();
        if (!hasPermission) {
            console.warn('SMS permissions not granted');
            return false;
        }

        // Start native listener
        await SMSModule.startSMSListener();

        // Listen for SMS events
        smsEventEmitter = new NativeEventEmitter(SMSModule);
        smsSubscription = smsEventEmitter.addListener('onSMSReceived', (event) => {
            const { sender, body, timestamp } = event;
            processIncomingSMS(sender, body, timestamp);
        });

        await AsyncStorage.setItem(SHIELD_ACTIVE_KEY, 'true');
        console.log('✅ SMS Shield monitoring started');
        return true;
    } catch (error) {
        console.error('Failed to start monitoring:', error);
        return false;
    }
}

/**
 * Stop SMS monitoring.
 */
export async function stopMonitoring() {
    try {
        if (smsSubscription) {
            smsSubscription.remove();
            smsSubscription = null;
        }
        if (SMSModule) {
            await SMSModule.stopSMSListener();
        }
        await AsyncStorage.setItem(SHIELD_ACTIVE_KEY, 'false');
        onSpamDetectedCallback = null;
        console.log('SMS Shield monitoring stopped');
    } catch (error) {
        console.error('Failed to stop monitoring:', error);
    }
}

/**
 * Check if shield is active.
 */
export async function isShieldActive() {
    try {
        const val = await AsyncStorage.getItem(SHIELD_ACTIVE_KEY);
        return val === 'true';
    } catch {
        return false;
    }
}

/**
 * Get recent SMS from inbox for scanning.
 */
export async function scanInboxSMS(limit = 30) {
    if (Platform.OS !== 'android' || !SMSModule) return [];

    try {
        const messages = await SMSModule.getRecentSMS(limit);
        return messages || [];
    } catch (error) {
        console.error('Failed to read inbox:', error);
        return [];
    }
}
