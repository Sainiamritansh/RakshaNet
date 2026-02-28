/**
 * SpamChecker.js — Spam detection logic for SMS messages.
 * Analyzes message content for spam patterns and returns a confidence score.
 */

import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Spam keyword patterns (case-insensitive)
const SPAM_KEYWORDS = [
    'won', 'prize', 'lottery', 'click', 'verify', 'otp',
    'bank account', 'kyc', 'expire', 'urgent', 'free',
    'winner', 'claim', 'reward', 'offer', 'limited time',
    'congratulations', 'selected', 'lucky', 'jackpot',
    'cash', 'credit card', 'loan approved', 'act now',
    'suspended', 'blocked', 'verify your', 'update your',
    'confirm your', 'reactivate', 'deactivated',
    'pan card', 'aadhaar', 'aadhar', 'income tax',
    'refund', 'cashback', 'coupon', 'voucher',
    'investment', 'trading', 'crypto', 'bitcoin',
    'earn money', 'work from home', 'part time job',
];

// URL patterns
const URL_PATTERNS = [
    /https?:\/\/[^\s]+/gi,
    /www\.[^\s]+/gi,
    /bit\.ly\/[^\s]+/gi,
    /tinyurl\.com\/[^\s]+/gi,
    /goo\.gl\/[^\s]+/gi,
    /t\.co\/[^\s]+/gi,
    /is\.gd\/[^\s]+/gi,
    /rb\.gy\/[^\s]+/gi,
    /cutt\.ly\/[^\s]+/gi,
    /shorturl\.at\/[^\s]+/gi,
    /[a-zA-Z0-9-]+\.(com|in|org|net|info|biz|xyz|top|click|link|online|site|club)\b/gi,
];

// Short link domains (suspicious)
const SHORT_LINK_DOMAINS = [
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd',
    'rb.gy', 'cutt.ly', 'shorturl.at', 'ow.ly', 'buff.ly',
];

// Personal info request patterns
const PERSONAL_INFO_PATTERNS = [
    /send (?:your|ur) (?:otp|password|pin|cvv|account)/i,
    /share (?:your|ur) (?:otp|password|pin|cvv|account)/i,
    /enter (?:your|ur) (?:otp|password|pin|cvv|account)/i,
    /(?:bank|account|card) (?:number|no|details)/i,
    /(?:ssn|social security|pan|aadhaar|aadhar)/i,
    /(?:username|user id|userid) (?:and|&) (?:password|pass)/i,
];

// Callback number patterns
const CALLBACK_PATTERNS = [
    /call (?:us|me|back|now|on|at)\s*:?\s*[\d\-\+\(\)\s]{7,}/i,
    /contact\s*:?\s*[\d\-\+\(\)\s]{7,}/i,
    /whatsapp\s*:?\s*[\d\-\+\(\)\s]{7,}/i,
    /dial\s*:?\s*[\d\-\+\(\)\s]{7,}/i,
];

/**
 * Analyze a message for spam indicators.
 * @param {string} body - SMS message body
 * @param {string} sender - Sender phone number
 * @returns {object} { isSpam, confidence, score, reasons[] }
 */
export function analyzeMessage(body, sender) {
    if (!body || body.trim().length === 0) {
        return { isSpam: false, confidence: 'safe', score: 0, reasons: [] };
    }

    const reasons = [];
    let score = 0;
    const lowerBody = body.toLowerCase();

    // 1. Check for spam keywords
    const foundKeywords = SPAM_KEYWORDS.filter(kw => lowerBody.includes(kw));
    if (foundKeywords.length > 0) {
        score += Math.min(foundKeywords.length * 15, 40);
        reasons.push(`Spam keywords: ${foundKeywords.slice(0, 3).join(', ')}`);
    }

    // 2. Check for URLs/links
    const urlMatches = [];
    URL_PATTERNS.forEach(pattern => {
        const matches = body.match(pattern);
        if (matches) urlMatches.push(...matches);
    });
    if (urlMatches.length > 0) {
        score += 20;
        reasons.push(`Contains ${urlMatches.length} link(s)`);

        // Extra score for short/suspicious links
        const hasShortLink = urlMatches.some(url =>
            SHORT_LINK_DOMAINS.some(domain => url.toLowerCase().includes(domain))
        );
        if (hasShortLink) {
            score += 15;
            reasons.push('Contains shortened/suspicious link');
        }
    }

    // 3. Check for ALL CAPS text
    const words = body.split(/\s+/).filter(w => w.length > 2);
    const capsWords = words.filter(w => w === w.toUpperCase() && /[A-Z]/.test(w));
    const capsRatio = words.length > 0 ? capsWords.length / words.length : 0;
    if (capsRatio > 0.5 && words.length > 3) {
        score += 15;
        reasons.push('Excessive ALL CAPS text');
    }

    // 4. Check for personal info requests
    const asksPersonalInfo = PERSONAL_INFO_PATTERNS.some(p => p.test(body));
    if (asksPersonalInfo) {
        score += 30;
        reasons.push('Asks for personal/financial information');
    }

    // 5. Check for callback numbers
    const hasCallback = CALLBACK_PATTERNS.some(p => p.test(body));
    if (hasCallback) {
        score += 10;
        reasons.push('Contains callback number');
    }

    // 6. Check sender — alphanumeric senders from unknown sources
    if (sender && !/^\+?\d{10,}$/.test(sender)) {
        // Alphanumeric sender ID (e.g., VM-HDFCBK) — less suspicious for banks
        const knownPrefixes = ['AD-', 'VM-', 'BZ-', 'DM-', 'TD-', 'JD-'];
        const isTransactional = knownPrefixes.some(p => sender.toUpperCase().startsWith(p));
        if (!isTransactional) {
            score += 5;
            reasons.push('Unknown sender ID format');
        }
    }

    // 7. Check message length — very short with links is suspicious
    if (body.length < 50 && urlMatches.length > 0) {
        score += 10;
        reasons.push('Short message with link');
    }

    // Clamp score
    score = Math.min(score, 100);

    // Determine confidence level
    let confidence;
    let isSpam;
    if (score >= 60) {
        confidence = 'high';
        isSpam = true;
    } else if (score >= 30) {
        confidence = 'medium';
        isSpam = true;
    } else if (score >= 15) {
        confidence = 'low';
        isSpam = false;
    } else {
        confidence = 'safe';
        isSpam = false;
    }

    return { isSpam, confidence, score, reasons };
}

/**
 * Check if a number has been reported as spam in Firebase.
 * @param {string} phoneNumber
 * @returns {object} { reported, reportCount }
 */
export async function checkFirebaseSpamDB(phoneNumber) {
    try {
        if (!db) return { reported: false, reportCount: 0 };

        const spamRef = collection(db, 'spamReports');
        const q = query(spamRef, where('number', '==', phoneNumber));
        const snapshot = await getDocs(q);

        return {
            reported: !snapshot.empty,
            reportCount: snapshot.size,
        };
    } catch (error) {
        console.error('Firebase spam check error:', error);
        return { reported: false, reportCount: 0 };
    }
}

/**
 * Full analysis: local patterns + Firebase lookup.
 */
export async function fullAnalysis(body, sender) {
    const localResult = analyzeMessage(body, sender);

    // Check Firebase for known spam numbers
    const firebaseResult = await checkFirebaseSpamDB(sender);
    if (firebaseResult.reported) {
        localResult.score = Math.min(localResult.score + 25, 100);
        localResult.reasons.push(
            `Reported ${firebaseResult.reportCount}x by community`
        );
        if (localResult.score >= 60) {
            localResult.confidence = 'high';
            localResult.isSpam = true;
        } else if (localResult.score >= 30) {
            localResult.confidence = 'medium';
            localResult.isSpam = true;
        }
    }

    return localResult;
}
