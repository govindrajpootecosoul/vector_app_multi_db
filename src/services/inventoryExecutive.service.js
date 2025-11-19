// const sql = require('mssql');
// const { getConnection } = require('../utils/database');

// exports.getInventoryExecutiveData = async (req, res) => {
//   try {
//     const { country, platform } = req.query;
//     const clientId = req.user.client_id; // Get client_id from JWT token

//     const pool = await getConnection();

//     // Build WHERE clause
//     let whereClause = 'client_id = @clientId';
//     const request = pool.request();
//     request.input('clientId', sql.VarChar, clientId);

//     if (country) {
//       whereClause += ' AND country LIKE @country';
//       request.input('country', sql.VarChar, `%${country}%`);
//     }
//     if (platform) {
//       whereClause += ' AND platform LIKE @platform';
//       request.input('platform', sql.VarChar, `%${platform}%`);
//     }

//     const query = `
//       SELECT
//         MAX(platform) as platform,
//         SUM(estimated_storage_cost_next_month) as estimated_storage_cost_next_month,
//         AVG(dos_2) as DOS_2,
//         SUM(afn_warehouse_quantity) as afn_warehouse_quantity,
//         SUM(afn_fulfillable_quantity) as afn_fulfillable_quantity,
//         SUM(afn_unsellable_quantity) as afn_unsellable_quantity,
//         SUM(fc_transfer) as fctransfer,
//         SUM(customer_reserved) as customer_reserved,
//         SUM(fc_processing) as fc_processing,
//         SUM(inv_age_0_to_30_days + inv_age_31_to_60_days + inv_age_61_to_90_days) as inv_age_0_to_90_days,
//         SUM(inv_age_91_to_180_days + inv_age_181_to_270_days) as inv_age_91_to_270_days,
//         AVG(CASE WHEN instock_rate_percent != 0 THEN instock_rate_percent END) as instock_rate_percent,
//         SUM(CASE WHEN stock_status = 'Understock' AND dos_2 = 0 THEN 1 ELSE 0 END) as active_sku_out_of_stock_count,
//         SUM(sale_lost) as sale_lost
//       FROM std_inventory
//       WHERE ${whereClause}
//     `;

//     const result = await request.query(query);
//     const data = result.recordset[0] || {};

//     // Calculate estimated_storage_cost_previous_month based on platform
//     let estimated_storage_cost_previous_month = 0;
//     if (data.platform === 'amazon') {
//       estimated_storage_cost_previous_month = 2440;
//     } else if (data.platform === 'shopify') {
//       estimated_storage_cost_previous_month = 3078;
//     }

//     const inventoryExecutiveData = {
//       ...data,
//       estimated_storage_cost_previous_month
//     };

//     res.json({
//       success: true,
//       message: 'Inventory Executive data retrieved successfully',
//       data: inventoryExecutiveData
//     });

//   } catch (error) {
//     console.error('Inventory Executive service error:', error);
//     res.status(500).json({ error: error.message });
//   }
// };



const sql = require('mssql');
const { getConnection } = require('../utils/database');
const moment = require('moment'); // For date handling

exports.getInventoryExecutiveData = async (req, res) => {
  try {
    const { country, platform } = req.query;
    
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

    const pool = await getConnection(req);

    // Build WHERE clause (removed client_id - each database is client-specific)
    let whereClause = '1=1';
    const request = pool.request();

    if (country) {
      whereClause += ' AND country LIKE @country';
      request.input('country', sql.VarChar, `%${country}%`);
    }
    if (platform) {
      whereClause += ' AND platform LIKE @platform';
      request.input('platform', sql.VarChar, `%${platform}%`);
    }

    // Fetch inventory executive data
    const inventoryQuery = `
      SELECT
        MAX(platform) as platform,
        SUM(estimated_storage_cost_next_month) as estimated_storage_cost_next_month,
        AVG(dos_2) as DOS_2,
        SUM(afn_warehouse_quantity) as afn_warehouse_quantity,
        SUM(afn_fulfillable_quantity) as afn_fulfillable_quantity,
        SUM(afn_unsellable_quantity) as afn_unsellable_quantity,
        SUM(fc_transfer) as fctransfer,
        SUM(customer_reserved) as customer_reserved,
        SUM(fc_processing) as fc_processing,
        SUM(inv_age_0_to_30_days + inv_age_31_to_60_days + inv_age_61_to_90_days) as inv_age_0_to_90_days,
        SUM(inv_age_91_to_180_days + inv_age_181_to_270_days) as inv_age_91_to_270_days,
        AVG(CASE WHEN instock_rate_percent != 0 THEN instock_rate_percent END) as instock_rate_percent,
        SUM(CASE WHEN stock_status = 'Understock' AND dos_2 = 0 THEN 1 ELSE 0 END) as active_sku_out_of_stock_count,
        SUM(sale_lost) as sale_lost
      FROM std_inventory
      WHERE ${whereClause}
    `;

    const result = await request.query(inventoryQuery);
    const data = result.recordset[0] || {};

    // Calculate previous month in YYYY-MM format
    const previousMonth = moment().subtract(1, 'months').format('YYYY-MM');

    // Fetch storage_fee from std_pnl for previous month (removed client_id - each database is client-specific)
    let pnlWhereClause = 'year_month = @previousMonth';
    const pnlRequest = pool.request();
    pnlRequest.input('previousMonth', sql.VarChar, previousMonth);

    if (country) {
      pnlWhereClause += ' AND country LIKE @country';
      pnlRequest.input('country', sql.VarChar, `%${country}%`);
    }
    if (platform) {
      pnlWhereClause += ' AND platform LIKE @platform';
      pnlRequest.input('platform', sql.VarChar, `%${platform}%`);
    }

    const pnlQuery = `
      SELECT SUM(storage_fee) as estimated_storage_cost_previous_month
      FROM std_pnl
      WHERE ${pnlWhereClause}
    `;

    const pnlResult = await pnlRequest.query(pnlQuery);
    const estimated_storage_cost_previous_month = pnlResult.recordset[0]?.estimated_storage_cost_previous_month || 0;

    const inventoryExecutiveData = {
      ...data,
      estimated_storage_cost_previous_month
    };

    res.json({
      success: true,
      message: 'Inventory Executive data retrieved successfully',
      data: inventoryExecutiveData
    });

  } catch (error) {
    console.error('Inventory Executive service error:', error);
    res.status(500).json({ error: error.message });
  }
};
