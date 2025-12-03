const sql = require('mssql');
const https = require('https');
const logger = require('../utils/logger');
const { getConnection } = require('../utils/database');

const FRANKFURTER_API_BASE = 'https://api.frankfurter.dev';
const supportedCurrencies = new Set(['USD', 'GBP', 'EUR']);
const exchangeRateCache = new Map();
const countryCurrencyFallback = {
  UK: 'GBP',
  DE: 'EUR',
  US: 'USD',
};

const buildDateFromYearMonth = (yearMonth) => {
  if (!yearMonth || typeof yearMonth !== 'string') {
    throw new Error('Invalid yearMonth format');
  }
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new Error(`Invalid yearMonth value: ${yearMonth}`);
  }
  return `${year}-${month.toString().padStart(2, '0')}-01`;
};

const frankfurterRequest = (path) => {
  const url = `${FRANKFURTER_API_BASE}${path}`;
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse Frankfurter response: ${error.message}`));
          }
        } else {
          reject(new Error(`Frankfurter API error (${res.statusCode}): ${data}`));
        }
      });
    });
    request.on('error', (error) => reject(error));
    request.setTimeout(5000, () => {
      request.destroy(new Error('Frankfurter API request timed out'));
    });
  });
};

const fetchFrankfurterRates = async (currency, yearMonth) => {
  if (currency === 'USD') {
    return { rates: { USD: 1 } };
  }

  const date = buildDateFromYearMonth(yearMonth);
  const paths = [
    `/latest?from=${currency}&to=USD&date=${date}`,
    `/${date}?from=${currency}&to=USD`,
    `/v1/${date}?from=${currency}&to=USD`,
  ];

  let lastError = null;
  for (const path of paths) {
    try {
      return await frankfurterRequest(path);
    } catch (error) {
      lastError = error;
      logger.warn(`Frankfurter request failed for ${path}: ${error.message}`);
    }
  }

  throw lastError || new Error('Unable to fetch exchange rate');
};

const getExchangeRate = async (currency, yearMonth) => {
  if (!currency) {
    throw new Error('Currency is required for FX conversion');
  }

  const normalizedCurrency = currency.toUpperCase();
  if (!supportedCurrencies.has(normalizedCurrency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  if (normalizedCurrency === 'USD') {
    return 1;
  }

  const cacheKey = `${normalizedCurrency}-${yearMonth}`;
  if (exchangeRateCache.has(cacheKey)) {
    return exchangeRateCache.get(cacheKey);
  }

  const response = await fetchFrankfurterRates(normalizedCurrency, yearMonth);
  const rate = response?.rates?.USD;
  if (!rate) {
    throw new Error(`USD rate missing for ${currency} ${yearMonth}`);
  }

  exchangeRateCache.set(cacheKey, rate);
  return rate;
};

const convertBreakdownToUSD = async (breakdown) => {
  const totals = { totalAdSales: 0, totalAdSpend: 0, totalRevenue: 0 };

  for (const countryKey of Object.keys(breakdown || {})) {
    const entries = breakdown[countryKey];
    const currency = (countryCurrencyFallback[countryKey?.toUpperCase()] || 'USD').toUpperCase();

    for (const entry of entries) {
      const yearMonth = entry.yearMonth || (entry.date ? entry.date.slice(0, 7) : null);
      let rate = 1;
      try {
        if (yearMonth) {
          rate = await getExchangeRate(currency, yearMonth);
        }
      } catch (error) {
        logger.error(`FX conversion failed for ${countryKey} (${yearMonth}): ${error.message}`);
        rate = 1;
      }

      entry.totalAdSalesUSD = Number((entry.totalAdSales * rate).toFixed(2));
      entry.totalAdSpendUSD = Number((entry.totalAdSpend * rate).toFixed(2));
      entry.totalRevenueUSD = Number((entry.totalRevenue * rate).toFixed(2));

      totals.totalAdSales += entry.totalAdSalesUSD;
      totals.totalAdSpend += entry.totalAdSpendUSD;
      totals.totalRevenue += entry.totalRevenueUSD;
    }
  }

  totals.totalAdSales = Number(totals.totalAdSales.toFixed(2));
  totals.totalAdSpend = Number(totals.totalAdSpend.toFixed(2));
  totals.totalRevenue = Number(totals.totalRevenue.toFixed(2));

  return { breakdown, totals };
};

exports.getAdSalesAdSpendByDatabase = async (req, res) => {
  try {
    const {
      platform,
      country,
      filterType,
      startMonth,
      endMonth,
      fromDate,
      toDate,
      sku
    } = req.query;

    // Get database name from token
    let databaseName = req.user?.databaseName || req.databaseName;
    if (!databaseName) {
      return res.status(400).json({
        success: false,
        error: 'Database name not found in token',
        message: 'Please ensure your JWT token contains the databaseName field.'
      });
    }
    req.databaseName = databaseName;

    const allowDateSkip = req.skipAdSalesDateRange === true;
    const groupByCountryDates = req.groupAdSalesByCountryDates === true;

    if (!allowDateSkip && !filterType) {
      return res.status(400).json({
        status: 400,
        error: {
          code: "BAD_REQUEST",
          message: "filterType is required",
          details: "Provide a valid filterType query parameter or body field."
        },
        timestamp: new Date().toISOString()
      });
    }

    const pool = await getConnection(req);

    const today = new Date();
    console.log('Today\'s date:', today.toISOString());
    const query = {};

    let currentStartMonth, currentEndMonth;
    let previousStartMonth, previousEndMonth;

    // Use UTC for consistent date handling
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth() + 1; // 1-based for year_month

    // Helper function to parse MM-YYYY format
    const parseMonthYear = (monthYearStr) => {
      if (!monthYearStr || !monthYearStr.includes('-')) return null;
      const [month, year] = monthYearStr.split('-').map(s => parseInt(s.trim()));
      if (isNaN(month) || isNaN(year) || month < 1 || month > 12) return null;
      return { month, year };
    };

    // Filter ranges
    if (startMonth && endMonth) {
      // Custom range: MM-YYYY to MM-YYYY
      const startParsed = parseMonthYear(startMonth);
      const endParsed = parseMonthYear(endMonth);

      if (startParsed && endParsed) {
        currentStartMonth = startParsed;
        currentEndMonth = endParsed;

        // Calculate previous period with same duration
        const startDate = new Date(Date.UTC(startParsed.year, startParsed.month - 1, 1));
        const endDate = new Date(Date.UTC(endParsed.year, endParsed.month - 1, 1));
        const durationMonths = (endParsed.year - startParsed.year) * 12 + (endParsed.month - startParsed.month) + 1;
        previousEndMonth = { year: startDate.getUTCFullYear(), month: startDate.getUTCMonth() + 1 };
        const prevStartDate = new Date(Date.UTC(previousEndMonth.year, previousEndMonth.month - durationMonths, 1));
        previousStartMonth = { year: prevStartDate.getUTCFullYear(), month: prevStartDate.getUTCMonth() + 1 };
      } else {
        // Invalid format, fallback to current month
        currentStartMonth = { year: currentYear, month: currentMonth };
        currentEndMonth = { year: currentYear, month: currentMonth };
        const prevMonth = currentMonth - 1;
        const prevYear = prevMonth < 1 ? currentYear - 1 : currentYear;
        const adjustedPrevMonth = prevMonth < 1 ? 12 : prevMonth;
        previousStartMonth = { year: prevYear, month: adjustedPrevMonth };
        previousEndMonth = { year: prevYear, month: adjustedPrevMonth };
      }
    } else if (fromDate && toDate) {
      // Direct date range: convert to month range
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      currentStartMonth = { year: startDate.getUTCFullYear(), month: startDate.getUTCMonth() + 1 };
      currentEndMonth = { year: endDate.getUTCFullYear(), month: endDate.getUTCMonth() + 1 };

      // Calculate previous period with same duration
      const durationMonths = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (endDate.getUTCMonth() - startDate.getUTCMonth()) + 1;
      const prevEndDate = new Date(startDate.getTime() - 86400000); // day before start
      previousEndMonth = { year: prevEndDate.getUTCFullYear(), month: prevEndDate.getUTCMonth() + 1 };
      const prevStartDate = new Date(prevEndDate.getTime() - (durationMonths - 1) * 30 * 24 * 60 * 60 * 1000); // approximate
      previousStartMonth = { year: prevStartDate.getUTCFullYear(), month: prevStartDate.getUTCMonth() + 1 };
    } else if (allowDateSkip && !filterType) {
      // For Executiveall without filterType, allow all data without date filtering
      currentStartMonth = null;
      currentEndMonth = null;
      previousStartMonth = null;
      previousEndMonth = null;
    } else {
    switch (filterType) {
      case "currentmonth": {
        currentStartMonth = { year: currentYear, month: currentMonth };
        currentEndMonth = { year: currentYear, month: currentMonth };

        const prevMonth = currentMonth - 1;
        const prevYear = prevMonth < 1 ? currentYear - 1 : currentYear;
        const adjustedPrevMonth = prevMonth < 1 ? 12 : prevMonth;
        previousStartMonth = { year: prevYear, month: adjustedPrevMonth };
        previousEndMonth = { year: prevYear, month: adjustedPrevMonth };
        break;
      }
      case "previousmonth": {
        const prevMonth = currentMonth - 1;
        const prevYear = prevMonth < 1 ? currentYear - 1 : currentYear;
        const adjustedPrevMonth = prevMonth < 1 ? 12 : prevMonth;
        currentStartMonth = { year: prevYear, month: adjustedPrevMonth };
        currentEndMonth = { year: prevYear, month: adjustedPrevMonth };

        const monthBeforeLast = adjustedPrevMonth - 1;
        const yearBeforeLast = monthBeforeLast < 1 ? prevYear - 1 : prevYear;
        const adjustedMonthBeforeLast = monthBeforeLast < 1 ? 12 : monthBeforeLast;
        previousStartMonth = { year: yearBeforeLast, month: adjustedMonthBeforeLast };
        previousEndMonth = { year: yearBeforeLast, month: adjustedMonthBeforeLast };
        break;
      }
      case "currentyear": {
        currentStartMonth = { year: currentYear, month: 1 };
        currentEndMonth = { year: currentYear, month: 12 };

        previousStartMonth = { year: currentYear - 1, month: 1 };
        previousEndMonth = { year: currentYear - 1, month: 12 };
        break;
      }
      case "lastyear": {
        currentStartMonth = { year: currentYear - 1, month: 1 };
        currentEndMonth = { year: currentYear - 1, month: 12 };

        previousStartMonth = { year: currentYear - 2, month: 1 };
        previousEndMonth = { year: currentYear - 2, month: 12 };
        break;
      }
      case "customrange": {
        if (!fromDate || !toDate) {
          return res.status(400).json({
            status: 400,
            error: {
              code: "BAD_REQUEST",
              message: "fromDate and toDate are required for customrange",
              details: "Provide fromDate and toDate in YYYY-MM-DD format."
            },
            timestamp: new Date().toISOString()
          });
        }
        // Convert to month range
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        currentStartMonth = { year: startDate.getUTCFullYear(), month: startDate.getUTCMonth() + 1 };
        currentEndMonth = { year: endDate.getUTCFullYear(), month: endDate.getUTCMonth() + 1 };

        // Calculate previous period with same duration
        const durationMonths = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (endDate.getUTCMonth() - startDate.getUTCMonth()) + 1;
        const prevEndDate = new Date(startDate.getTime() - 86400000); // day before start
        previousEndMonth = { year: prevEndDate.getUTCFullYear(), month: prevEndDate.getUTCMonth() + 1 };
        const prevStartDate = new Date(prevEndDate.getTime() - (durationMonths - 1) * 30 * 24 * 60 * 60 * 1000); // approximate
        previousStartMonth = { year: prevStartDate.getUTCFullYear(), month: prevStartDate.getUTCMonth() + 1 };
        break;
      }
      case "6months":
      default: {
        return res.status(400).json({
          status: 400,
          error: {
            code: "BAD_REQUEST",
            message: `Invalid filterType: ${filterType}`,
            details: "Provide a valid filterType such as currentmonth, previousmonth, currentyear, lastyear, or customrange."
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    }

    // Build WHERE conditions (removed client_id - each database is client-specific)
    let whereConditions = [];
    if (platform) whereConditions.push(`platform = '${platform}'`);
    if (country) whereConditions.push(`country LIKE '%${country}%'`);
    if (sku) whereConditions.push(`sku = '${sku}'`);

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';

    console.log('WHERE clause:', whereClause);
    console.log('Date range:', { currentStartMonth, currentEndMonth });

    // Helper to generate year_month strings for a range
    const generateMonthRange = (start, end) => {
      const months = [];
      let current = new Date(Date.UTC(start.year, start.month - 1, 1));
      const endDate = new Date(Date.UTC(end.year, end.month - 1, 1));
      while (current <= endDate) {
        const year = current.getUTCFullYear();
        const month = current.getUTCMonth() + 1;
        months.push(`${year}-${month.toString().padStart(2, '0')}`);
        current.setUTCMonth(current.getUTCMonth() + 1);
      }
      return months;
    };

    let currentMonths = [];
    let previousMonths = [];
    if (currentStartMonth && currentEndMonth) {
      currentMonths = generateMonthRange(currentStartMonth, currentEndMonth);
    }
    if (previousStartMonth && previousEndMonth) {
      previousMonths = generateMonthRange(previousStartMonth, previousEndMonth);
    }

    let current = { totalAdSales: 0, totalAdSpend: 0, totalRevenue: 0 };
    let previous = { totalAdSales: 0, totalAdSpend: 0, totalRevenue: 0 };
    let breakdown = {};
    let previousBreakdown = null;

    if (groupByCountryDates) {
      // Query grouped by country and year_month for Executiveall
      const monthCondition = currentMonths.length > 0 
        ? `AND year_month IN (${currentMonths.map(m => `'${m}'`).join(',')})`
        : '';
      const currentQuery = `
        SELECT
          ISNULL(country, 'Unknown') AS country,
          year_month,
          SUM(CAST(ad_sales AS FLOAT)) as totalAdSales,
          SUM(CAST(ad_spend AS FLOAT)) as totalAdSpend,
          SUM(CAST(total_gross_sales AS FLOAT)) as totalRevenue
        FROM std_ad_sales
        WHERE ${whereClause} ${monthCondition}
        GROUP BY ISNULL(country, 'Unknown'), year_month
        ORDER BY country, year_month
      `;

      const currentResult = await pool.request().query(currentQuery);
      
      currentResult.recordset.forEach(row => {
        const countryKey = row.country || 'Unknown';
        const yearMonth = row.year_month;
        const dateStr = yearMonth ? `${yearMonth}-01` : null;
        
        if (!breakdown[countryKey]) {
          breakdown[countryKey] = [];
        }

        const entry = {
          date: dateStr,
          yearMonth: yearMonth,
          totalAdSales: parseFloat(row.totalAdSales) || 0,
          totalAdSpend: parseFloat(row.totalAdSpend) || 0,
          totalRevenue: parseFloat(row.totalRevenue) || 0,
        };

        breakdown[countryKey].push(entry);
        current.totalAdSales += entry.totalAdSales;
        current.totalAdSpend += entry.totalAdSpend;
        current.totalRevenue += entry.totalRevenue;
      });

      // Sort by year_month within each country
      Object.keys(breakdown).forEach(countryKey => {
        breakdown[countryKey].sort((a, b) => {
          if (!a.yearMonth || !b.yearMonth) return 0;
          return a.yearMonth.localeCompare(b.yearMonth);
        });
      });

      if (previousMonths.length > 0) {
        previousBreakdown = {};
        const previousMonthCondition = `AND year_month IN (${previousMonths.map(m => `'${m}'`).join(',')})`;
        const previousBreakdownQuery = `
          SELECT
            ISNULL(country, 'Unknown') AS country,
            year_month,
            SUM(CAST(ad_sales AS FLOAT)) as totalAdSales,
            SUM(CAST(ad_spend AS FLOAT)) as totalAdSpend,
            SUM(CAST(total_gross_sales AS FLOAT)) as totalRevenue
          FROM std_ad_sales
          WHERE ${whereClause} ${previousMonthCondition}
          GROUP BY ISNULL(country, 'Unknown'), year_month
          ORDER BY country, year_month
        `;

        const previousBreakdownResult = await pool.request().query(previousBreakdownQuery);
        previousBreakdownResult.recordset.forEach(row => {
          const countryKey = row.country || 'Unknown';
          const yearMonth = row.year_month;
          const dateStr = yearMonth ? `${yearMonth}-01` : null;

          if (!previousBreakdown[countryKey]) {
            previousBreakdown[countryKey] = [];
          }

          previousBreakdown[countryKey].push({
            date: dateStr,
            yearMonth,
            totalAdSales: parseFloat(row.totalAdSales) || 0,
            totalAdSpend: parseFloat(row.totalAdSpend) || 0,
            totalRevenue: parseFloat(row.totalRevenue) || 0,
          });
        });
      }
    } else {
      // Original query logic for regular API
      if (currentMonths.length > 0) {
        const currentMonthsList = currentMonths.map(m => `'${m}'`).join(',');
        const currentQuery = `
          SELECT
            SUM(CAST(ad_sales AS FLOAT)) as totalAdSales,
            SUM(CAST(ad_spend AS FLOAT)) as totalAdSpend,
            SUM(CAST(total_gross_sales AS FLOAT)) as totalRevenue
          FROM std_ad_sales
          WHERE ${whereClause} AND year_month IN (${currentMonthsList})
        `;

        const currentResult = await pool.request().query(currentQuery);
        current = currentResult.recordset[0] ? {
          totalAdSales: currentResult.recordset[0].totalAdSales || 0,
          totalAdSpend: currentResult.recordset[0].totalAdSpend || 0,
          totalRevenue: currentResult.recordset[0].totalRevenue || 0
        } : { totalAdSales: 0, totalAdSpend: 0, totalRevenue: 0 };
      }

      if (previousMonths.length > 0) {
        const previousMonthsList = previousMonths.map(m => `'${m}'`).join(',');
        const previousQuery = `
          SELECT
            SUM(CAST(ad_sales AS FLOAT)) as totalAdSales,
            SUM(CAST(ad_spend AS FLOAT)) as totalAdSpend,
            SUM(CAST(total_gross_sales AS FLOAT)) as totalRevenue
          FROM std_ad_sales
          WHERE ${whereClause} AND year_month IN (${previousMonthsList})
        `;

        const previousResult = await pool.request().query(previousQuery);
        previous = previousResult.recordset[0] ? {
          totalAdSales: previousResult.recordset[0].totalAdSales || 0,
          totalAdSpend: previousResult.recordset[0].totalAdSpend || 0,
          totalRevenue: previousResult.recordset[0].totalRevenue || 0
        } : { totalAdSales: 0, totalAdSpend: 0, totalRevenue: 0 };
      }
    }

    let currentUsdTotals = null;
    let previousUsdTotals = null;

    if (groupByCountryDates) {
      const currentConversion = await convertBreakdownToUSD(breakdown);
      breakdown = currentConversion.breakdown;
      currentUsdTotals = currentConversion.totals;

      if (previousBreakdown) {
        const previousConversion = await convertBreakdownToUSD(previousBreakdown);
        previousBreakdown = previousConversion.breakdown;
        previousUsdTotals = previousConversion.totals;
      }

      if (currentUsdTotals) {
        current = currentUsdTotals;
      }
      if (previousUsdTotals) {
        previous = previousUsdTotals;
      }
    }

    // Calculate metrics
    const calculateMetrics = (data) => {
      const { totalAdSales, totalAdSpend, totalRevenue } = data;
      const ACOS = totalAdSales > 0 ? (totalAdSpend / totalAdSales) * 100 : 0;
      const TACOS = totalRevenue > 0 ? (totalAdSpend / totalRevenue) * 100 : 0;
      const ROAS = totalAdSpend > 0 ? totalAdSales / totalAdSpend : 0;
      const organicrevenue = totalRevenue - totalAdSales;
      return {
        totalAdSales: totalAdSales.toFixed(2),
        totalAdSpend: totalAdSpend.toFixed(2),
        totalRevenue: totalRevenue.toFixed(2),
        ACOS: ACOS.toFixed(2),
        TACOS: TACOS.toFixed(2),
        ROAS: ROAS.toFixed(2),
        organicrevenue: organicrevenue.toFixed(2)
      };
    };

    const currentMetrics = calculateMetrics(current);
    const previousMetrics = calculateMetrics(previous);

    // Calculate change percentages
    const getPercentChange = (curr, prev) => {
      if (prev === 0) return "0.00";
      const diff = ((curr - prev) / prev) * 100;
      return diff.toFixed(2);
    };

    const percent = {
      adSalesChangePercent: getPercentChange(parseFloat(currentMetrics.totalAdSales), parseFloat(previousMetrics.totalAdSales)),
      adSpendChangePercent: getPercentChange(parseFloat(currentMetrics.totalAdSpend), parseFloat(previousMetrics.totalAdSpend)),
      acosChangePercent: getPercentChange(parseFloat(currentMetrics.ACOS), parseFloat(previousMetrics.ACOS)),
      tacosChangePercent: getPercentChange(parseFloat(currentMetrics.TACOS), parseFloat(previousMetrics.TACOS)),
      roasChangePercent: getPercentChange(parseFloat(currentMetrics.ROAS), parseFloat(previousMetrics.ROAS)),
      organicrevenueChangePercent: getPercentChange(parseFloat(currentMetrics.organicrevenue), parseFloat(previousMetrics.organicrevenue))
    };

    const responseData = {
      current: currentMetrics,
      previous: previousMetrics,
      percent,
      comparison: {
        currentPeriod: currentStartMonth && currentEndMonth ? {
          startMonth: `${currentStartMonth.year}-${currentStartMonth.month.toString().padStart(2, '0')}`,
          endMonth: `${currentEndMonth.year}-${currentEndMonth.month.toString().padStart(2, '0')}`
        } : null,
        previousPeriod: previousStartMonth && previousEndMonth ? {
          startMonth: `${previousStartMonth.year}-${previousStartMonth.month.toString().padStart(2, '0')}`,
          endMonth: `${previousEndMonth.year}-${previousEndMonth.month.toString().padStart(2, '0')}`
        } : null
      }
    };

    if (groupByCountryDates) {
      responseData.items = breakdown;
      responseData.previousItems = previousBreakdown || null;
    }

    res.json({
      success: true,
      message: 'Ad sales and spend data retrieved successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Ad sales ad spend service error:', error);
    res.status(500).json({ error: error.message });
  }
};
