/**
 * ScamChecker.js — Number pattern analysis + message content scanning
 * for the manual Scam Scanner feature.
 */

// ── Spam Trigger Words ──
const SPAM_WORDS = [
    'won', 'prize', 'lottery', 'click here', 'verify now',
    'kyc', 'expire', 'urgent', 'free', 'winner', 'claim',
    'reward', 'otp', 'bank account', 'limited time',
    'congratulations', 'selected', 'lucky', 'gift',
    'transfer', 'neft', 'imps', 'upi fraud',
    'act now', 'hurry', 'last chance', 'final notice',
    'suspended', 'blocked', 'deactivated', 'reactivate',
    'pan card', 'aadhaar', 'aadhar', 'income tax', 'refund',
    'cashback', 'coupon', 'voucher', 'investment', 'trading',
    'crypto', 'bitcoin', 'earn money', 'work from home',
    'part time job', 'loan approved', 'credit card',
    'verification required', 'update immediately',
];

// ── Personal Info Patterns ──
const PERSONAL_INFO_PATTERNS = [
    /send\s+(?:your|ur)\s+(?:otp|password|pin|cvv|account)/i,
    /share\s+(?:your|ur)\s+(?:otp|password|pin|cvv|account)/i,
    /enter\s+(?:your|ur)\s+(?:otp|password|pin|cvv|account)/i,
    /(?:bank|account|card)\s+(?:number|no|details)/i,
    /(?:ssn|social\s+security|pan|aadhaar|aadhar)/i,
    /(?:username|user\s+id)\s+(?:and|&)\s+(?:password)/i,
    /(?:atm|debit|credit)\s+(?:card|pin)/i,
    /(?:upi|net\s+banking)\s+(?:pin|password|id)/i,
];

// ── Urgency Language ──
const URGENCY_PATTERNS = [
    /within\s+\d+\s+(?:hour|minute|day)/i,
    /expir(?:e|es|ing|ed)\s+(?:today|soon|in)/i,
    /last\s+(?:chance|warning|notice|reminder)/i,
    /immediate(?:ly)?\s+(?:action|attention)/i,
    /account\s+(?:will\s+be|has\s+been)\s+(?:blocked|suspended|closed)/i,
    /(?:act|respond|reply|click)\s+(?:now|immediately|asap)/i,
    /failure\s+to\s+(?:respond|comply|verify)/i,
];

// ── Link Patterns ──
const LINK_REGEX = /(?:https?:\/\/|www\.)[^\s]+|(?:bit\.ly|tinyurl\.com|goo\.gl|t\.co|is\.gd|rb\.gy|cutt\.ly|shorturl\.at)\/[^\s]+/gi;
const SHORT_DOMAINS = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'rb.gy', 'cutt.ly', 'shorturl.at', 'ow.ly'];
const DANGEROUS_TLDS = ['.xyz', '.top', '.click', '.link', '.online', '.site', '.club', '.buzz', '.icu'];

// ── Known Spam Prefixes (India) ──
const SPAM_PREFIXES = ['140', '141', '142', '143'];
const TRANSACTIONAL_PREFIXES = ['160', '161', '162', '163'];

/**
 * Analyze a phone number for scam indicators.
 * @param {string} number - Phone number to analyze
 * @returns {{ score: number, reasons: string[], category: string }}
 */
export function analyzeNumber(number) {
    if (!number || number.trim().length === 0) {
        return { score: 0, reasons: [], category: 'unknown' };
    }

    const clean = number.replace(/[\s\-\(\)\+]/g, '');
    const reasons = [];
    let score = 0;

    // Check spam prefixes (140-143 = promotional/spam in India)
    if (SPAM_PREFIXES.some(p => clean.startsWith(p))) {
        score += 40;
        reasons.push('Number starts with known spam prefix (140-143)');
    }

    // Check transactional prefixes
    if (TRANSACTIONAL_PREFIXES.some(p => clean.startsWith(p))) {
        score += 10;
        reasons.push('Transactional number (160-163) — usually legitimate');
    }

    // Unknown international codes (not India +91)
    if (clean.startsWith('91') === false && clean.length > 10) {
        const countryCode = clean.substring(0, 2);
        const suspiciousCodes = ['44', '81', '86', '234', '233', '237'];
        if (suspiciousCodes.some(c => clean.startsWith(c))) {
            score += 30;
            reasons.push('Suspicious international country code');
        } else if (!clean.startsWith('91')) {
            score += 15;
            reasons.push('International number — exercise caution');
        }
    }

    // Very short numbers (potential premium rate)
    if (clean.length >= 4 && clean.length <= 6) {
        score += 20;
        reasons.push('Short code number — could be premium rate');
    }

    // Alphanumeric senders
    if (/[a-zA-Z]/.test(number) && !/^\+/.test(number)) {
        score += 5;
        reasons.push('Alphanumeric sender ID');
    }

    const category = score >= 60 ? 'scam' : score >= 30 ? 'suspicious' : 'safe';
    return { score: Math.min(score, 100), reasons, category };
}

/**
 * Analyze a message text for scam indicators.
 * @param {string} message - Message text to analyze
 * @returns {{ score: number, reasons: string[], triggers: string[], category: string }}
 */
export function analyzeMessage(message) {
    if (!message || message.trim().length === 0) {
        return { score: 0, reasons: [], triggers: [], category: 'unknown' };
    }

    const lower = message.toLowerCase();
    const reasons = [];
    const triggers = [];
    let score = 0;

    // 1. Check spam trigger words
    const foundWords = SPAM_WORDS.filter(w => lower.includes(w));
    if (foundWords.length > 0) {
        const wordScore = Math.min(foundWords.length * 12, 45);
        score += wordScore;
        triggers.push(...foundWords);
        reasons.push(`${foundWords.length} spam keyword(s): ${foundWords.slice(0, 4).join(', ')}`);
    }

    // 2. Check for links
    const links = message.match(LINK_REGEX) || [];
    if (links.length > 0) {
        score += 15;
        reasons.push(`Contains ${links.length} link(s)`);

        // Check for short/suspicious links
        const hasShortLink = links.some(url =>
            SHORT_DOMAINS.some(d => url.toLowerCase().includes(d))
        );
        if (hasShortLink) {
            score += 15;
            triggers.push('shortened link');
            reasons.push('Contains shortened/suspicious link');
        }

        // Check dangerous TLDs
        const hasBadTLD = links.some(url =>
            DANGEROUS_TLDS.some(tld => url.toLowerCase().includes(tld))
        );
        if (hasBadTLD) {
            score += 10;
            triggers.push('suspicious domain');
            reasons.push('Link uses suspicious domain extension');
        }
    }

    // 3. Personal info requests
    const asksInfo = PERSONAL_INFO_PATTERNS.some(p => p.test(message));
    if (asksInfo) {
        score += 25;
        triggers.push('personal info request');
        reasons.push('Asks for personal/financial information');
    }

    // 4. ALL CAPS check
    const words = message.split(/\s+/).filter(w => w.length > 2);
    const capsWords = words.filter(w => w === w.toUpperCase() && /[A-Z]/.test(w));
    if (words.length > 3 && capsWords.length / words.length > 0.5) {
        score += 10;
        triggers.push('ALL CAPS');
        reasons.push('Excessive use of ALL CAPS');
    }

    // 5. Urgency language
    const hasUrgency = URGENCY_PATTERNS.some(p => p.test(message));
    if (hasUrgency) {
        score += 15;
        triggers.push('urgency language');
        reasons.push('Contains urgency/pressure language');
    }

    // 6. Short message with link = suspicious
    if (message.length < 60 && links.length > 0) {
        score += 8;
        reasons.push('Short message with link — suspicious pattern');
    }

    // 7. Money amounts mentioned
    if (/₹\s*[\d,]+|rs\.?\s*[\d,]+|\$\s*[\d,]+/i.test(message)) {
        score += 8;
        triggers.push('money amount');
        reasons.push('Contains monetary amounts');
    }

    score = Math.min(score, 100);
    const category = score >= 70 ? 'scam' : score >= 31 ? 'suspicious' : 'safe';

    return { score, reasons, triggers, category };
}

/**
 * Full scan — combines number and message analysis.
 */
export function fullScan(input, type = 'number') {
    if (type === 'number') {
        return analyzeNumber(input);
    } else {
        return analyzeMessage(input);
    }
}
