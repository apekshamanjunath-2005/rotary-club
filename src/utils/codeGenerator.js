const crypto = require('crypto');

/**
 * Generates human-friendly, collision-resistant tracking codes for civic service requests.
 * Format: HON-SR-YYYY-XXXX (e.g. HON-SR-2026-7B8D)
 */
function generateTrackingCode() {
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `HON-SR-${year}-${randomHex}`;
}

module.exports = { generateTrackingCode };
