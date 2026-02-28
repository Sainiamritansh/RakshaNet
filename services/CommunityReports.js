/**
 * CommunityReports.js — Firebase Firestore operations for
 * community-driven scam reporting database.
 */

import { db } from './firebase';
import {
    collection, query, where, getDocs, addDoc,
    serverTimestamp, onSnapshot, orderBy, limit,
    updateDoc, doc, increment,
} from 'firebase/firestore';
import * as Location from 'expo-location';

const REPORTS_COLLECTION = 'communityReports';

// ── Report Categories ──
export const REPORT_CATEGORIES = [
    { id: 'financial', label: 'Financial Fraud', icon: '💰' },
    { id: 'otp', label: 'OTP Scam', icon: '🔑' },
    { id: 'lottery', label: 'Lottery Scam', icon: '🎰' },
    { id: 'phishing', label: 'Phishing Link', icon: '🔗' },
    { id: 'job', label: 'Fake Job Offer', icon: '💼' },
    { id: 'other', label: 'Other', icon: '❓' },
];

/**
 * Get community reports for a specific number.
 * @param {string} number - Phone number to check
 * @returns {{ found, reportCount, reports[], mostCommonCategory, firstReported }}
 */
export async function getCommunityReports(number) {
    try {
        if (!db) return emptyResult();

        const clean = number.replace(/[\s\-\(\)]/g, '');
        const reportsRef = collection(db, REPORTS_COLLECTION);
        const q = query(
            reportsRef,
            where('number', '==', clean),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return emptyResult();
        }

        const reports = [];
        const categoryCounts = {};

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            reports.push({ id: docSnap.id, ...data });

            // Count categories
            const cat = data.category || 'other';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        // Find most common category
        const mostCommonCategory = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

        // First report date
        const firstReport = reports[reports.length - 1];
        const firstReported = firstReport?.timestamp?.toDate?.()
            ? firstReport.timestamp.toDate().toLocaleDateString()
            : 'Unknown';

        const reportCount = reports.length;

        // Determine community verdict
        let verdict;
        if (reportCount === 0) verdict = 'none';
        else if (reportCount <= 5) verdict = 'few';
        else if (reportCount <= 20) verdict = 'many';
        else verdict = 'confirmed';

        return {
            found: true,
            reportCount,
            reports,
            mostCommonCategory,
            firstReported,
            verdict,
            categoryCounts,
        };
    } catch (error) {
        console.error('Error fetching community reports:', error);
        return emptyResult();
    }
}

/**
 * Subscribe to real-time updates for a number's reports.
 */
export function subscribeToCommunityReports(number, callback) {
    if (!db) return () => { };

    const clean = number.replace(/[\s\-\(\)]/g, '');
    const reportsRef = collection(db, REPORTS_COLLECTION);
    const q = query(reportsRef, where('number', '==', clean));

    return onSnapshot(q, (snapshot) => {
        callback(snapshot.size);
    }, (error) => {
        console.error('Snapshot error:', error);
    });
}

/**
 * Submit a new scam report.
 * @param {object} report - { number, messagePreview, category, userNote }
 * @returns {boolean} success
 */
export async function submitReport({ number, messagePreview, category, userNote }) {
    try {
        if (!db) {
            console.warn('Firebase not available');
            return false;
        }

        // Get approximate location (city level)
        let location = null;
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Low,
                });
                location = {
                    latitude: parseFloat(loc.coords.latitude.toFixed(2)), // City-level precision
                    longitude: parseFloat(loc.coords.longitude.toFixed(2)),
                };
            }
        } catch {
            // Location not critical
        }

        const clean = number ? number.replace(/[\s\-\(\)]/g, '') : '';

        await addDoc(collection(db, REPORTS_COLLECTION), {
            number: clean,
            messagePreview: (messagePreview || '').substring(0, 100),
            category: category || 'other',
            userNote: (userNote || '').substring(0, 200),
            timestamp: serverTimestamp(),
            location,
            reportedBy: 'anonymous',
        });

        console.log('✅ Community report submitted for:', clean);
        return true;
    } catch (error) {
        console.error('Failed to submit report:', error);
        return false;
    }
}

/**
 * Get overall community stats.
 */
export async function getCommunityStats() {
    try {
        if (!db) return { totalReports: 0, totalNumbers: 0 };

        const reportsRef = collection(db, REPORTS_COLLECTION);
        const q = query(reportsRef, orderBy('timestamp', 'desc'), limit(100));
        const snapshot = await getDocs(q);

        const uniqueNumbers = new Set();
        snapshot.forEach(d => {
            const num = d.data().number;
            if (num) uniqueNumbers.add(num);
        });

        return {
            totalReports: snapshot.size,
            totalNumbers: uniqueNumbers.size,
        };
    } catch {
        return { totalReports: 0, totalNumbers: 0 };
    }
}

function emptyResult() {
    return {
        found: false,
        reportCount: 0,
        reports: [],
        mostCommonCategory: null,
        firstReported: null,
        verdict: 'none',
        categoryCounts: {},
    };
}
