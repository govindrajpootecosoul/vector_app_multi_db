// const sql = require('mssql');
// const { getConnection } = require('../utils/database');

// exports.getOrderListByDatabase = async (req, res) => {
//   try {
//     const {
//       sku,
//       product_category,
//       product_name,
//       platform,
//       country,
//       filterType,
//       fromDate,
//       toDate,
//       startMonth,
//       endMonth
//     } = req.query;

//     const client_id = req.user.client_id;

//     // Check if custom date range is provided, if not, require filterType
//     const hasCustomRange = (startMonth && endMonth) || (fromDate && toDate);

//     if (!hasCustomRange && !filterType) {
//       return res.status(400).json({
//         status: 400,
//         message: "Provide a valid filterType query parameter or body field, or use custom date range with startMonth/endMonth or fromDate/toDate.",
//         success: false,
//         data: {
//           code: "BAD_REQUEST",
//           message: "filterType is required when no custom date range is provided",
//           details: "Provide a valid filterType or use startMonth/endMonth (YYYY-MM) or fromDate/toDate (YYYY-MM-DD) for custom ranges."
//         },
//         timestamp: new Date().toISOString()
//       });
//     }

//     const pool = await getConnection(req);

//     const today = new Date();
//     console.log('Today\'s date:', today.toISOString());

//     let currentStartDate, currentEndDate;

//     // Use UTC for consistent date handling
//     const currentYear = today.getUTCFullYear();
//     const currentMonth = today.getUTCMonth();

//     // Helper function to parse YYYY-MM format
//     const parseMonthYear = (monthYearStr) => {
//       if (!monthYearStr || !monthYearStr.includes('-')) return null;
//       const [year, month] = monthYearStr.split('-').map(s => parseInt(s.trim()));
//       if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;
//       return { month: month - 1, year }; // month is 0-indexed in JS Date
//     };

//     // Filter ranges
//     if (startMonth && endMonth) {
//       // Custom range: YYYY-MM to YYYY-MM
//       const startParsed = parseMonthYear(startMonth);
//       const endParsed = parseMonthYear(endMonth);

//       if (startParsed && endParsed) {
//         currentStartDate = new Date(Date.UTC(startParsed.year, startParsed.month, 1));
//         currentEndDate = new Date(Date.UTC(endParsed.year, endParsed.month + 1, 0, 23, 59, 59, 999));
//       } else {
//         // Invalid format, fallback to current month
//         currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
//         currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
//       }
//     } else if (fromDate && toDate) {
//       // Direct date range
//       currentStartDate = new Date(fromDate);
//       currentEndDate = new Date(toDate);
//       currentEndDate.setHours(23, 59, 59, 999);
//     } else {
//       switch (filterType) {
//         case "currentmonth": {
//           // Current month: from 1st to last day of current month
//           currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
//           currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
//           break;
//         }
//         case "previousmonth": {
//           // Previous month: full previous month
//           const previousMonth = currentMonth - 1;
//           const lastyear = previousMonth < 0 ? currentYear - 1 : currentYear;
//           const adjustedPrevMonth = (previousMonth + 12) % 12;
//           currentStartDate = new Date(Date.UTC(lastyear, adjustedPrevMonth, 1));
//           currentEndDate = new Date(Date.UTC(lastyear, adjustedPrevMonth + 1, 0, 23, 59, 59, 999));
//           break;
//         }
//         case "currentyear": {
//           // Current year: from Jan 1st to Dec 31st of current year
//           currentStartDate = new Date(Date.UTC(currentYear, 0, 1)); // January 1st
//           currentEndDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)); // December 31st
//           break;
//         }
//         case "lastyear": {
//           // Previous year: from Jan 1st to Dec 31st of previous year
//           currentStartDate = new Date(Date.UTC(currentYear - 1, 0, 1)); // January 1st of previous year
//           currentEndDate = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59, 999)); // December 31st of previous year
//           break;
//         }
//         case "6months":
//         default: {
//           return res.status(400).json({
//             status: 400,
//             message: "Provide a valid filterType such as currentmonth, previousmonth, currentyear, or lastyear.",
//             success: false,
//             data: {
//               code: "BAD_REQUEST",
//               message: `Invalid filterType: ${filterType}`,
//               details: "Provide a valid filterType such as currentmonth, previousmonth, currentyear, or lastyear."
//             },
//             timestamp: new Date().toISOString()
//           });
//         }
//       }
//     }

//     // Build WHERE conditions
//     let whereConditions = [`client_id = '${client_id}'`];
//     if (sku) whereConditions.push(`sku IN (${sku.split(",").map(s => `'${s.trim()}'`).join(",")})`);
//     if (product_category) whereConditions.push(`product_category = '${product_category}'`);
//     if (product_name) whereConditions.push(`product_name = '${product_name}'`);
//     if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
//     if (country) whereConditions.push(`country LIKE '%${country}%'`);

//     const whereClause = whereConditions.join(' AND ');

//     console.log('WHERE clause:', whereClause);
//     console.log('Date range:', { currentStartDate, currentEndDate });

//     // SQL query for current period
//     const currentQuery = `
//       SELECT
//         sku,
//         product_name,
//         product_category,
//         SUM(CAST(quantity AS INT)) as sold_qty,
//         SUM(CAST(total_sales AS FLOAT)) as revenue,
//         MAX(purchase_date) as latest_purchase_date
//       FROM std_orders
//       WHERE ${whereClause} AND purchase_date >= @currentStartDate AND purchase_date <= @currentEndDate AND order_status != 'Cancelled'
//       GROUP BY sku, product_name, product_category
//       ORDER BY latest_purchase_date DESC
//     `;

//     const currentResult = await pool.request()
//       .input('currentStartDate', sql.Date, currentStartDate)
//       .input('currentEndDate', sql.Date, currentEndDate)
//       .query(currentQuery);

//     const skudata = currentResult.recordset;

//     res.json({
//       success: true,
//       message: 'Order list retrieved successfully',
//       data: { skudata }
//     });

//   } catch (error) {
//     console.error('Order list service error:', error);
//     res.status(500).json({ error: error.message });
//   }
// };


// exports.getOrdersByDatabase = async (req, res) => {
//   try {
//     const {
//       sku,
//       platform,
//       filterType,
//       purchase_date, // Support legacy parameter name
//       fromDate,
//       toDate,
//       startMonth,
//       endMonth,
//       state,
//       city,
//       country
//     } = req.query;

//     const client_id = req.user.client_id;

//     // Check if custom date range is provided, if not, require filterType
//     const hasCustomRange = (startMonth && endMonth) || (fromDate && toDate);

//     if (!hasCustomRange && !filterType) {
//       return res.status(400).json({
//         status: 400,
//         error: {
//           code: "BAD_REQUEST",
//           message: "filterType is required when no custom date range is provided",
//           details: "Provide a valid filterType or use startMonth/endMonth (YYYY-MM) or fromDate/toDate (YYYY-MM-DD) for custom ranges."
//         },
//         timestamp: new Date().toISOString()
//       });
//     }

//     // Use purchase_date if provided, otherwise use filterType
//     const effectiveFilterType = purchase_date || filterType;

//     const pool = await getConnection(req);

//     const today = new Date();
//     console.log('Today\'s date:', today.toISOString());

//     let currentStartDate, currentEndDate;
//     let previousStartDate, previousEndDate;

//     // Use UTC for consistent date handling
//     const currentYear = today.getUTCFullYear();
//     const currentMonth = today.getUTCMonth();

//     // Helper function to parse YYYY-MM format
//     const parseMonthYear = (monthYearStr) => {
//       if (!monthYearStr || !monthYearStr.includes('-')) return null;
//       const [year, month] = monthYearStr.split('-').map(s => parseInt(s.trim()));
//       if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;
//       return { month: month - 1, year }; // month is 0-indexed in JS Date
//     };

//     // Filter ranges
//     if (startMonth && endMonth) {
//       // Custom range: YYYY-MM to YYYY-MM
//       const startParsed = parseMonthYear(startMonth);
//       const endParsed = parseMonthYear(endMonth);

//       if (startParsed && endParsed) {
//         currentStartDate = new Date(Date.UTC(startParsed.year, startParsed.month, 1));
//         currentEndDate = new Date(Date.UTC(endParsed.year, endParsed.month + 1, 0, 23, 59, 59, 999));

//         // Calculate previous period with same duration
//         const duration = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24) + 1;
//         previousEndDate = new Date(currentStartDate.getTime() - 1);
//         previousStartDate = new Date(previousEndDate.getTime() - (duration - 1) * 86400000);
//       } else {
//         // Invalid format, fallback to current month
//         currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
//         currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
//         const previousMonth = currentMonth - 1;
//         const lastyear = previousMonth < 0 ? currentYear - 1 : currentYear;
//         const adjustedPrevMonth = (previousMonth + 12) % 12;
//         previousStartDate = new Date(Date.UTC(lastyear, adjustedPrevMonth, 1));
//         previousEndDate = new Date(Date.UTC(lastyear, adjustedPrevMonth + 1, 0, 23, 59, 59, 999));
//       }
//     } else if (fromDate && toDate) {
//       // Direct date range
//       currentStartDate = new Date(fromDate);
//       currentEndDate = new Date(toDate);
//       currentEndDate.setHours(23, 59, 59, 999);

//       // Calculate previous period with same duration
//       const duration = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24) + 1;
//       previousEndDate = new Date(currentStartDate.getTime() - 1);
//       previousStartDate = new Date(previousEndDate.getTime() - (duration - 1) * 86400000);
//     } else {
//       switch (effectiveFilterType) {
//         case "currentmonth": {
//           // Current month: from 1st to last day of current month
//           currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
//           currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));

//           // Previous month for comparison
//           const previousMonth = currentMonth - 1;
//           const lastyear = previousMonth < 0 ? currentYear - 1 : currentYear;
//           const adjustedPrevMonth = (previousMonth + 12) % 12;

//           previousStartDate = new Date(Date.UTC(lastyear, adjustedPrevMonth, 1));
//           previousEndDate = new Date(Date.UTC(lastyear, adjustedPrevMonth + 1, 0, 23, 59, 59, 999));
//           break;
//         }
//         case "previousmonth": {
//           // Previous month: full previous month
//           const previousMonth = currentMonth - 1;
//           const lastyear = previousMonth < 0 ? currentYear - 1 : currentYear;
//           const adjustedPrevMonth = (previousMonth + 12) % 12;
//           currentStartDate = new Date(Date.UTC(lastyear, adjustedPrevMonth, 1));
//           currentEndDate = new Date(Date.UTC(lastyear, adjustedPrevMonth + 1, 0, 23, 59, 59, 999));

//           // Month before previous for comparison
//           const monthBeforeLast = adjustedPrevMonth - 1;
//           const yearBeforeLast = monthBeforeLast < 0 ? lastyear - 1 : lastyear;
//           const adjustedMonthBeforeLast = (monthBeforeLast + 12) % 12;
//           previousStartDate = new Date(Date.UTC(yearBeforeLast, adjustedMonthBeforeLast, 1));
//           previousEndDate = new Date(Date.UTC(yearBeforeLast, adjustedMonthBeforeLast + 1, 0, 23, 59, 59, 999));
//           break;
//         }
//         case "currentyear": {
//           // Current year: from Jan 1st to Dec 31st of current year
//           currentStartDate = new Date(Date.UTC(currentYear, 0, 1)); // January 1st
//           currentEndDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)); // December 31st

//           // Previous year for comparison
//           previousStartDate = new Date(Date.UTC(currentYear - 1, 0, 1)); // January 1st of previous year
//           previousEndDate = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59, 999)); // December 31st of previous year
//           break;
//         }
//         case "lastyear": {
//           // Previous year: from Jan 1st to Dec 31st of previous year
//           currentStartDate = new Date(Date.UTC(currentYear - 1, 0, 1)); // January 1st of previous year
//           currentEndDate = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59, 999)); // December 31st of previous year

//           // Year before previous for comparison
//           previousStartDate = new Date(Date.UTC(currentYear - 2, 0, 1)); // January 1st of year before previous
//           previousEndDate = new Date(Date.UTC(currentYear - 2, 11, 31, 23, 59, 59, 999)); // December 31st of year before previous
//           break;
//         }
//         case "6months":
//         default: {
//           return res.status(400).json({
//             status: 400,
//             error: {
//               code: "BAD_REQUEST",
//               message: `Invalid filterType: ${effectiveFilterType}`,
//               details: "Provide a valid filterType such as currentmonth, previousmonth, currentyear, or lastyear."
//             },
//             timestamp: new Date().toISOString()
//           });
//         }
//       }
//     }

//     // Build WHERE conditions
//     let whereConditions = [`client_id = '${client_id}'`];
//     if (sku) whereConditions.push(`sku IN (${sku.split(",").map(s => `'${s.trim()}'`).join(",")})`);
//     if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
//     if (state) whereConditions.push(`state = '${state}'`);
//     if (city) whereConditions.push(`city = '${city}'`);
//     if (country) whereConditions.push(`country LIKE '%${country}%'`);

//     const whereClause = whereConditions.join(' AND ');

//     console.log('WHERE clause:', whereClause);
//     console.log('Date range:', { currentStartDate, currentEndDate });

//     // SQL query for current period orders
//     const currentQuery = `
//       SELECT
//         CAST(purchase_date AS DATE) as purchase_date,
//         SUM(CAST(quantity AS INT)) as totalQuantity,
//         SUM(CAST(total_sales AS FLOAT)) as totalSales,
//         COUNT(DISTINCT order_id) as orderCount
//       FROM std_orders
//       WHERE ${whereClause} AND purchase_date >= @currentStartDate AND purchase_date <= @currentEndDate AND order_status != 'Cancelled'
//       GROUP BY CAST(purchase_date AS DATE)
//       ORDER BY CAST(purchase_date AS DATE)
//     `;

//     const currentResult = await pool.request()
//       .input('currentStartDate', sql.Date, currentStartDate)
//       .input('currentEndDate', sql.Date, currentEndDate)
//       .query(currentQuery);

//     let breakdown = {}, totalQuantity = 0, totalSales = 0, totalOrders = 0;

//     currentResult.recordset.forEach(row => {
//       const date = row.purchase_date.toISOString().split('T')[0];
//       breakdown[date] = {
//         date,
//         totalQuantity: parseInt(row.totalQuantity) || 0,
//         totalSales: parseFloat(row.totalSales) || 0,
//         orderCount: parseInt(row.orderCount) || 0,
//         aov: 0
//       };
//       totalQuantity += breakdown[date].totalQuantity;
//       totalSales += breakdown[date].totalSales;
//       totalOrders += breakdown[date].orderCount;
//     });

//     // Calculate AOV for each date
//     Object.keys(breakdown).forEach(key => {
//       const item = breakdown[key];
//       item.aov = item.orderCount > 0 ? (item.totalSales / item.orderCount) : 0;
//       item.aov = Number(item.aov.toFixed(2));
//     });

//     // SQL query for previous period
//     const previousQuery = `
//       SELECT
//         SUM(CAST(quantity AS INT)) as totalQuantity,
//         SUM(CAST(total_sales AS FLOAT)) as totalSales,
//         COUNT(DISTINCT order_id) as orderCount
//       FROM std_orders
//       WHERE ${whereClause} AND purchase_date >= @previousStartDate AND purchase_date <= @previousEndDate AND order_status != 'Cancelled'
//     `;

//     const previousResult = await pool.request()
//       .input('previousStartDate', sql.Date, previousStartDate)
//       .input('previousEndDate', sql.Date, previousEndDate)
//       .query(previousQuery);

//     const previous = previousResult.recordset[0] || { totalQuantity: 0, totalSales: 0, orderCount: 0 };

//     // Calculate percentage change
//     const getPercentChange = (curr, prev) => {
//       if (prev === 0) return "N/A";
//       const diff = ((curr - prev) / prev) * 100;
//       return (diff >= 0 ? diff.toFixed(2) + "% Gain" : diff.toFixed(2) + "% Loss");
//     };

//     // Calculate AOV as average of per-date AOVs
//     let totalAovSum = 0;
//     let dateCount = Object.keys(breakdown).length;
//     Object.keys(breakdown).forEach(key => {
//       totalAovSum += breakdown[key].aov;
//     });
//     const currentAOV = dateCount > 0 ? totalAovSum / dateCount : 0;
//     const previousAOV = previous.orderCount > 0 ? previous.totalSales / previous.orderCount : 0;

//     res.json({
//       success: true,
//       message: 'Orders retrieved successfully',
//       data: {
//         totalQuantity,
//         totalSales,
//         totalOrders,
//         aov: currentAOV.toFixed(2),
//         items: Object.values(breakdown).sort((a, b) => new Date(a.date) - new Date(b.date)),
//         comparison: {
//           currentPeriod: { startDate: currentStartDate, endDate: currentEndDate },
//           previousPeriod: { startDate: previousStartDate, endDate: previousEndDate },
//           previousTotalQuantity: previous.totalQuantity,
//           previousTotalSales: previous.totalSales,
//           previousTotalOrders: previous.orderCount,
//           previousAOV: previousAOV.toFixed(2),
//           quantityChangePercent: getPercentChange(totalQuantity, previous.totalQuantity),
//           salesChangePercent: getPercentChange(totalSales, previous.totalSales),
//           ordersChangePercent: getPercentChange(totalOrders, previous.orderCount),
//           aovChangePercent: getPercentChange(currentAOV, previousAOV),
//         }
//       },
//     });

//   } catch (error) {
//     console.error('Order service error:', error);
//     res.status(500).json({ error: error.message });
//   }
// };

// exports.getDropdownData = async (req, res) => {
//   try {
//     const { platform, country } = req.query;
//     const client_id = req.user.client_id;

//     const pool = await getConnection(req);

//     // Build WHERE conditions
//     let whereConditions = [`client_id = '${client_id}'`];
//     if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
//     if (country) whereConditions.push(`country LIKE '%${country}%'`);

//     const whereClause = whereConditions.join(' AND ');

//     // Get distinct SKUs
//     const skuQuery = `SELECT DISTINCT sku FROM std_orders WHERE ${whereClause} AND sku IS NOT NULL`;
//     const skuResult = await pool.request().query(skuQuery);
//     const skuList = skuResult.recordset.map(row => row.sku).filter(sku => sku);

//     // Get distinct categories
//     const categoryQuery = `SELECT DISTINCT product_category FROM std_orders WHERE ${whereClause} AND product_category IS NOT NULL`;
//     const categoryResult = await pool.request().query(categoryQuery);
//     const categoryList = categoryResult.recordset.map(row => row.product_category).filter(category => category);

//     // Get distinct product names
//     const productNameQuery = `SELECT DISTINCT product_name FROM std_orders WHERE ${whereClause} AND product_name IS NOT NULL`;
//     const productNameResult = await pool.request().query(productNameQuery);
//     const productNameList = productNameResult.recordset.map(row => row.product_name).filter(name => name);

//     res.json({
//       success: true,
//       message: 'Dropdown data retrieved successfully',
//       data: {
//         skuList,
//         categoryList,
//         productNameList
//       }
//     });

//   } catch (error) {
//     console.error('Dropdown service error:', error);
//     res.status(500).json({ error: error.message });
//   }
// };



const sql = require('mssql');
const { getConnection } = require('../utils/database');

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

    if (!hasCustomRange && !filterType) {
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
    } else {
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
    }

    // Build WHERE conditions
    let whereConditions = [];
    if (sku) whereConditions.push(`sku IN (${sku.split(",").map(s => `'${s.trim()}'`).join(",")})`);
    if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
    if (state) whereConditions.push(`state = '${state}'`);
    if (city) whereConditions.push(`city = '${city}'`);
    if (country) whereConditions.push(`country LIKE '%${country}%'`);
    const whereClause = whereConditions.join(' AND ');

    // SQL query for current period — cast to DATE to ignore time
    const currentQuery = `
      SELECT
        CAST(purchase_date AS DATE) AS purchase_date,
        SUM(CAST(quantity AS INT)) AS totalQuantity,
        SUM(CAST(total_sales AS FLOAT)) AS totalSales,
        COUNT(DISTINCT order_id) AS orderCount
      FROM std_orders
      WHERE ${whereClause} 
        AND CAST(purchase_date AS DATE) >= @currentStartDate 
        AND CAST(purchase_date AS DATE) <= @currentEndDate
      GROUP BY CAST(purchase_date AS DATE)
      ORDER BY purchase_date
    `;

    const currentResult = await pool.request()
      .input('currentStartDate', sql.Date, currentStartDate)
      .input('currentEndDate', sql.Date, currentEndDate)
      .query(currentQuery);

    let breakdown = {}, totalQuantity = 0, totalSales = 0, totalOrders = 0;

    currentResult.recordset.forEach(row => {
      const date = row.purchase_date.toISOString().split('T')[0];
      breakdown[date] = {
        date,
        totalQuantity: parseInt(row.totalQuantity) || 0,
        totalSales: parseFloat(row.totalSales) || 0,
        orderCount: parseInt(row.orderCount) || 0,
        aov: 0
      };
      totalQuantity += breakdown[date].totalQuantity;
      totalSales += breakdown[date].totalSales;
      totalOrders += breakdown[date].orderCount;
    });

    Object.keys(breakdown).forEach(key => {
      const item = breakdown[key];
      item.aov = item.orderCount > 0 ? (item.totalSales / item.orderCount) : 0;
      item.aov = Number(item.aov.toFixed(2));
    });

    // SQL query for previous period
    const previousQuery = `
      SELECT
        SUM(CAST(quantity AS INT)) AS totalQuantity,
        SUM(CAST(total_sales AS FLOAT)) AS totalSales,
        COUNT(DISTINCT order_id) AS orderCount
      FROM std_orders
      WHERE ${whereClause} 
        AND CAST(purchase_date AS DATE) >= @previousStartDate 
        AND CAST(purchase_date AS DATE) <= @previousEndDate
    `;

    const previousResult = await pool.request()
      .input('previousStartDate', sql.Date, previousStartDate)
      .input('previousEndDate', sql.Date, previousEndDate)
      .query(previousQuery);

    const previous = previousResult.recordset[0] || { totalQuantity: 0, totalSales: 0, orderCount: 0 };

    const getPercentChange = (curr, prev) => {
      if (prev === 0) return "N/A";
      const diff = ((curr - prev) / prev) * 100;
      return (diff >= 0 ? diff.toFixed(2) + "% Gain" : diff.toFixed(2) + "% Loss");
    };

    const currentAOV = totalOrders > 0 ? totalSales / totalOrders : 0;
    const previousAOV = previous.orderCount > 0 ? previous.totalSales / previous.orderCount : 0;

    res.json({
      success: true,
      message: 'Orders retrieved successfully',
      data: {
        totalQuantity,
        totalSales,
        totalOrders,
        aov: currentAOV.toFixed(2),
        items: Object.values(breakdown).sort((a, b) => new Date(a.date) - new Date(b.date)),
        comparison: {
          currentPeriod: { startDate: currentStartDate, endDate: currentEndDate },
          previousPeriod: { startDate: previousStartDate, endDate: previousEndDate },
          previousTotalQuantity: previous.totalQuantity,
          previousTotalSales: previous.totalSales,
          previousTotalOrders: previous.orderCount,
          previousAOV: previousAOV.toFixed(2),
          quantityChangePercent: getPercentChange(totalQuantity, previous.totalQuantity),
          salesChangePercent: getPercentChange(totalSales, previous.totalSales),
          ordersChangePercent: getPercentChange(totalOrders, previous.orderCount),
          aovChangePercent: getPercentChange(currentAOV, previousAOV),
        }
      },
    });

  } catch (error) {
    console.error('Order service error:', error);
    res.status(500).json({ error: error.message });
  }
};


// exports.getOrdersByDatabase = async (req, res) => {
//   try {
//     const {
//       sku,
//       platform,
//       filterType,
//       purchase_date, // Support legacy parameter name
//       fromDate,
//       toDate,
//       startMonth,
//       endMonth,
//       state,
//       city,
//       country
//     } = req.query;

//     const client_id = req.user.client_id;

//     // Check if custom date range is provided, if not, require filterType
//     const hasCustomRange = (startMonth && endMonth) || (fromDate && toDate);

//     if (!hasCustomRange && !filterType) {
//       return res.status(400).json({
//         status: 400,
//         error: {
//           code: "BAD_REQUEST",
//           message: "filterType is required when no custom date range is provided",
//           details: "Provide a valid filterType or use startMonth/endMonth (YYYY-MM) or fromDate/toDate (YYYY-MM-DD) for custom ranges."
//         },
//         timestamp: new Date().toISOString()
//       });
//     }

//     // Use purchase_date if provided, otherwise use filterType
//     const effectiveFilterType = purchase_date || filterType;

//     const pool = await getConnection(req);

//     const today = new Date();
//     console.log('Today\'s date:', today.toISOString());

//     let currentStartDate, currentEndDate;
//     let previousStartDate, previousEndDate;

//     // Use UTC for consistent date handling
//     const currentYear = today.getUTCFullYear();
//     const currentMonth = today.getUTCMonth();

//     // Helper function to parse YYYY-MM format
//     const parseMonthYear = (monthYearStr) => {
//       if (!monthYearStr || !monthYearStr.includes('-')) return null;
//       const [year, month] = monthYearStr.split('-').map(s => parseInt(s.trim()));
//       if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;
//       return { month: month - 1, year }; // month is 0-indexed in JS Date
//     };

//     // Filter ranges
//     if (startMonth && endMonth) {
//       // Custom range: YYYY-MM to YYYY-MM
//       const startParsed = parseMonthYear(startMonth);
//       const endParsed = parseMonthYear(endMonth);

//       if (startParsed && endParsed) {
//         currentStartDate = new Date(Date.UTC(startParsed.year, startParsed.month, 1));
//         currentEndDate = new Date(Date.UTC(endParsed.year, endParsed.month + 1, 0, 23, 59, 59, 999));

//         // Calculate previous period with same duration
//         const duration = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24) + 1;
//         previousEndDate = new Date(currentStartDate.getTime() - 1);
//         previousStartDate = new Date(previousEndDate.getTime() - (duration - 1) * 86400000);
//       } else {
//         // Invalid format, fallback to current month
//         currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
//         currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
//         const previousMonth = currentMonth - 1;
//         const lastyear = previousMonth < 0 ? currentYear - 1 : currentYear;
//         const adjustedPrevMonth = (previousMonth + 12) % 12;
//         previousStartDate = new Date(Date.UTC(lastyear, adjustedPrevMonth, 1));
//         previousEndDate = new Date(Date.UTC(lastyear, adjustedPrevMonth + 1, 0, 23, 59, 59, 999));
//       }
//     } else if (fromDate && toDate) {
//       // Direct date range
//       currentStartDate = new Date(fromDate);
//       currentEndDate = new Date(toDate);
//       currentEndDate.setHours(23, 59, 59, 999);

//       // Calculate previous period with same duration
//       const duration = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24) + 1;
//       previousEndDate = new Date(currentStartDate.getTime() - 1);
//       previousStartDate = new Date(previousEndDate.getTime() - (duration - 1) * 86400000);
//     } else {
//       switch (effectiveFilterType) {
//         case "currentmonth": {
//           // Current month: from 1st to last day of current month
//           currentStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
//           currentEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));

//           // Previous month for comparison
//           const previousMonth = currentMonth - 1;
//           const lastyear = previousMonth < 0 ? currentYear - 1 : currentYear;
//           const adjustedPrevMonth = (previousMonth + 12) % 12;

//           previousStartDate = new Date(Date.UTC(lastyear, adjustedPrevMonth, 1));
//           previousEndDate = new Date(Date.UTC(lastyear, adjustedPrevMonth + 1, 0, 23, 59, 59, 999));
//           break;
//         }
//         case "previousmonth": {
//           // Previous month: full previous month
//           const previousMonth = currentMonth - 1;
//           const lastyear = previousMonth < 0 ? currentYear - 1 : currentYear;
//           const adjustedPrevMonth = (previousMonth + 12) % 12;
//           currentStartDate = new Date(Date.UTC(lastyear, adjustedPrevMonth, 1));
//           currentEndDate = new Date(Date.UTC(lastyear, adjustedPrevMonth + 1, 0, 23, 59, 59, 999));

//           // Month before previous for comparison
//           const monthBeforeLast = adjustedPrevMonth - 1;
//           const yearBeforeLast = monthBeforeLast < 0 ? lastyear - 1 : lastyear;
//           const adjustedMonthBeforeLast = (monthBeforeLast + 12) % 12;
//           previousStartDate = new Date(Date.UTC(yearBeforeLast, adjustedMonthBeforeLast, 1));
//           previousEndDate = new Date(Date.UTC(yearBeforeLast, adjustedMonthBeforeLast + 1, 0, 23, 59, 59, 999));
//           break;
//         }
//         case "currentyear": {
//           // Current year: from Jan 1st to Dec 31st of current year
//           currentStartDate = new Date(Date.UTC(currentYear, 0, 1)); // January 1st
//           currentEndDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)); // December 31st

//           // Previous year for comparison
//           previousStartDate = new Date(Date.UTC(currentYear - 1, 0, 1)); // January 1st of previous year
//           previousEndDate = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59, 999)); // December 31st of previous year
//           break;
//         }
//         case "lastyear": {
//           // Previous year: from Jan 1st to Dec 31st of previous year
//           currentStartDate = new Date(Date.UTC(currentYear - 1, 0, 1)); // January 1st of previous year
//           currentEndDate = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59, 999)); // December 31st of previous year

//           // Year before previous for comparison
//           previousStartDate = new Date(Date.UTC(currentYear - 2, 0, 1)); // January 1st of year before previous
//           previousEndDate = new Date(Date.UTC(currentYear - 2, 11, 31, 23, 59, 59, 999)); // December 31st of year before previous
//           break;
//         }
//         case "6months":
//         default: {
//           return res.status(400).json({
//             status: 400,
//             error: {
//               code: "BAD_REQUEST",
//               message: `Invalid filterType: ${effectiveFilterType}`,
//               details: "Provide a valid filterType such as currentmonth, previousmonth, currentyear, or lastyear."
//             },
//             timestamp: new Date().toISOString()
//           });
//         }
//       }
//     }

//     // Build WHERE conditions
//     let whereConditions = [`client_id = '${client_id}'`];
//     if (sku) whereConditions.push(`sku IN (${sku.split(",").map(s => `'${s.trim()}'`).join(",")})`);
//     if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
//     if (state) whereConditions.push(`state = '${state}'`);
//     if (city) whereConditions.push(`city = '${city}'`);
//     if (country) whereConditions.push(`country LIKE '%${country}%'`);

//     const whereClause = whereConditions.join(' AND ');

//     console.log('WHERE clause:', whereClause);
//     console.log('Date range:', { currentStartDate, currentEndDate });

//     // SQL query for current period orders
//     const currentQuery = `
//       SELECT
//         purchase_date,
//         SUM(CAST(quantity AS INT)) as totalQuantity,
//         SUM(CAST(total_sales AS FLOAT)) as totalSales,
//         COUNT(DISTINCT order_id) as orderCount
//       FROM std_orders
//       WHERE ${whereClause} AND purchase_date >= @currentStartDate AND purchase_date <= @currentEndDate
//       GROUP BY purchase_date
//       ORDER BY purchase_date
//     `;

//     const currentResult = await pool.request()
//       .input('currentStartDate', sql.DateTime, currentStartDate)
//       .input('currentEndDate', sql.DateTime, currentEndDate)
//       .query(currentQuery);

//     let breakdown = {}, totalQuantity = 0, totalSales = 0, totalOrders = 0;

//     currentResult.recordset.forEach(row => {
//       const date = row.purchase_date.toISOString().split('T')[0];
//       breakdown[date] = {
//         date,
//         totalQuantity: parseInt(row.totalQuantity) || 0,
//         totalSales: parseFloat(row.totalSales) || 0,
//         orderCount: parseInt(row.orderCount) || 0,
//         aov: 0
//       };
//       totalQuantity += breakdown[date].totalQuantity;
//       totalSales += breakdown[date].totalSales;
//       totalOrders += breakdown[date].orderCount;
//     });

//     // Calculate AOV for each date
//     Object.keys(breakdown).forEach(key => {
//       const item = breakdown[key];
//       item.aov = item.orderCount > 0 ? (item.totalSales / item.orderCount) : 0;
//       item.aov = Number(item.aov.toFixed(2));
//     });

//     // SQL query for previous period
//     const previousQuery = `
//       SELECT
//         SUM(CAST(quantity AS INT)) as totalQuantity,
//         SUM(CAST(total_sales AS FLOAT)) as totalSales,
//         COUNT(DISTINCT order_id) as orderCount
//       FROM std_orders
//       WHERE ${whereClause} AND purchase_date >= @previousStartDate AND purchase_date <= @previousEndDate
//     `;

//     const previousResult = await pool.request()
//       .input('previousStartDate', sql.DateTime, previousStartDate)
//       .input('previousEndDate', sql.DateTime, previousEndDate)
//       .query(previousQuery);

//     const previous = previousResult.recordset[0] || { totalQuantity: 0, totalSales: 0, orderCount: 0 };

//     // Calculate percentage change
//     const getPercentChange = (curr, prev) => {
//       if (prev === 0) return "N/A";
//       const diff = ((curr - prev) / prev) * 100;
//       return (diff >= 0 ? diff.toFixed(2) + "% Gain" : diff.toFixed(2) + "% Loss");
//     };

//     // Calculate AOV
//     const currentAOV = totalOrders > 0 ? totalSales / totalOrders : 0;
//     const previousAOV = previous.orderCount > 0 ? previous.totalSales / previous.orderCount : 0;

//     res.json({
//       success: true,
//       message: 'Orders retrieved successfully...',
//       data: {
//         totalQuantity,
//         totalSales,
//         totalOrders,
//         aov: currentAOV.toFixed(2),
//         items: Object.values(breakdown).sort((a, b) => new Date(a.date) - new Date(b.date)),
//         comparison: {
//           currentPeriod: { startDate: currentStartDate, endDate: currentEndDate },
//           previousPeriod: { startDate: previousStartDate, endDate: previousEndDate },
//           previousTotalQuantity: previous.totalQuantity,
//           previousTotalSales: previous.totalSales,
//           previousTotalOrders: previous.orderCount,
//           previousAOV: previousAOV.toFixed(2),
//           quantityChangePercent: getPercentChange(totalQuantity, previous.totalQuantity),
//           salesChangePercent: getPercentChange(totalSales, previous.totalSales),
//           ordersChangePercent: getPercentChange(totalOrders, previous.orderCount),
//           aovChangePercent: getPercentChange(currentAOV, previousAOV),
//         }
//       },
//     });

//   } catch (error) {
//     console.error('Order service error:', error);
//     res.status(500).json({ error: error.message });
//   }
// };

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