/**
 * Tool Executor Service
 * Executes tool functions by calling existing service methods
 */

const { getConnection } = require('../../utils/database');
const sql = require('mssql');
const { formatDate, formatYearMonth, getCurrentYearMonth, getPreviousYearMonth, getCurrentYear, getCurrentYearNumber, getLastYear, getDateRangeFromFilterType } = require('../utils/dateHelper');

/**
 * Execute a tool function
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} parameters - Tool parameters
 * @param {Object} req - Express request object (for database connection)
 * @returns {Promise<Object>} Tool execution result
 */
const executeTool = async (toolName, parameters, req) => {
  try {
    // Ensure database name is set
    if (!req.databaseName) {
      req.databaseName = req.user?.databaseName;
    }
    
    if (!req.databaseName) {
      throw new Error('Database name not found in request');
    }

    const pool = await getConnection(req);

    switch (toolName) {
      case 'get_sales_data':
        return await executeGetSalesData(parameters, pool);
      
      case 'get_regional_sales':
        return await executeGetRegionalSales(parameters, pool);
      
      case 'get_inventory_data':
        return await executeGetInventoryData(parameters, pool);
      
      case 'get_pnl_data':
        return await executeGetPnlData(parameters, pool);
      
      case 'get_pnl_executive':
        return await executeGetPnlExecutive(parameters, pool);
      
      case 'get_ad_sales_spend':
        return await executeGetAdSalesSpend(parameters, pool);
      
      case 'get_orders_data':
        return await executeGetOrdersData(parameters, pool);
      
      case 'get_inventory_overstock':
        return await executeGetInventoryOverstock(parameters, pool);
      
      case 'get_inventory_understock':
        return await executeGetInventoryUnderstock(parameters, pool);
      
      case 'get_inventory_out_of_stock':
        return await executeGetInventoryOutOfStock(parameters, pool);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    throw error;
  }
};

/**
 * Execute get_sales_data tool
 */
const executeGetSalesData = async (params, pool) => {
  const { filterType, sku, productName, category, city, state, country, platform, startDate, endDate } = params;
  
  let dateRange;
  if (startDate && endDate) {
    dateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };
  } else {
    dateRange = getDateRangeFromFilterType(filterType || 'previousmonth');
  }

  let whereConditions = [];
  const request = pool.request();

  if (sku) {
    const skuList = sku.split(',').map(s => s.trim());
    whereConditions.push(`sku IN (${skuList.map(s => `'${s.replace(/'/g, "''")}'`).join(',')})`);
  }
  if (productName) {
    whereConditions.push(`product_name LIKE '%${productName.replace(/'/g, "''")}%'`);
  }
  if (category) {
    whereConditions.push(`product_category = '${category.replace(/'/g, "''")}'`);
  }
  if (city) {
    whereConditions.push(`city = '${city.replace(/'/g, "''")}'`);
  }
  if (state) {
    whereConditions.push(`state = '${state.replace(/'/g, "''")}'`);
  }
  if (country) {
    whereConditions.push(`country LIKE '%${country.replace(/'/g, "''")}%'`);
  }
  if (platform) {
    whereConditions.push(`platform LIKE '%${platform.replace(/'/g, "''")}%'`);
  }

  whereConditions.push(`purchase_date >= '${formatDate(dateRange.startDate)}' AND purchase_date <= '${formatDate(dateRange.endDate)}'`);

  const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';

  // Try query with item_price first, fallback without it if column doesn't exist
  let query = `
    SELECT
      purchase_date as "purchase-date",
      purchase_hour as "purchase-hour",
      purchase_time as "purchase-time",
      order_status as "order-status",
      sku as "SKU",
      CAST(quantity AS FLOAT) as "Quantity",
      CAST(total_sales AS FLOAT) as "Total_Sales",
      CAST(item_price AS FLOAT) as "item-price",
      city as "City",
      state as "State",
      CAST(aov AS FLOAT) as "AOV",
      product_category as "Product Category",
      product_name as "Product Name"
    FROM std_orders
    WHERE ${whereClause}
    ORDER BY purchase_date DESC
  `;

  let result;
  try {
    result = await request.query(query);
  } catch (error) {
    // If item_price column doesn't exist, retry without it
    if (error.message && error.message.includes("Invalid column name 'item_price'")) {
      console.log('item_price column not found, retrying without it...');
      query = `
        SELECT
          purchase_date as "purchase-date",
          purchase_hour as "purchase-hour",
          purchase_time as "purchase-time",
          order_status as "order-status",
          sku as "SKU",
          CAST(quantity AS FLOAT) as "Quantity",
          CAST(total_sales AS FLOAT) as "Total_Sales",
          city as "City",
          state as "State",
          CAST(aov AS FLOAT) as "AOV",
          product_category as "Product Category",
          product_name as "Product Name"
        FROM std_orders
        WHERE ${whereClause}
        ORDER BY purchase_date DESC
      `;
      result = await request.query(query);
    } else {
      throw error;
    }
  }
  
  return {
    success: true,
    data: result.recordset,
    dateRange: {
      start: formatDate(dateRange.startDate),
      end: formatDate(dateRange.endDate)
    },
    filters: params
  };
};

/**
 * Execute get_regional_sales tool
 */
const executeGetRegionalSales = async (params, pool) => {
  const { filterType, sku, productCategory, state, city, country, platform } = params;
  
  const dateRange = getDateRangeFromFilterType(filterType || 'previousmonth');
  
  let whereConditions = [];
  if (sku) whereConditions.push(`sku IN ('${sku.split(',').map(s => s.trim()).join("','")}')`);
  if (productCategory) whereConditions.push(`product_category = '${productCategory}'`);
  if (state) whereConditions.push(`state = '${state}'`);
  if (city) whereConditions.push(`city = '${city}'`);
  if (country) whereConditions.push(`country LIKE '%${country}%'`);
  if (platform) whereConditions.push(`platform LIKE '%${platform}%'`);
  
  whereConditions.push(`purchase_date >= '${formatDate(dateRange.startDate)}' AND purchase_date <= '${formatDate(dateRange.endDate)}'`);
  
  // Try with order_id first, fallback to id if order_id doesn't exist
  let query = `
    SELECT
      state,
      city,
      SUM(CAST(total_sales AS FLOAT)) as totalSales,
      SUM(CAST(quantity AS FLOAT)) as totalQuantity,
      COUNT(DISTINCT order_id) as totalOrders
    FROM std_orders
    WHERE ${whereConditions.join(' AND ')}
    GROUP BY state, city
    ORDER BY totalSales DESC
  `;
  
  let result;
  try {
    result = await pool.request().query(query);
  } catch (error) {
    // If order_id column doesn't exist, use id instead
    if (error.message && (error.message.includes("Invalid column name 'order_id'") || error.message.includes("order_id"))) {
      console.log('order_id column not found, using id instead...');
      query = `
        SELECT
          state,
          city,
          SUM(CAST(total_sales AS FLOAT)) as totalSales,
          SUM(CAST(quantity AS FLOAT)) as totalQuantity,
          COUNT(DISTINCT id) as totalOrders
        FROM std_orders
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY state, city
        ORDER BY totalSales DESC
      `;
      result = await pool.request().query(query);
    } else {
      throw error;
    }
  }
  
  return {
    success: true,
    data: result.recordset,
    dateRange: {
      start: formatDate(dateRange.startDate),
      end: formatDate(dateRange.endDate)
    }
  };
};

/**
 * Execute get_inventory_data tool
 */
const executeGetInventoryData = async (params, pool) => {
  const { sku, category, product, country, platform } = params;
  
  let query = `SELECT * FROM std_inventory`;
  const request = pool.request();
  let whereConditions = [];
  
  if (sku) {
    whereConditions.push('sku LIKE @sku');
    request.input('sku', sql.VarChar, `%${sku}%`);
  }
  if (category) {
    whereConditions.push('product_category LIKE @category');
    request.input('category', sql.VarChar, `%${category}%`);
  }
  if (product) {
    whereConditions.push('product_name LIKE @product');
    request.input('product', sql.VarChar, `%${product}%`);
  }
  if (country) {
    whereConditions.push('country LIKE @country');
    request.input('country', sql.VarChar, `%${country}%`);
  }
  if (platform) {
    whereConditions.push('platform LIKE @platform');
    request.input('platform', sql.VarChar, `%${platform}%`);
  }
  
  if (whereConditions.length > 0) {
    query += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  
  const result = await request.query(query);
  
  return {
    success: true,
    data: result.recordset,
    totalItems: result.recordset.length
  };
};

/**
 * Execute get_pnl_data tool
 */
const executeGetPnlData = async (params, pool) => {
  const { range, sku, category, productName, country, platform, startMonth, endMonth, cm3Type } = params;
  
  let whereClause = '1=1';
  const request = pool.request();
  
  if (sku) {
    whereClause += ' AND sku = @sku';
    request.input('sku', sql.VarChar, sku);
  }
  if (category) {
    whereClause += ' AND product_category = @category';
    request.input('category', sql.VarChar, category);
  }
  if (productName) {
    whereClause += ' AND product_name = @productName';
    request.input('productName', sql.VarChar, productName);
  }
  if (country) {
    whereClause += ' AND country = @country';
    request.input('country', sql.VarChar, country);
  }
  if (platform) {
    whereClause += ' AND platform = @platform';
    request.input('platform', sql.VarChar, platform);
  }
  
  // Date range handling
  const moment = require('moment');
  
  let yearMonthFilter = [];
  if (range === 'customrange' && startMonth && endMonth) {
    const start = moment(startMonth, 'MM-YYYY');
    const end = moment(endMonth, 'MM-YYYY');
    let current = start.clone();
    while (current.isSameOrBefore(end)) {
      yearMonthFilter.push(current.format('YYYY-MM'));
      current.add(1, 'month');
    }
  } else {
    switch (range) {
      case 'currentmonth':
        yearMonthFilter.push(getCurrentYearMonth());
        break;
      case 'previousmonth':
        yearMonthFilter.push(getPreviousYearMonth());
        break;
      case 'currentyear':
        const currentYearNum = getCurrentYearNumber();
        const currentMonthNum = new Date('2026-01-07').getUTCMonth() + 1; // January = 1
        for (let month = 1; month <= currentMonthNum; month++) {
          yearMonthFilter.push(`${currentYearNum}-${month.toString().padStart(2, '0')}`);
        }
        break;
      case 'lastyear':
        const lastYear = getLastYear();
        for (let month = 1; month <= 12; month++) {
          yearMonthFilter.push(`${lastYear.startDate.getUTCFullYear()}-${month.toString().padStart(2, '0')}`);
        }
        break;
    }
  }
  
  if (yearMonthFilter.length > 0) {
    const placeholders = yearMonthFilter.map((_, i) => `@yearMonth${i}`).join(',');
    whereClause += ` AND year_month IN (${placeholders})`;
    yearMonthFilter.forEach((ym, i) => request.input(`yearMonth${i}`, sql.VarChar, ym));
  }
  
  if (cm3Type === 'gainer') {
    whereClause += ' AND cm3 >= 0';
  } else if (cm3Type === 'drainer') {
    whereClause += ' AND cm3 < 0';
  }
  
  const query = `
    SELECT
      sku,
      MAX(product_name) as product_name,
      MAX(product_category) as product_category,
      MAX(country) as country,
      MAX(platform) as platform,
      SUM(total_sales) as total_sales,
      SUM(ad_cost) as ad_cost,
      SUM(cm1) as cm1,
      SUM(cm2) as cm2,
      SUM(cm3) as cm3
    FROM std_pnl
    WHERE ${whereClause}
    GROUP BY sku
    ORDER BY cm3 DESC
  `;
  
  const result = await request.query(query);
  
  return {
    success: true,
    data: result.recordset
  };
};

/**
 * Execute get_pnl_executive tool
 */
const executeGetPnlExecutive = async (params, pool) => {
  // Aggregate the data
  const pnlData = await executeGetPnlData(params, pool);
  
  const totals = pnlData.data.reduce((acc, row) => {
    acc.total_sales += parseFloat(row.total_sales) || 0;
    acc.ad_cost += parseFloat(row.ad_cost) || 0;
    acc.cm1 += parseFloat(row.cm1) || 0;
    acc.cm2 += parseFloat(row.cm2) || 0;
    acc.cm3 += parseFloat(row.cm3) || 0;
    return acc;
  }, { total_sales: 0, ad_cost: 0, cm1: 0, cm2: 0, cm3: 0 });
  
  return {
    success: true,
    data: totals
  };
};

/**
 * Execute get_ad_sales_spend tool
 */
const executeGetAdSalesSpend = async (params, pool) => {
  const { filterType, platform, country, sku, startMonth, endMonth } = params;
  
  const moment = require('moment');
  
  let currentMonths = [];
  if (startMonth && endMonth) {
    const start = moment(startMonth, 'MM-YYYY');
    const end = moment(endMonth, 'MM-YYYY');
    let current = start.clone();
    while (current.isSameOrBefore(end)) {
      currentMonths.push(current.format('YYYY-MM'));
      current.add(1, 'month');
    }
  } else {
    switch (filterType) {
      case 'currentmonth':
        currentMonths.push(getCurrentYearMonth());
        break;
      case 'previousmonth':
        currentMonths.push(getPreviousYearMonth());
        break;
      case 'currentyear':
        const currentYear = new Date('2026-01-07').getUTCFullYear();
        for (let month = 1; month <= 1; month++) { // Only January for 2026-01-07
          currentMonths.push(`${currentYear}-${month.toString().padStart(2, '0')}`);
        }
        break;
      case 'lastyear':
        const lastYear = new Date('2026-01-07').getUTCFullYear() - 1;
        for (let month = 1; month <= 12; month++) {
          currentMonths.push(`${lastYear}-${month.toString().padStart(2, '0')}`);
        }
        break;
    }
  }
  
  let whereConditions = [];
  if (platform) whereConditions.push(`platform = '${platform}'`);
  if (country) whereConditions.push(`country LIKE '%${country}%'`);
  if (sku) whereConditions.push(`sku = '${sku}'`);
  
  const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';
  
  if (currentMonths.length > 0) {
    const monthsList = currentMonths.map(m => `'${m}'`).join(',');
    const query = `
      SELECT
        SUM(CAST(ad_sales AS FLOAT)) as totalAdSales,
        SUM(CAST(ad_spend AS FLOAT)) as totalAdSpend,
        SUM(CAST(total_gross_sales AS FLOAT)) as totalRevenue
      FROM std_ad_sales
      WHERE ${whereClause} AND year_month IN (${monthsList})
    `;
    
    const result = await pool.request().query(query);
    const data = result.recordset[0] || { totalAdSales: 0, totalAdSpend: 0, totalRevenue: 0 };
    
    const ACOS = data.totalAdSales > 0 ? (data.totalAdSpend / data.totalAdSales) * 100 : 0;
    const TACOS = data.totalRevenue > 0 ? (data.totalAdSpend / data.totalRevenue) * 100 : 0;
    const ROAS = data.totalAdSpend > 0 ? data.totalAdSales / data.totalAdSpend : 0;
    const organicRevenue = data.totalRevenue - data.totalAdSales;
    
    return {
      success: true,
      data: {
        adSales: data.totalAdSales,
        adSpend: data.totalAdSpend,
        revenue: data.totalRevenue,
        ACOS: ACOS,
        TACOS: TACOS,
        ROAS: ROAS,
        organicRevenue: organicRevenue
      }
    };
  }
  
  return { success: true, data: {} };
};

/**
 * Execute get_orders_data tool
 */
const executeGetOrdersData = async (params, pool) => {
  const { filterType, sku, platform, state, city, country, startMonth, endMonth } = params;
  
  let dateRange;
  if (startMonth && endMonth) {
    const startParsed = startMonth.split('-');
    const endParsed = endMonth.split('-');
    dateRange = {
      startDate: new Date(Date.UTC(parseInt(startParsed[0]), parseInt(startParsed[1]) - 1, 1)),
      endDate: new Date(Date.UTC(parseInt(endParsed[0]), parseInt(endParsed[1]), 0, 23, 59, 59, 999))
    };
  } else {
    dateRange = getDateRangeFromFilterType(filterType || 'previousmonth');
  }
  
  let whereConditions = [];
  if (sku) {
    const skuList = sku.split(',').map(s => s.trim());
    whereConditions.push(`sku IN (${skuList.map(s => `'${s.replace(/'/g, "''")}'`).join(',')})`);
  }
  if (platform) whereConditions.push(`platform LIKE '%${platform.replace(/'/g, "''")}%'`);
  if (state) whereConditions.push(`state = '${state.replace(/'/g, "''")}'`);
  if (city) whereConditions.push(`city = '${city.replace(/'/g, "''")}'`);
  if (country) whereConditions.push(`country LIKE '%${country.replace(/'/g, "''")}%'`);
  
  whereConditions.push(`CAST(purchase_date AS DATE) >= '${formatDate(dateRange.startDate)}' AND CAST(purchase_date AS DATE) <= '${formatDate(dateRange.endDate)}'`);
  
  const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';
  
  const query = `
    SELECT
      CAST(purchase_date AS DATE) as purchase_date,
      SUM(CAST(quantity AS INT)) as totalQuantity,
      SUM(CAST(total_sales AS FLOAT)) as totalSales,
      COUNT(DISTINCT order_id) as orderCount
    FROM std_orders
    WHERE ${whereClause}
    GROUP BY CAST(purchase_date AS DATE)
    ORDER BY purchase_date
  `;
  
  const result = await pool.request().query(query);
  
  const items = result.recordset.map(row => ({
    date: formatDate(row.purchase_date),
    totalQuantity: parseInt(row.totalQuantity) || 0,
    totalSales: parseFloat(row.totalSales) || 0,
    orderCount: parseInt(row.orderCount) || 0,
    aov: row.orderCount > 0 ? (row.totalSales / row.orderCount) : 0
  }));
  
  const totals = items.reduce((acc, item) => {
    acc.totalQuantity += item.totalQuantity;
    acc.totalSales += item.totalSales;
    acc.totalOrders += item.orderCount;
    return acc;
  }, { totalQuantity: 0, totalSales: 0, totalOrders: 0 });
  
  return {
    success: true,
    data: {
      items,
      totals,
      dateRange: {
        start: formatDate(dateRange.startDate),
        end: formatDate(dateRange.endDate)
      }
    }
  };
};

/**
 * Execute get_inventory_overstock tool
 */
const executeGetInventoryOverstock = async (params, pool) => {
  const { country, platform } = params;
  
  let query = `SELECT * FROM std_inventory WHERE stock_status = 'Overstock' AND dos_2 >= 90 AND afn_fulfillable_quantity >= 90`;
  const request = pool.request();
  
  if (platform) {
    query += ' AND platform LIKE @platform';
    request.input('platform', sql.VarChar, `%${platform}%`);
  }
  if (country) {
    query += ' AND country LIKE @country';
    request.input('country', sql.VarChar, `%${country}%`);
  }
  
  const result = await request.query(query);
  
  return {
    success: true,
    data: result.recordset,
    totalItems: result.recordset.length
  };
};

/**
 * Execute get_inventory_understock tool
 */
const executeGetInventoryUnderstock = async (params, pool) => {
  const { country, platform } = params;
  
  let query = `SELECT * FROM std_inventory WHERE stock_status = 'Understock' AND dos_2 <= 30 AND afn_fulfillable_quantity <= 30`;
  const request = pool.request();
  
  if (platform) {
    query += ' AND platform LIKE @platform';
    request.input('platform', sql.VarChar, `%${platform}%`);
  }
  if (country) {
    query += ' AND country LIKE @country';
    request.input('country', sql.VarChar, `%${country}%`);
  }
  
  const result = await request.query(query);
  
  return {
    success: true,
    data: result.recordset,
    totalItems: result.recordset.length
  };
};

/**
 * Execute get_inventory_out_of_stock tool
 */
const executeGetInventoryOutOfStock = async (params, pool) => {
  const { country, platform } = params;
  
  let query = `SELECT * FROM std_inventory WHERE stock_status = 'Understock' AND dos_2 = 0 AND afn_fulfillable_quantity = 0`;
  const request = pool.request();
  
  if (platform) {
    query += ' AND platform LIKE @platform';
    request.input('platform', sql.VarChar, `%${platform}%`);
  }
  if (country) {
    query += ' AND country LIKE @country';
    request.input('country', sql.VarChar, `%${country}%`);
  }
  
  const result = await request.query(query);
  
  return {
    success: true,
    data: result.recordset,
    totalItems: result.recordset.length
  };
};

module.exports = {
  executeTool
};

