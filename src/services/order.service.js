
const sql = require('mssql');
const https = require('https');
const logger = require('../utils/logger');
const { getConnection } = require('../utils/database');

const FRANKFURTER_API_BASE = 'https://api.frankfurter.dev';
const supportedCurrencies = new Set(['GBP', 'EUR']);
const exchangeRateCache = new Map();
const countryCurrencyFallback = {
  UK: 'GBP',
  DE: 'EUR',
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
            const parsed = JSON.parse(data);
            resolve(parsed);
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
  const date = buildDateFromYearMonth(yearMonth);
  const paths = [
    `/latest?from=${currency}&to=USD&date=${date}`,
    `/${date}?from=${currency}&to=USD`,
    `/v1/${date}?from=${currency}&to=USD`,
  ];

  let lastError = null;
  for (const path of paths) {
    try {
      const response = await frankfurterRequest(path);
      return response;
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

const computeMonthlyTotals = async (breakdown, currencyLookup) => {
  const totals = {};

  for (const countryKey of Object.keys(breakdown)) {
    totals[countryKey] = {};
    const entries = breakdown[countryKey];
    const currency = (currencyLookup[countryKey] || countryCurrencyFallback[countryKey] || '').toUpperCase();

    entries.forEach((entry) => {
      const yearMonth = entry.date.slice(0, 7);
      if (!totals[countryKey][yearMonth]) {
        totals[countryKey][yearMonth] = {
          currency,
          local: 0,
          usd: null,
          rate: null,
        };
      }
      totals[countryKey][yearMonth].local += entry.totalSales;
    });

    if (!supportedCurrencies.has(currency)) {
      continue;
    }

    for (const yearMonth of Object.keys(totals[countryKey])) {
      try {
        const rate = await getExchangeRate(currency, yearMonth);
        totals[countryKey][yearMonth].rate = rate;
        totals[countryKey][yearMonth].usd = Number((totals[countryKey][yearMonth].local * rate).toFixed(2));
      } catch (error) {
        logger.error(`FX conversion failed for ${countryKey} (${yearMonth}): ${error.message}`);
        totals[countryKey][yearMonth].usd = null;
      }
    }
  }

  return totals;
};

const summarizeUsdTotals = (monthlyTotals) => {
  if (!monthlyTotals) {
    return { byCountry: {}, totalUsd: null };
  }

  const byCountry = {};
  let totalUsd = 0;

  Object.keys(monthlyTotals).forEach((countryKey) => {
    let countryUsd = 0;
    Object.values(monthlyTotals[countryKey] || {}).forEach((period) => {
      if (typeof period.usd === 'number') {
        countryUsd += period.usd;
      }
    });
    byCountry[countryKey] = Number(countryUsd.toFixed(2));
    totalUsd += countryUsd;
  });

  return {
    byCountry,
    totalUsd: Number(totalUsd.toFixed(2)),
  };
};

const applyUsdToBreakdown = (breakdown, monthlyTotals) => {
  if (!monthlyTotals) return breakdown;

  Object.keys(breakdown).forEach(countryKey => {
    const entries = breakdown[countryKey] || [];
    entries.forEach(entry => {
      const yearMonth = entry.date.slice(0, 7);
      const rate = monthlyTotals?.[countryKey]?.[yearMonth]?.rate;
      if (typeof rate === 'number') {
        entry.totalSalesUSD = Number((entry.totalSales * rate).toFixed(2));
      } else {
        entry.totalSalesUSD = null;
      }
    });
  });

  return breakdown;
};

exports.getOrderListByDatabase = async (req, res) => {
  try {
    const {
      sku,
      product_category,
      product_name,
      platform,
      country,
      filterType,
      fromDate,
      toDate,
      startMonth,
      endMonth
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

    // Check if custom date range is provided, if not, require filterType
    const hasCustomRange = (startMonth && endMonth) || (fromDate && toDate);

    if (!hasCustomRange && !filterType) {
      return res.status(400).json({
        status: 400,
        message: "Provide a valid filterType query parameter or body field, or use custom date range with startMonth/endMonth or fromDate/toDate.",
        success: false,
        data: {
          code: "BAD_REQUEST",
          message: "filterType is required when no custom date range is provided",
          details: "Provide a valid filterType or use startMonth/endMonth (YYYY-MM) or fromDate/toDate (YYYY-MM-DD) for custom ranges."
        },
        timestamp: new Date().toISOString()
      });
    }

    const pool = await getConnection(req);

    const today = new Date();
    console.log('Today\'s date:', today.toISOString());

    let currentStartDate, currentEndDate;

    // Use UTC for consistent date handling
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();

    // Helper function to parse YYYY-MM format
    const parseMonthYear = (monthYearStr) => {
      if (!monthYearStr || !monthYearStr.includes('-')) return null;
      const [year, month] = monthYearStr.split('-').map(s => parseInt(s.trim()));
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;
      return { month: month - 1, year }; // month is 0-indexed in JS Date
    };

    // Filter ranges
    if (startMonth && endMonth) {
      // Custom range: YYYY-MM to YYYY-MM
      const startParsed = parseMonthYear(startMonth);
      const endParsed = parseMonthYear(endMonth);

      if (startParsed && endParsed) {
        currentStartDate = new Date(Date.UTC(startParsed.year, startParsed.month, 1));
        currentEndDate = new Date(Date.UTC(endParsed.year, endParsed.month + 1, 0, 23, 59, 59, 999));
      } else {
        // Invalid format, fallback to current month
        currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
      }
    } else if (fromDate && toDate) {
      // Direct date range
      currentStartDate = new Date(fromDate);
      currentEndDate = new Date(toDate);
      currentEndDate.setHours(23, 59, 59, 999);
    } else {
      switch (filterType) {
        case "currentmonth": {
          // Current month: from 1st to last day of current month
          currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
          currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
          break;
        }
        case "previousmonth": {
          // Previous month: full previous month
          const previousMonth = currentMonth - 1;
          const lastyear = previousMonth < 0 ? currentYear - 1 : currentYear;
          const adjustedPrevMonth = (previousMonth + 12) % 12;
          currentStartDate = new Date(Date.UTC(lastyear, adjustedPrevMonth, 1));
          currentEndDate = new Date(Date.UTC(lastyear, adjustedPrevMonth + 1, 0, 23, 59, 59, 999));
          break;
        }
        case "currentyear": {
          // Current year: from Jan 1st to Dec 31st of current year
          currentStartDate = new Date(Date.UTC(currentYear, 0, 1)); // January 1st
          currentEndDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)); // December 31st
          break;
        }
        case "lastyear": {
          // Previous year: from Jan 1st to Dec 31st of previous year
          currentStartDate = new Date(Date.UTC(currentYear - 1, 0, 1)); // January 1st of previous year
          currentEndDate = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59, 999)); // December 31st of previous year
          break;
        }
        case "6months":
        default: {
          return res.status(400).json({
            status: 400,
            message: "Provide a valid filterType such as currentmonth, previousmonth, currentyear, or lastyear.",
            success: false,
            data: {
              code: "BAD_REQUEST",
              message: `Invalid filterType: ${filterType}`,
              details: "Provide a valid filterType such as currentmonth, previousmonth, currentyear, or lastyear."
            },
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // Build WHERE conditions (removed client_id - each database is client-specific)
    let whereConditions = [];
    if (sku) whereConditions.push(`sku IN (${sku.split(",").map(s => `'${s.trim()}'`).join(",")})`);
    if (product_category) whereConditions.push(`product_category = '${product_category}'`);
    if (product_name) whereConditions.push(`product_name = '${product_name}'`);
    if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
    if (country) whereConditions.push(`country LIKE '%${country}%'`);

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';

    console.log('WHERE clause:', whereClause);
    console.log('Date range:', { currentStartDate, currentEndDate });

    // SQL query for current period
    const currentQuery = `
      SELECT
        sku,
        product_name,
        product_category,
        SUM(CAST(quantity AS INT)) as sold_qty,
        SUM(CAST(total_sales AS FLOAT)) as revenue,
        MAX(purchase_date) as latest_purchase_date
      FROM std_orders
      WHERE ${whereClause} AND purchase_date >= @currentStartDate AND purchase_date <= @currentEndDate
      GROUP BY sku, product_name, product_category
      ORDER BY latest_purchase_date DESC
    `;

    const currentResult = await pool.request()
      .input('currentStartDate', sql.DateTime, currentStartDate)
      .input('currentEndDate', sql.DateTime, currentEndDate)
      .query(currentQuery);

    const skudata = currentResult.recordset;

    res.json({
      success: true,
      message: 'Order list retrieved successfully!',
      data: { skudata }
    });

  } catch (error) {
    console.error('Order list service error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOrdersByDatabase = async (req, res) => {
  try {
    const {
      sku,
      platform,
      filterType,
      purchase_date, // Support legacy parameter name
      fromDate,
      toDate,
      startMonth,
      endMonth,
      state,
      city,
      country
    } = req.query;

    let databaseName = req.user?.databaseName || req.databaseName;
    if (!databaseName) {
      return res.status(400).json({
        success: false,
        error: 'Database name not found in token',
        message: 'Please ensure your JWT token contains the databaseName field.'
      });
    }
    req.databaseName = databaseName;

    const hasCustomRange = (startMonth && endMonth) || (fromDate && toDate);
    const allowDateSkip = req.skipOrdersDateRange === true;
    const groupByCountryDates = req.groupOrdersByCountryDates === true;

    if (!allowDateSkip && !hasCustomRange && !filterType) {
      return res.status(400).json({
        status: 400,
        error: {
          code: "BAD_REQUEST",
          message: "filterType is required when no custom date range is provided",
          details: "Provide a valid filterType or use startMonth/endMonth (YYYY-MM) or fromDate/toDate (YYYY-MM-DD) for custom ranges."
        },
        timestamp: new Date().toISOString()
      });
    }

    const effectiveFilterType = purchase_date || filterType;

    const pool = await getConnection(req);

    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();

    let currentStartDate, currentEndDate;
    let previousStartDate, previousEndDate;

    const parseMonthYear = (monthYearStr) => {
      if (!monthYearStr || !monthYearStr.includes('-')) return null;
      const [year, month] = monthYearStr.split('-').map(s => parseInt(s.trim()));
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;
      return { month: month - 1, year };
    };

    if (startMonth && endMonth) {
      const startParsed = parseMonthYear(startMonth);
      const endParsed = parseMonthYear(endMonth);

      if (startParsed && endParsed) {
        currentStartDate = new Date(Date.UTC(startParsed.year, startParsed.month, 1));
        currentEndDate = new Date(Date.UTC(endParsed.year, endParsed.month + 1, 0));

        const duration = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24) + 1;
        previousEndDate = new Date(currentStartDate.getTime() - 1);
        previousStartDate = new Date(previousEndDate.getTime() - (duration - 1) * 86400000);
      }
    } else if (fromDate && toDate) {
      currentStartDate = new Date(fromDate);
      currentEndDate = new Date(toDate);

      currentEndDate.setHours(23, 59, 59, 999);
      const duration = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24) + 1;
      previousEndDate = new Date(currentStartDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate.getTime() - (duration - 1) * 86400000);
    } else if (effectiveFilterType) {
      switch (effectiveFilterType) {
        case "currentmonth":
          currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
          currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
          previousStartDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
          previousEndDate = new Date(Date.UTC(currentYear, currentMonth, 0));
          break;
        case "previousmonth":
          currentStartDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
          currentEndDate = new Date(Date.UTC(currentYear, currentMonth, 0));
          previousStartDate = new Date(Date.UTC(currentYear, currentMonth - 2, 1));
          previousEndDate = new Date(Date.UTC(currentYear, currentMonth - 1, 0));
          break;
        case "currentyear":
          currentStartDate = new Date(Date.UTC(currentYear, 0, 1));
          currentEndDate = new Date(Date.UTC(currentYear, 11, 31));
          previousStartDate = new Date(Date.UTC(currentYear - 1, 0, 1));
          previousEndDate = new Date(Date.UTC(currentYear - 1, 11, 31));
          break;
        case "lastyear":
          currentStartDate = new Date(Date.UTC(currentYear - 1, 0, 1));
          currentEndDate = new Date(Date.UTC(currentYear - 1, 11, 31));
          previousStartDate = new Date(Date.UTC(currentYear - 2, 0, 1));
          previousEndDate = new Date(Date.UTC(currentYear - 2, 11, 31));
          break;
        default:
          return res.status(400).json({
            status: 400,
            error: {
              code: "BAD_REQUEST",
              message: `Invalid filterType: ${effectiveFilterType}`,
              details: "Provide a valid filterType such as currentmonth, previousmonth, currentyear, or lastyear."
            },
            timestamp: new Date().toISOString()
          });
      }
    } else if (allowDateSkip) {
      currentStartDate = null;
      currentEndDate = null;
      previousStartDate = null;
      previousEndDate = null;
    }

    // Build WHERE conditions
    let whereConditions = [];
    if (sku) whereConditions.push(`sku IN (${sku.split(",").map(s => `'${s.trim()}'`).join(",")})`);
    if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
    if (state) whereConditions.push(`state = '${state}'`);
    if (city) whereConditions.push(`city = '${city}'`);
    if (country) whereConditions.push(`country LIKE '%${country}%'`);
    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';

    const currentDateCondition = (currentStartDate && currentEndDate)
      ? `
        AND CAST(purchase_date AS DATE) >= @currentStartDate 
        AND CAST(purchase_date AS DATE) <= @currentEndDate
      `
      : '';

    // Check if date range spans only one month
    const isSingleMonth = (() => {
      if (!currentStartDate || !currentEndDate) return false;
      const startYear = currentStartDate.getUTCFullYear();
      const startMonth = currentStartDate.getUTCMonth();
      const endYear = currentEndDate.getUTCFullYear();
      const endMonth = currentEndDate.getUTCMonth();
      return startYear === endYear && startMonth === endMonth;
    })();

    // Determine if we should group by month or day
    // Group by month if: filterType is currentyear/lastyear OR custom range spans multiple months
    // Group by day if: filterType is currentmonth/previousmonth OR custom range is single month
    const shouldGroupByMonth = !isSingleMonth && (
      effectiveFilterType === 'currentyear' || 
      effectiveFilterType === 'lastyear' ||
      (hasCustomRange && !isSingleMonth)
    );

    let currentQuery;
    const countryCurrencyLookup = {};
    if (groupByCountryDates) {
      if (shouldGroupByMonth) {
        currentQuery = `
          SELECT
            ISNULL(country, 'Unknown') AS country,
            FORMAT(purchase_date, 'yyyy-MM') AS purchase_month,
            MAX(currency) AS currency,
            SUM(CAST(quantity AS INT)) AS totalQuantity,
            SUM(CAST(total_sales AS FLOAT)) AS totalSales,
            COUNT(DISTINCT order_id) AS orderCount
          FROM std_orders
          WHERE ${whereClause}
          ${currentDateCondition}
          GROUP BY ISNULL(country, 'Unknown'), FORMAT(purchase_date, 'yyyy-MM')
          ORDER BY country, purchase_month
        `;
      } else {
        currentQuery = `
          SELECT
            ISNULL(country, 'Unknown') AS country,
            CAST(purchase_date AS DATE) AS purchase_date,
            MAX(currency) AS currency,
            SUM(CAST(quantity AS INT)) AS totalQuantity,
            SUM(CAST(total_sales AS FLOAT)) AS totalSales,
            COUNT(DISTINCT order_id) AS orderCount
          FROM std_orders
          WHERE ${whereClause}
          ${currentDateCondition}
          GROUP BY ISNULL(country, 'Unknown'), CAST(purchase_date AS DATE)
          ORDER BY country, purchase_date
        `;
      }
    } else {
      if (shouldGroupByMonth) {
        currentQuery = `
          SELECT
            FORMAT(purchase_date, 'yyyy-MM') AS purchase_month,
            MAX(currency) AS currency,
            SUM(CAST(quantity AS INT)) AS totalQuantity,
            SUM(CAST(total_sales AS FLOAT)) AS totalSales,
            COUNT(DISTINCT order_id) AS orderCount
          FROM std_orders
          WHERE ${whereClause}
          ${currentDateCondition}
          GROUP BY FORMAT(purchase_date, 'yyyy-MM')
          ORDER BY purchase_month
        `;
      } else {
        currentQuery = `
          SELECT
            CAST(purchase_date AS DATE) AS purchase_date,
            MAX(currency) AS currency,
            SUM(CAST(quantity AS INT)) AS totalQuantity,
            SUM(CAST(total_sales AS FLOAT)) AS totalSales,
            COUNT(DISTINCT order_id) AS orderCount
          FROM std_orders
          WHERE ${whereClause}
          ${currentDateCondition}
          GROUP BY CAST(purchase_date AS DATE)
          ORDER BY purchase_date
        `;
      }
    }

    const currentRequest = pool.request();
    if (currentStartDate && currentEndDate) {
      currentRequest.input('currentStartDate', sql.Date, currentStartDate);
      currentRequest.input('currentEndDate', sql.Date, currentEndDate);
    }
    const currentResult = await currentRequest.query(currentQuery);

    let breakdown = {}, totalQuantity = 0, totalSales = 0, totalOrders = 0;

    currentResult.recordset.forEach(row => {
      if (groupByCountryDates) {
        const countryKey = row.country || 'Unknown';
        // Handle both date (YYYY-MM-DD) and month (YYYY-MM) formats
        let dateKey;
        if (shouldGroupByMonth) {
          dateKey = row.purchase_month || (row.purchase_date ? 
            (row.purchase_date instanceof Date ? 
              row.purchase_date.toISOString().substring(0, 7) : 
              new Date(row.purchase_date).toISOString().substring(0, 7)) : 
            '');
        } else {
          dateKey = row.purchase_date instanceof Date
            ? row.purchase_date.toISOString().split('T')[0]
            : new Date(row.purchase_date).toISOString().split('T')[0];
        }
        const rowCurrency = (row.currency || countryCurrencyFallback[countryKey] || '').toUpperCase();

        if (!breakdown[countryKey]) {
          breakdown[countryKey] = [];
        }
        if (rowCurrency && !countryCurrencyLookup[countryKey]) {
          countryCurrencyLookup[countryKey] = rowCurrency;
        }

        const entry = {
          date: dateKey,
          totalQuantity: parseInt(row.totalQuantity) || 0,
          totalSales: parseFloat(row.totalSales) || 0,
          orderCount: parseInt(row.orderCount) || 0,
          aov: 0
        };

        breakdown[countryKey].push(entry);
        totalQuantity += entry.totalQuantity;
        totalSales += entry.totalSales;
        totalOrders += entry.orderCount;
      } else {
        // Handle both date (YYYY-MM-DD) and month (YYYY-MM) formats
        let key;
        if (shouldGroupByMonth) {
          key = row.purchase_month || (row.purchase_date ? 
            (row.purchase_date instanceof Date ? 
              row.purchase_date.toISOString().substring(0, 7) : 
              new Date(row.purchase_date).toISOString().substring(0, 7)) : 
            '');
        } else {
          key = row.purchase_date instanceof Date
            ? row.purchase_date.toISOString().split('T')[0]
            : new Date(row.purchase_date).toISOString().split('T')[0];
        }

        breakdown[key] = {
          date: key,
          totalQuantity: parseInt(row.totalQuantity) || 0,
          totalSales: parseFloat(row.totalSales) || 0,
          orderCount: parseInt(row.orderCount) || 0,
          aov: 0
        };
        totalQuantity += breakdown[key].totalQuantity;
        totalSales += breakdown[key].totalSales;
        totalOrders += breakdown[key].orderCount;
      }
    });

    let monthlyTotals = null;
    let totalSalesUsdSummary = null;
    if (groupByCountryDates) {
      Object.keys(breakdown).forEach(countryKey => {
        breakdown[countryKey].forEach(item => {
          item.aov = item.orderCount > 0 ? Number((item.totalSales / item.orderCount).toFixed(2)) : 0;
        });
        // Sort by date/month - works for both YYYY-MM-DD and YYYY-MM formats
        breakdown[countryKey].sort((a, b) => {
          // For YYYY-MM format, append '-01' to make it sortable as date
          const dateA = a.date.length === 7 ? a.date + '-01' : a.date;
          const dateB = b.date.length === 7 ? b.date + '-01' : b.date;
          return new Date(dateA) - new Date(dateB);
        });
      });
      monthlyTotals = await computeMonthlyTotals(breakdown, countryCurrencyLookup);
      applyUsdToBreakdown(breakdown, monthlyTotals);
      totalSalesUsdSummary = summarizeUsdTotals(monthlyTotals);
    } else {
      Object.keys(breakdown).forEach(key => {
        const item = breakdown[key];
        item.aov = item.orderCount > 0 ? (item.totalSales / item.orderCount) : 0;
        item.aov = Number(item.aov.toFixed(2));
      });
    }

    let previous = { totalQuantity: 0, totalSales: 0, orderCount: 0 };
    const previousDateCondition = (previousStartDate && previousEndDate)
      ? `
        AND CAST(purchase_date AS DATE) >= @previousStartDate 
        AND CAST(purchase_date AS DATE) <= @previousEndDate
      `
      : '';

    if (previousDateCondition) {
      const previousQuery = `
        SELECT
          SUM(CAST(quantity AS INT)) AS totalQuantity,
          SUM(CAST(total_sales AS FLOAT)) AS totalSales,
          COUNT(DISTINCT order_id) AS orderCount
        FROM std_orders
        WHERE ${whereClause}
        ${previousDateCondition}
      `;

      const previousRequest = pool.request()
        .input('previousStartDate', sql.Date, previousStartDate)
        .input('previousEndDate', sql.Date, previousEndDate);

      const previousResult = await previousRequest.query(previousQuery);
      previous = previousResult.recordset[0] || { totalQuantity: 0, totalSales: 0, orderCount: 0 };
    }

    const getPercentChange = (curr, prev) => {
      if (prev === 0) return "N/A";
      const diff = ((curr - prev) / prev) * 100;
      return (diff >= 0 ? diff.toFixed(2) + "% Gain" : diff.toFixed(2) + "% Loss");
    };

    const currentAOV = totalOrders > 0 ? totalSales / totalOrders : 0;
    const previousAOV = previous.orderCount > 0 ? previous.totalSales / previous.orderCount : 0;

    const responseData = {
      totalQuantity,
      totalSales,
      totalSalesUSD: groupByCountryDates ? (totalSalesUsdSummary?.totalUsd || null) : null,
      totalOrders,
      aov: currentAOV.toFixed(2),
      items: groupByCountryDates
        ? breakdown
        : Object.values(breakdown).sort((a, b) => {
            // Sort by date/month - works for both YYYY-MM-DD and YYYY-MM formats
            const dateA = a.date.length === 7 ? a.date + '-01' : a.date;
            const dateB = b.date.length === 7 ? b.date + '-01' : b.date;
            return new Date(dateA) - new Date(dateB);
          }),
      comparison: {
        currentPeriod: { startDate: currentStartDate || null, endDate: currentEndDate || null },
        previousPeriod: { startDate: previousStartDate || null, endDate: previousEndDate || null },
        previousTotalQuantity: previous.totalQuantity,
        previousTotalSales: previous.totalSales,
        previousTotalOrders: previous.orderCount,
        previousAOV: previousAOV.toFixed(2),
        quantityChangePercent: getPercentChange(totalQuantity, previous.totalQuantity),
        salesChangePercent: getPercentChange(totalSales, previous.totalSales),
        ordersChangePercent: getPercentChange(totalOrders, previous.orderCount),
        aovChangePercent: getPercentChange(currentAOV, previousAOV),
      }
    };

    if (groupByCountryDates) {
      responseData.monthlyTotals = monthlyTotals;
      responseData.totalSalesByCountryUSD = totalSalesUsdSummary?.byCountry || {};
    }

    res.json({
      success: true,
      message: 'Orders retrieved successfully',
      data: responseData, 
    });

  } catch (error) {
    console.error('Order service error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOrdersLineChartByDatabase = async (req, res) => {
  try {
    const {
      sku,
      platform,
      filterType,
      purchase_date, // Support legacy parameter name
      fromDate,
      toDate,
      startMonth,
      endMonth,
      state,
      city,
      country
    } = req.query;

    let databaseName = req.user?.databaseName || req.databaseName;
    if (!databaseName) {
      return res.status(400).json({
        success: false,
        error: 'Database name not found in token',
        message: 'Please ensure your JWT token contains the databaseName field.'
      });
    }
    req.databaseName = databaseName;

    const hasCustomRange = (startMonth && endMonth) || (fromDate && toDate);
    const allowDateSkip = req.skipOrdersDateRange === true;
    const groupByCountryDates = req.groupOrdersByCountryDates === true;

    if (!allowDateSkip && !hasCustomRange && !filterType) {
      return res.status(400).json({
        status: 400,
        error: {
          code: "BAD_REQUEST",
          message: "filterType is required when no custom date range is provided",
          details: "Provide a valid filterType or use startMonth/endMonth (YYYY-MM) or fromDate/toDate (YYYY-MM-DD) for custom ranges."
        },
        timestamp: new Date().toISOString()
      });
    }

    const effectiveFilterType = purchase_date || filterType;

    const pool = await getConnection(req);

    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();

    let currentStartDate, currentEndDate;
    let previousStartDate, previousEndDate;
    let previousYearStartDate, previousYearEndDate;

    const parseMonthYear = (monthYearStr) => {
      if (!monthYearStr || !monthYearStr.includes('-')) return null;
      const [year, month] = monthYearStr.split('-').map(s => parseInt(s.trim()));
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;
      return { month: month - 1, year };
    };

    // Helper function to calculate previous year dates (same period, one year earlier)
    const calculatePreviousYearDates = (startDate, endDate) => {
      if (!startDate || !endDate) return { start: null, end: null };
      // Create new date objects to avoid mutating originals
      const startYear = startDate.getUTCFullYear();
      const startMonth = startDate.getUTCMonth();
      const startDay = startDate.getUTCDate();
      
      const endYear = endDate.getUTCFullYear();
      const endMonth = endDate.getUTCMonth();
      const endDay = endDate.getUTCDate();
      
      // Calculate previous year dates explicitly
      const prevYearStart = new Date(Date.UTC(startYear - 1, startMonth, startDay));
      const prevYearEnd = new Date(Date.UTC(endYear - 1, endMonth, endDay));
      
      return { start: prevYearStart, end: prevYearEnd };
    };

    if (startMonth && endMonth) {
      const startParsed = parseMonthYear(startMonth);
      const endParsed = parseMonthYear(endMonth);

      if (startParsed && endParsed) {
        currentStartDate = new Date(Date.UTC(startParsed.year, startParsed.month, 1));
        currentEndDate = new Date(Date.UTC(endParsed.year, endParsed.month + 1, 0));

        const duration = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24) + 1;
        previousEndDate = new Date(currentStartDate.getTime() - 1);
        previousStartDate = new Date(previousEndDate.getTime() - (duration - 1) * 86400000);
        
        // Calculate previous year dates
        const prevYearDates = calculatePreviousYearDates(currentStartDate, currentEndDate);
        previousYearStartDate = prevYearDates.start;
        previousYearEndDate = prevYearDates.end;
      }
    } else if (fromDate && toDate) {
      currentStartDate = new Date(fromDate);
      currentEndDate = new Date(toDate);

      currentEndDate.setHours(23, 59, 59, 999);
      const duration = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24) + 1;
      previousEndDate = new Date(currentStartDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate.getTime() - (duration - 1) * 86400000);
      
      // Calculate previous year dates
      const prevYearDates = calculatePreviousYearDates(currentStartDate, currentEndDate);
      previousYearStartDate = prevYearDates.start;
      previousYearEndDate = prevYearDates.end;
    } else if (effectiveFilterType) {
      switch (effectiveFilterType) {
        case "currentmonth":
          // Current month: first day to last day of current month
          currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
          currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
          previousStartDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
          previousEndDate = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
          // Previous year same month (one year before current month)
          previousYearStartDate = new Date(Date.UTC(currentYear - 1, currentMonth, 1));
          previousYearEndDate = new Date(Date.UTC(currentYear - 1, currentMonth + 1, 0, 23, 59, 59, 999));
          break;
        case "previousmonth":
          // Previous month: first day to last day of previous month
          currentStartDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
          currentEndDate = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
          previousStartDate = new Date(Date.UTC(currentYear, currentMonth - 2, 1));
          previousEndDate = new Date(Date.UTC(currentYear, currentMonth - 1, 0, 23, 59, 59, 999));
          // Previous year same month (one year before previous month)
          previousYearStartDate = new Date(Date.UTC(currentYear - 1, currentMonth - 1, 1));
          previousYearEndDate = new Date(Date.UTC(currentYear - 1, currentMonth, 0, 23, 59, 59, 999));
          break;
        case "currentyear":
          // Current year: Jan 1 to Dec 31 of current year (e.g., 2024)
          currentStartDate = new Date(Date.UTC(currentYear, 0, 1));
          // Use last day of December by using month 12, day 0 (which gives last day of month 11)
          currentEndDate = new Date(Date.UTC(currentYear, 12, 0, 23, 59, 59, 999));
          previousStartDate = new Date(Date.UTC(currentYear - 1, 0, 1));
          previousEndDate = new Date(Date.UTC(currentYear - 1, 12, 0, 23, 59, 59, 999));
          // Previous year for comparison - one year before current year (e.g., 2023 if current is 2024)
          previousYearStartDate = new Date(Date.UTC(currentYear - 1, 0, 1));
          previousYearEndDate = new Date(Date.UTC(currentYear - 1, 12, 0, 23, 59, 59, 999));
          break;
        case "lastyear":
          // Last year: Jan 1 to Dec 31 of previous year
          currentStartDate = new Date(Date.UTC(currentYear - 1, 0, 1));
          currentEndDate = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59, 999));
          previousStartDate = new Date(Date.UTC(currentYear - 2, 0, 1));
          previousEndDate = new Date(Date.UTC(currentYear - 2, 11, 31, 23, 59, 59, 999));
          // Year before last - one year before last year
          previousYearStartDate = new Date(Date.UTC(currentYear - 3, 0, 1));
          previousYearEndDate = new Date(Date.UTC(currentYear - 3, 11, 31, 23, 59, 59, 999));
          break;
        default:
          return res.status(400).json({
            status: 400,
            error: {
              code: "BAD_REQUEST",
              message: `Invalid filterType: ${effectiveFilterType}`,
              details: "Provide a valid filterType such as currentmonth, previousmonth, currentyear, or lastyear."
            },
            timestamp: new Date().toISOString()
          });
      }
    } else if (allowDateSkip) {
      currentStartDate = null;
      currentEndDate = null;
      previousStartDate = null;
      previousEndDate = null;
      previousYearStartDate = null;
      previousYearEndDate = null;
    }

    // Build WHERE conditions
    let whereConditions = [];
    if (sku) whereConditions.push(`sku IN (${sku.split(",").map(s => `'${s.trim()}'`).join(",")})`);
    if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
    if (state) whereConditions.push(`state = '${state}'`);
    if (city) whereConditions.push(`city = '${city}'`);
    if (country) whereConditions.push(`country LIKE '%${country}%'`);
    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';

    const currentDateCondition = (currentStartDate && currentEndDate)
      ? `
        AND CAST(purchase_date AS DATE) >= @currentStartDate 
        AND CAST(purchase_date AS DATE) <= @currentEndDate
      `
      : '';

    // Check if date range spans only one month
    const isSingleMonth = (() => {
      if (!currentStartDate || !currentEndDate) return false;
      const startYear = currentStartDate.getUTCFullYear();
      const startMonth = currentStartDate.getUTCMonth();
      const endYear = currentEndDate.getUTCFullYear();
      const endMonth = currentEndDate.getUTCMonth();
      return startYear === endYear && startMonth === endMonth;
    })();

    // Determine if we should group by month or day
    const shouldGroupByMonth = !isSingleMonth && (
      effectiveFilterType === 'currentyear' || 
      effectiveFilterType === 'lastyear' ||
      (hasCustomRange && !isSingleMonth)
    );

    let currentQuery;
    const countryCurrencyLookup = {};
    if (groupByCountryDates) {
      if (shouldGroupByMonth) {
        currentQuery = `
          SELECT
            ISNULL(country, 'Unknown') AS country,
            FORMAT(purchase_date, 'yyyy-MM') AS purchase_month,
            MAX(currency) AS currency,
            SUM(CAST(quantity AS INT)) AS totalQuantity,
            SUM(CAST(total_sales AS FLOAT)) AS totalSales,
            COUNT(DISTINCT order_id) AS orderCount
          FROM std_orders
          WHERE ${whereClause}
          ${currentDateCondition}
          GROUP BY ISNULL(country, 'Unknown'), FORMAT(purchase_date, 'yyyy-MM')
          ORDER BY country, purchase_month
        `;
      } else {
        currentQuery = `
          SELECT
            ISNULL(country, 'Unknown') AS country,
            CAST(purchase_date AS DATE) AS purchase_date,
            MAX(currency) AS currency,
            SUM(CAST(quantity AS INT)) AS totalQuantity,
            SUM(CAST(total_sales AS FLOAT)) AS totalSales,
            COUNT(DISTINCT order_id) AS orderCount
          FROM std_orders
          WHERE ${whereClause}
          ${currentDateCondition}
          GROUP BY ISNULL(country, 'Unknown'), CAST(purchase_date AS DATE)
          ORDER BY country, purchase_date
        `;
      }
    } else {
      if (shouldGroupByMonth) {
        currentQuery = `
          SELECT
            FORMAT(purchase_date, 'yyyy-MM') AS purchase_month,
            MAX(currency) AS currency,
            SUM(CAST(quantity AS INT)) AS totalQuantity,
            SUM(CAST(total_sales AS FLOAT)) AS totalSales,
            COUNT(DISTINCT order_id) AS orderCount
          FROM std_orders
          WHERE ${whereClause}
          ${currentDateCondition}
          GROUP BY FORMAT(purchase_date, 'yyyy-MM')
          ORDER BY purchase_month
        `;
      } else {
        currentQuery = `
          SELECT
            CAST(purchase_date AS DATE) AS purchase_date,
            MAX(currency) AS currency,
            SUM(CAST(quantity AS INT)) AS totalQuantity,
            SUM(CAST(total_sales AS FLOAT)) AS totalSales,
            COUNT(DISTINCT order_id) AS orderCount
          FROM std_orders
          WHERE ${whereClause}
          ${currentDateCondition}
          GROUP BY CAST(purchase_date AS DATE)
          ORDER BY purchase_date
        `;
      }
    }

    const currentRequest = pool.request();
    if (currentStartDate && currentEndDate) {
      currentRequest.input('currentStartDate', sql.Date, currentStartDate);
      currentRequest.input('currentEndDate', sql.Date, currentEndDate);
    }
    const currentResult = await currentRequest.query(currentQuery);

    let breakdown = {}, totalQuantity = 0, totalSales = 0, totalOrders = 0;

    currentResult.recordset.forEach(row => {
      if (groupByCountryDates) {
        const countryKey = row.country || 'Unknown';
        let dateKey;
        if (shouldGroupByMonth) {
          dateKey = row.purchase_month || (row.purchase_date ? 
            (row.purchase_date instanceof Date ? 
              row.purchase_date.toISOString().substring(0, 7) : 
              new Date(row.purchase_date).toISOString().substring(0, 7)) : 
            '');
        } else {
          dateKey = row.purchase_date instanceof Date
            ? row.purchase_date.toISOString().split('T')[0]
            : new Date(row.purchase_date).toISOString().split('T')[0];
        }
        const rowCurrency = (row.currency || countryCurrencyFallback[countryKey] || '').toUpperCase();

        if (!breakdown[countryKey]) {
          breakdown[countryKey] = [];
        }
        if (rowCurrency && !countryCurrencyLookup[countryKey]) {
          countryCurrencyLookup[countryKey] = rowCurrency;
        }

        const entry = {
          date: dateKey,
          totalQuantity: parseInt(row.totalQuantity) || 0,
          totalSales: parseFloat(row.totalSales) || 0,
          orderCount: parseInt(row.orderCount) || 0,
          aov: 0
        };

        breakdown[countryKey].push(entry);
        totalQuantity += entry.totalQuantity;
        totalSales += entry.totalSales;
        totalOrders += entry.orderCount;
      } else {
        let key;
        if (shouldGroupByMonth) {
          key = row.purchase_month || (row.purchase_date ? 
            (row.purchase_date instanceof Date ? 
              row.purchase_date.toISOString().substring(0, 7) : 
              new Date(row.purchase_date).toISOString().substring(0, 7)) : 
            '');
        } else {
          key = row.purchase_date instanceof Date
            ? row.purchase_date.toISOString().split('T')[0]
            : new Date(row.purchase_date).toISOString().split('T')[0];
        }

        breakdown[key] = {
          date: key,
          totalQuantity: parseInt(row.totalQuantity) || 0,
          totalSales: parseFloat(row.totalSales) || 0,
          orderCount: parseInt(row.orderCount) || 0,
          aov: 0
        };
        totalQuantity += breakdown[key].totalQuantity;
        totalSales += breakdown[key].totalSales;
        totalOrders += breakdown[key].orderCount;
      }
    });

    let monthlyTotals = null;
    let totalSalesUsdSummary = null;
    if (groupByCountryDates) {
      Object.keys(breakdown).forEach(countryKey => {
        breakdown[countryKey].forEach(item => {
          item.aov = item.orderCount > 0 ? Number((item.totalSales / item.orderCount).toFixed(2)) : 0;
        });
        breakdown[countryKey].sort((a, b) => {
          const dateA = a.date.length === 7 ? a.date + '-01' : a.date;
          const dateB = b.date.length === 7 ? b.date + '-01' : b.date;
          return new Date(dateA) - new Date(dateB);
        });
      });
      monthlyTotals = await computeMonthlyTotals(breakdown, countryCurrencyLookup);
      applyUsdToBreakdown(breakdown, monthlyTotals);
      totalSalesUsdSummary = summarizeUsdTotals(monthlyTotals);
    } else {
      Object.keys(breakdown).forEach(key => {
        const item = breakdown[key];
        item.aov = item.orderCount > 0 ? (item.totalSales / item.orderCount) : 0;
        item.aov = Number(item.aov.toFixed(2));
      });
    }

    // Query previous year data (same structure as current)
    let previousYearBreakdown = {};
    let previousYearTotalQuantity = 0, previousYearTotalSales = 0, previousYearTotalOrders = 0;
    const previousYearDateCondition = (previousYearStartDate && previousYearEndDate)
      ? `
        AND CAST(purchase_date AS DATE) >= @previousYearStartDate 
        AND CAST(purchase_date AS DATE) <= @previousYearEndDate
      `
      : '';

    if (previousYearDateCondition && currentStartDate && currentEndDate) {
      let previousYearQuery;
      const previousYearCountryCurrencyLookup = {};
      
      if (groupByCountryDates) {
        if (shouldGroupByMonth) {
          previousYearQuery = `
            SELECT
              ISNULL(country, 'Unknown') AS country,
              FORMAT(purchase_date, 'yyyy-MM') AS purchase_month,
              MAX(currency) AS currency,
              SUM(CAST(quantity AS INT)) AS totalQuantity,
              SUM(CAST(total_sales AS FLOAT)) AS totalSales,
              COUNT(DISTINCT order_id) AS orderCount
            FROM std_orders
            WHERE ${whereClause}
            ${previousYearDateCondition}
            GROUP BY ISNULL(country, 'Unknown'), FORMAT(purchase_date, 'yyyy-MM')
            ORDER BY country, purchase_month
          `;
        } else {
          previousYearQuery = `
            SELECT
              ISNULL(country, 'Unknown') AS country,
              CAST(purchase_date AS DATE) AS purchase_date,
              MAX(currency) AS currency,
              SUM(CAST(quantity AS INT)) AS totalQuantity,
              SUM(CAST(total_sales AS FLOAT)) AS totalSales,
              COUNT(DISTINCT order_id) AS orderCount
            FROM std_orders
            WHERE ${whereClause}
            ${previousYearDateCondition}
            GROUP BY ISNULL(country, 'Unknown'), CAST(purchase_date AS DATE)
            ORDER BY country, purchase_date
          `;
        }
      } else {
        if (shouldGroupByMonth) {
          previousYearQuery = `
            SELECT
              FORMAT(purchase_date, 'yyyy-MM') AS purchase_month,
              MAX(currency) AS currency,
              SUM(CAST(quantity AS INT)) AS totalQuantity,
              SUM(CAST(total_sales AS FLOAT)) AS totalSales,
              COUNT(DISTINCT order_id) AS orderCount
            FROM std_orders
            WHERE ${whereClause}
            ${previousYearDateCondition}
            GROUP BY FORMAT(purchase_date, 'yyyy-MM')
            ORDER BY purchase_month
          `;
        } else {
          previousYearQuery = `
            SELECT
              CAST(purchase_date AS DATE) AS purchase_date,
              MAX(currency) AS currency,
              SUM(CAST(quantity AS INT)) AS totalQuantity,
              SUM(CAST(total_sales AS FLOAT)) AS totalSales,
              COUNT(DISTINCT order_id) AS orderCount
            FROM std_orders
            WHERE ${whereClause}
            ${previousYearDateCondition}
            GROUP BY CAST(purchase_date AS DATE)
            ORDER BY purchase_date
          `;
        }
      }

      const previousYearRequest = pool.request()
        .input('previousYearStartDate', sql.Date, previousYearStartDate)
        .input('previousYearEndDate', sql.Date, previousYearEndDate);
      
      const previousYearResult = await previousYearRequest.query(previousYearQuery);

      previousYearResult.recordset.forEach(row => {
        if (groupByCountryDates) {
          const countryKey = row.country || 'Unknown';
          let dateKey;
          if (shouldGroupByMonth) {
            dateKey = row.purchase_month || (row.purchase_date ? 
              (row.purchase_date instanceof Date ? 
                row.purchase_date.toISOString().substring(0, 7) : 
                new Date(row.purchase_date).toISOString().substring(0, 7)) : 
              '');
          } else {
            dateKey = row.purchase_date instanceof Date
              ? row.purchase_date.toISOString().split('T')[0]
              : new Date(row.purchase_date).toISOString().split('T')[0];
          }
          const rowCurrency = (row.currency || countryCurrencyFallback[countryKey] || '').toUpperCase();

          if (!previousYearBreakdown[countryKey]) {
            previousYearBreakdown[countryKey] = [];
          }
          if (rowCurrency && !previousYearCountryCurrencyLookup[countryKey]) {
            previousYearCountryCurrencyLookup[countryKey] = rowCurrency;
          }

          const entry = {
            date: dateKey,
            totalQuantity: parseInt(row.totalQuantity) || 0,
            totalSales: parseFloat(row.totalSales) || 0,
            orderCount: parseInt(row.orderCount) || 0,
            aov: 0
          };

          previousYearBreakdown[countryKey].push(entry);
          previousYearTotalQuantity += entry.totalQuantity;
          previousYearTotalSales += entry.totalSales;
          previousYearTotalOrders += entry.orderCount;
        } else {
          let key;
          if (shouldGroupByMonth) {
            key = row.purchase_month || (row.purchase_date ? 
              (row.purchase_date instanceof Date ? 
                row.purchase_date.toISOString().substring(0, 7) : 
                new Date(row.purchase_date).toISOString().substring(0, 7)) : 
              '');
          } else {
            key = row.purchase_date instanceof Date
              ? row.purchase_date.toISOString().split('T')[0]
              : new Date(row.purchase_date).toISOString().split('T')[0];
          }

          previousYearBreakdown[key] = {
            date: key,
            totalQuantity: parseInt(row.totalQuantity) || 0,
            totalSales: parseFloat(row.totalSales) || 0,
            orderCount: parseInt(row.orderCount) || 0,
            aov: 0
          };
          previousYearTotalQuantity += previousYearBreakdown[key].totalQuantity;
          previousYearTotalSales += previousYearBreakdown[key].totalSales;
          previousYearTotalOrders += previousYearBreakdown[key].orderCount;
        }
      });

      // Calculate AOV for previous year data
      if (groupByCountryDates) {
        Object.keys(previousYearBreakdown).forEach(countryKey => {
          previousYearBreakdown[countryKey].forEach(item => {
            item.aov = item.orderCount > 0 ? Number((item.totalSales / item.orderCount).toFixed(2)) : 0;
          });
          previousYearBreakdown[countryKey].sort((a, b) => {
            const dateA = a.date.length === 7 ? a.date + '-01' : a.date;
            const dateB = b.date.length === 7 ? b.date + '-01' : b.date;
            return new Date(dateA) - new Date(dateB);
          });
        });
      } else {
        Object.keys(previousYearBreakdown).forEach(key => {
          const item = previousYearBreakdown[key];
          item.aov = item.orderCount > 0 ? (item.totalSales / item.orderCount) : 0;
          item.aov = Number(item.aov.toFixed(2));
        });
      }
    }

    let previous = { totalQuantity: 0, totalSales: 0, orderCount: 0 };
    const previousDateCondition = (previousStartDate && previousEndDate)
      ? `
        AND CAST(purchase_date AS DATE) >= @previousStartDate 
        AND CAST(purchase_date AS DATE) <= @previousEndDate
      `
      : '';

    if (previousDateCondition) {
      const previousQuery = `
        SELECT
          SUM(CAST(quantity AS INT)) AS totalQuantity,
          SUM(CAST(total_sales AS FLOAT)) AS totalSales,
          COUNT(DISTINCT order_id) AS orderCount
        FROM std_orders
        WHERE ${whereClause}
        ${previousDateCondition}
      `;

      const previousRequest = pool.request()
        .input('previousStartDate', sql.Date, previousStartDate)
        .input('previousEndDate', sql.Date, previousEndDate);

      const previousResult = await previousRequest.query(previousQuery);
      previous = previousResult.recordset[0] || { totalQuantity: 0, totalSales: 0, orderCount: 0 };
    }

    const getPercentChange = (curr, prev) => {
      if (prev === 0) return "N/A";
      const diff = ((curr - prev) / prev) * 100;
      return (diff >= 0 ? diff.toFixed(2) + "% Gain" : diff.toFixed(2) + "% Loss");
    };

    // Prepare items array
    const items = groupByCountryDates
      ? breakdown
      : Object.values(breakdown).sort((a, b) => {
          // Sort by date/month - works for both YYYY-MM-DD and YYYY-MM formats
          const dateA = a.date.length === 7 ? a.date + '-01' : a.date;
          const dateB = b.date.length === 7 ? b.date + '-01' : b.date;
          return new Date(dateA) - new Date(dateB);
        });

    // Prepare previousItems array
    const previousItems = (previousYearStartDate && previousYearEndDate) ? (
      groupByCountryDates
        ? previousYearBreakdown
        : Object.values(previousYearBreakdown).sort((a, b) => {
            // Sort by date/month - works for both YYYY-MM-DD and YYYY-MM formats
            const dateA = a.date.length === 7 ? a.date + '-01' : a.date;
            const dateB = b.date.length === 7 ? b.date + '-01' : b.date;
            return new Date(dateA) - new Date(dateB);
          })
    ) : [];

    res.json({
      success: true,
      message: 'Orders line chart data retrieved successfully',
      data: {
        items,
        previousItems
      }, 
    });

  } catch (error) {
    console.error('Order line chart service error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getDropdownData = async (req, res) => {
  try {
    const { platform, country } = req.query;

    let databaseName = req.user?.databaseName || req.databaseName;
    if (!databaseName) {
      return res.status(400).json({
        success: false,
        error: 'Database name not found in token',
        message: 'Please ensure your JWT token contains the databaseName field.'
      });
    }
    req.databaseName = databaseName;

    const pool = await getConnection(req);

    // Build WHERE conditions
    let whereConditions = [];
    if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
    if (country) whereConditions.push(`country LIKE '%${country}%'`);

    const whereClause = whereConditions.join(' AND ');

    // Get distinct SKUs
    const skuQuery = `SELECT DISTINCT sku FROM std_orders WHERE ${whereClause} AND sku IS NOT NULL`;
    const skuResult = await pool.request().query(skuQuery);
    const skuList = skuResult.recordset.map(row => row.sku).filter(sku => sku);

    // Get distinct categories
    const categoryQuery = `SELECT DISTINCT product_category FROM std_orders WHERE ${whereClause} AND product_category IS NOT NULL`;
    const categoryResult = await pool.request().query(categoryQuery);
    const categoryList = categoryResult.recordset.map(row => row.product_category).filter(category => category);

    // Get distinct product names
    const productNameQuery = `SELECT DISTINCT product_name FROM std_orders WHERE ${whereClause} AND product_name IS NOT NULL`;
    const productNameResult = await pool.request().query(productNameQuery);
    const productNameList = productNameResult.recordset.map(row => row.product_name).filter(name => name);

    res.json({
      success: true,
      message: 'Dropdown data retrieved successfully',
      data: {
        skuList,
        categoryList,
        productNameList
      }
    });

  } catch (error) {
    console.error('Dropdown service error:', error);
    res.status(500).json({ error: error.message });
  }
};