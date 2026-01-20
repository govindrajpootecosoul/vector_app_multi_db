/**
 * Date Helper Utility
 * Handles date logic for 'current month', 'previous month', and 'current year'
 * Based on today's date: 2026-01-07
 */

const REFERENCE_DATE = new Date('2026-01-07T00:00:00.000Z');

/**
 * Get the reference date (2026-01-07)
 * @returns {Date} Reference date
 */
const getReferenceDate = () => {
  return new Date(REFERENCE_DATE);
};

/**
 * Get current month date range
 * @returns {{startDate: Date, endDate: Date}} Current month start and end dates
 */
const getCurrentMonth = () => {
  const today = getReferenceDate();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth(); // 0-based (January = 0)
  
  const startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
  const endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
  
  return { startDate, endDate };
};

/**
 * Get previous month date range
 * @returns {{startDate: Date, endDate: Date}} Previous month start and end dates
 */
const getPreviousMonth = () => {
  const today = getReferenceDate();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth();
  
  // Previous month
  const prevMonth = currentMonth - 1;
  const prevYear = prevMonth < 0 ? currentYear - 1 : currentYear;
  const adjustedPrevMonth = prevMonth < 0 ? 11 : prevMonth; // December = 11
  
  const startDate = new Date(Date.UTC(prevYear, adjustedPrevMonth, 1));
  const endDate = new Date(Date.UTC(prevYear, adjustedPrevMonth + 1, 0, 23, 59, 59, 999));
  
  return { startDate, endDate };
};

/**
 * Get current year date range (year to date)
 * @returns {{startDate: Date, endDate: Date}} Current year start and end dates
 */
const getCurrentYear = () => {
  const today = getReferenceDate();
  const currentYear = today.getUTCFullYear();
  
  const startDate = new Date(Date.UTC(currentYear, 0, 1)); // January 1st
  const endDate = new Date(today); // Up to today
  
  return { startDate, endDate };
};

/**
 * Get last year date range
 * @returns {{startDate: Date, endDate: Date}} Last year start and end dates
 */
const getLastYear = () => {
  const today = getReferenceDate();
  const currentYear = today.getUTCFullYear();
  const lastYear = currentYear - 1;
  
  const startDate = new Date(Date.UTC(lastYear, 0, 1)); // January 1st
  const endDate = new Date(Date.UTC(lastYear, 11, 31, 23, 59, 59, 999)); // December 31st
  
  return { startDate, endDate };
};

/**
 * Convert date range to filterType format
 * @param {string} filterType - 'currentmonth', 'previousmonth', 'currentyear', 'lastyear'
 * @returns {{startDate: Date, endDate: Date}} Date range
 */
const getDateRangeFromFilterType = (filterType) => {
  const normalized = filterType?.toLowerCase();
  
  switch (normalized) {
    case 'currentmonth':
      return getCurrentMonth();
    case 'previousmonth':
      return getPreviousMonth();
    case 'currentyear':
      return getCurrentYear();
    case 'lastyear':
      return getLastYear();
    default:
      // Default to previous month
      return getPreviousMonth();
  }
};

/**
 * Format date to YYYY-MM-DD string
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  if (!date) return null;
  return date.toISOString().split('T')[0];
};

/**
 * Format date to YYYY-MM string (for year_month format)
 * @param {Date} date - Date object
 * @returns {string} Formatted year-month string
 */
const formatYearMonth = (date) => {
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Get current year-month string
 * @returns {string} Current year-month in YYYY-MM format
 */
const getCurrentYearMonth = () => {
  const today = getReferenceDate();
  return formatYearMonth(today);
};

/**
 * Get previous year-month string
 * @returns {string} Previous year-month in YYYY-MM format
 */
const getPreviousYearMonth = () => {
  const { startDate } = getPreviousMonth();
  return formatYearMonth(startDate);
};

/**
 * Get current year number
 * @returns {number} Current year
 */
const getCurrentYearNumber = () => {
  return getReferenceDate().getUTCFullYear();
};

module.exports = {
  getReferenceDate,
  getCurrentMonth,
  getPreviousMonth,
  getCurrentYear,
  getCurrentYearNumber,
  getLastYear,
  getDateRangeFromFilterType,
  formatDate,
  formatYearMonth,
  getCurrentYearMonth,
  getPreviousYearMonth
};

