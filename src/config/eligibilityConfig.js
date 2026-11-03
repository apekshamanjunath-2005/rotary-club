/**
 * Rotary Club of Honavar - Membership Eligibility & Application Settings
 * Configurable criteria to support club governance, bylaws, and committee review
 */
module.exports = {
    MEMBERSHIP_ELIGIBILITY: {
        MIN_AGE: 18,
        REQUIRE_TASK_WILLINGNESS: true,
        MIN_PASSWORD_LENGTH: 6,
        ALLOWED_STATUSES: ['PENDING', 'APPROVED', 'REJECTED'],
        // Set to an array of strings if certain professions are restricted; null means all occupations are eligible
        RESTRICTED_PROFESSIONS: null
    }
};

