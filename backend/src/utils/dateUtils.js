/**
 * Date utility to handle timezone consistency.
 * Standardizes on the business date (YYYY-MM-DD string).
 */

const getBusinessDate = (date = new Date()) => {
    // Returns YYYY-MM-DD in +06:00 timezone (or local if configured)
    // For now, we adjust by 6 hours manually if we want to force it, 
    // or just use a more robust way.

    // Simplest way to get YYYY-MM-DD for a specific offset in Node:
    const offsetDate = new Date(date.getTime() + (6 * 60 * 60 * 1000));
    return offsetDate.toISOString().split('T')[0];
};

const getStartOfDay = (dateStr) => {
    // Assuming dateStr is YYYY-MM-DD
    // If we want to match the +06:00 perception:
    // Feb 2nd 00:00 +06:00 is Feb 1st 18:00 UTC.
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCHours(date.getUTCHours() - 6);
    return date;
};

const getEndOfDay = (dateStr) => {
    const date = new Date(dateStr + 'T23:59:59.999Z');
    date.setUTCHours(date.getUTCHours() - 6);
    return date;
};

module.exports = {
    getBusinessDate,
    getStartOfDay,
    getEndOfDay
};
