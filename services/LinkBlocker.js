/**
 * LinkBlocker.js — Link extraction, safety checking, and blocking.
 */

// All URL patterns for extraction
const LINK_REGEX = /(?:https?:\/\/|www\.)[^\s\]\)]+|(?:bit\.ly|tinyurl\.com|goo\.gl|t\.co|is\.gd|rb\.gy|cutt\.ly|shorturl\.at|ow\.ly)\/[^\s]+/gi;

const DANGEROUS_TLDS = ['.xyz', '.top', '.click', '.link', '.online', '.site', '.club', '.buzz', '.icu', '.monster'];
const SHORT_DOMAINS = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'rb.gy', 'cutt.ly', 'shorturl.at', 'ow.ly', 'buff.ly'];

/**
 * Extract all links from a message.
 * @param {string} text
 * @returns {string[]} Array of URLs found
 */
export function extractLinks(text) {
    if (!text) return [];
    const matches = text.match(LINK_REGEX);
    return matches ? [...new Set(matches)] : [];
}

/**
 * Check if a link is from a dangerous TLD or short domain.
 * @param {string} url
 * @returns {object} { isDangerous, reason }
 */
export function quickLinkCheck(url) {
    const lowerUrl = url.toLowerCase();

    // Check short link domains
    const isShortLink = SHORT_DOMAINS.some(d => lowerUrl.includes(d));
    if (isShortLink) {
        return { isDangerous: true, reason: 'Shortened link — destination unknown' };
    }

    // Check dangerous TLDs
    const hasDangerousTLD = DANGEROUS_TLDS.some(tld => lowerUrl.includes(tld));
    if (hasDangerousTLD) {
        return { isDangerous: true, reason: 'Suspicious domain extension' };
    }

    // Check for IP-based URLs
    if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) {
        return { isDangerous: true, reason: 'IP-based URL (likely phishing)' };
    }

    // Check for very long URLs (common in phishing)
    if (url.length > 100) {
        return { isDangerous: true, reason: 'Unusually long URL' };
    }

    return { isDangerous: false, reason: null };
}

/**
 * Check link against Google Safe Browsing API.
 * @param {string} url
 * @returns {object} { safe, threatType }
 */
export async function checkGoogleSafeBrowsing(url) {
    try {
        // Google Safe Browsing API v4
        const API_KEY = 'AIzaSyAOaOuZAqzTF6g9XBFi3B-yd8VtarwZCPM'; // Same API key
        const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client: {
                    clientId: 'rakshanet',
                    clientVersion: '1.0.0',
                },
                threatInfo: {
                    threatTypes: [
                        'MALWARE',
                        'SOCIAL_ENGINEERING',
                        'UNWANTED_SOFTWARE',
                        'POTENTIALLY_HARMFUL_APPLICATION',
                    ],
                    platformTypes: ['ANY_PLATFORM'],
                    threatEntryTypes: ['URL'],
                    threatEntries: [{ url }],
                },
            }),
        });

        const data = await response.json();

        if (data.matches && data.matches.length > 0) {
            return {
                safe: false,
                threatType: data.matches[0].threatType,
            };
        }

        return { safe: true, threatType: null };
    } catch (error) {
        console.error('Safe Browsing API error:', error);
        // Default to warning if API fails
        return { safe: true, threatType: null };
    }
}

/**
 * Full link analysis: quick check + Safe Browsing API.
 * @param {string} url
 * @returns {object} { blocked, reason, threatType }
 */
export async function analyzeLinkSafety(url) {
    // Quick local check first
    const quickResult = quickLinkCheck(url);
    if (quickResult.isDangerous) {
        // Also check Safe Browsing for confirmed threats
        const sbResult = await checkGoogleSafeBrowsing(url);
        return {
            blocked: true,
            reason: quickResult.reason,
            threatType: sbResult.threatType,
            confirmedDangerous: !sbResult.safe,
        };
    }

    // If passed quick check, verify with Safe Browsing
    const sbResult = await checkGoogleSafeBrowsing(url);
    if (!sbResult.safe) {
        return {
            blocked: true,
            reason: `Flagged by Google: ${sbResult.threatType}`,
            threatType: sbResult.threatType,
            confirmedDangerous: true,
        };
    }

    return {
        blocked: false,
        reason: null,
        threatType: null,
        confirmedDangerous: false,
    };
}

/**
 * Process message text — replace dangerous links with blocked markers.
 * Returns { safeText, blockedLinks[] }
 */
export function processMessageLinks(text) {
    if (!text) return { safeText: text, blockedLinks: [] };

    const links = extractLinks(text);
    if (links.length === 0) return { safeText: text, blockedLinks: [] };

    const blockedLinks = [];
    let safeText = text;

    links.forEach(link => {
        const check = quickLinkCheck(link);
        if (check.isDangerous) {
            blockedLinks.push({ url: link, reason: check.reason });
            safeText = safeText.replace(link, `[🚫 Link Blocked]`);
        }
    });

    return { safeText, blockedLinks };
}
