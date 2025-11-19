const { getConnection } = require('../utils/database');
const sql = require('mssql');

exports.getInventoryByDatabase = async (req, res) => {
  try {
    const { sku, category, product, country, platform } = req.query;
    
    // Get database name from token (priority) or from middleware
    // Priority: token databaseName > req.databaseName (from middleware)
    let databaseName = req.user?.databaseName || req.databaseName;

    if (!databaseName) {
      return res.status(400).json({
        success: false,
        error: 'Database name not found in token',
        message: 'Please ensure your JWT token contains the databaseName field.'
      });
    }

    // Set req.databaseName for getConnection to use
    req.databaseName = databaseName;

    // Get connection pool (reuses cached pool if available - FAST!)
    const pool = await getConnection(req);
    
    // Use std_inventory table directly - no checks needed (FAST!)
    const tableName = 'std_inventory';
    
    // Build query without client_id filter - fetch all data from the database
    // Use case-insensitive matching with LIKE for better flexibility
    let query = `SELECT * FROM ${tableName}`;
    const request = pool.request();
    console.log('Using table:', tableName);
    
    // Check if we have any filters - if not, just select all
    const hasFilters = sku || category || product || country || platform;
    if (hasFilters) {
      query += ' WHERE 1=1';
    }

    // Build filter based on query params - simple LIKE (SQL Server is case-insensitive by default)
    if (sku) {
      query += ' AND sku LIKE @sku';
      request.input('sku', sql.VarChar, `%${sku}%`);
    }
    if (category) {
      query += ' AND product_category LIKE @category';
      request.input('category', sql.VarChar, `%${category}%`);
    }
    if (product) {
      query += ' AND product_name LIKE @product';
      request.input('product', sql.VarChar, `%${product}%`);
    }
    if (country) {
      query += ' AND country LIKE @country';
      request.input('country', sql.VarChar, `%${country}%`);
    }
    if (platform) {
      query += ' AND platform LIKE @platform';
      request.input('platform', sql.VarChar, `%${platform}%`);
    }

    // Execute the main query - FAST and SIMPLE
    let result;
    try {
      if (!hasFilters) {
        // Simple query without filters - DIRECT (FASTEST)
        result = await pool.request().query(`SELECT * FROM ${tableName}`);
      } else {
        // Query with filters
        result = await request.query(query);
      }
    } catch (queryErr) {
      console.error('❌ Query execution error:', queryErr.message);
      throw queryErr;
    }
    
    const inventoryData = result.recordset;

    // Calculate totals
    let totalQuantity = 0;
    let totalValue = 0;
    let totalItems = inventoryData.length;

    inventoryData.forEach(item => {
      totalQuantity += Number(item.quantity) || 0;
      totalValue += Number(item.total_value || item.value) || 0;
    });

    // Return inventory data with database info
    const response = {
      success: true,
      message: 'Inventory data retrieved successfully',
      database: databaseName,
      table: tableName,
      filters: {
        country: country || 'all',
        platform: platform || 'all',
        sku: sku || 'all',
        category: category || 'all',
        product: product || 'all'
      },
      data: {
        totalItems,
        totalQuantity,
        totalValue,
        inventoryData
      }
    };
    
           // Response sent - no logging for speed
    
    res.json(response);

  } catch (error) {
    console.error('========================================');
    console.error('❌ INVENTORY SERVICE ERROR');
    console.error('========================================');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('========================================\n');
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryDropdownData = async (req, res) => {
  try {
    const { platform, country } = req.query;

    const pool = await getConnection(req);

    let skuQuery = 'SELECT DISTINCT sku FROM std_inventory WHERE sku IS NOT NULL';
    let categoryQuery = 'SELECT DISTINCT product_category FROM std_inventory WHERE product_category IS NOT NULL';
    let productQuery = 'SELECT DISTINCT product_name FROM std_inventory WHERE product_name IS NOT NULL';

    // Add filters for platform and country if provided
    if (platform) {
      skuQuery += ' AND platform LIKE @platform';
      categoryQuery += ' AND platform LIKE @platform';
      productQuery += ' AND platform LIKE @platform';
    }
    if (country) {
      skuQuery += ' AND country LIKE @country';
      categoryQuery += ' AND country LIKE @country';
      productQuery += ' AND country LIKE @country';
    }

    const skuRequest = pool.request();
    if (platform) skuRequest.input('platform', sql.VarChar, `%${platform}%`);
    if (country) skuRequest.input('country', sql.VarChar, `%${country}%`);

    const categoryRequest = pool.request();
    if (platform) categoryRequest.input('platform', sql.VarChar, `%${platform}%`);
    if (country) categoryRequest.input('country', sql.VarChar, `%${country}%`);

    const productRequest = pool.request();
    if (platform) productRequest.input('platform', sql.VarChar, `%${platform}%`);
    if (country) productRequest.input('country', sql.VarChar, `%${country}%`);

    const [skuResult, categoryResult, productResult] = await Promise.all([
      skuRequest.query(skuQuery),
      categoryRequest.query(categoryQuery),
      productRequest.query(productQuery)
    ]);

    const skuList = skuResult.recordset.map(row => row.sku).filter(sku => sku);
    const categoryList = categoryResult.recordset.map(row => row.product_category).filter(category => category);
    const productNameList = productResult.recordset.map(row => row.product_name).filter(product => product);

    res.json({
      success: true,
      message: 'Inventory dropdown data retrieved successfully',
      data: {
        skuList,
        categoryList,
        productNameList
      }
    });

  } catch (error) {
    console.error('Inventory dropdown service error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryOverstockData = async (req, res) => {
  try {
    const { country, platform } = req.query;

    const pool = await getConnection(req);
    let query = 'SELECT * FROM std_inventory WHERE stock_status = @stockStatus AND dos_2 >= @dos2 AND afn_fulfillable_quantity>=@afn_fulfillable_quantity';
    const request = pool.request();
    request.input('stockStatus', sql.VarChar, 'Overstock');
    request.input('dos2', sql.Int, 90);
    request.input('afn_fulfillable_quantity', sql.Int, 90);

    // Add filters for platform and country if provided
    if (platform) {
      query += ' AND platform LIKE @platform';
      request.input('platform', sql.VarChar, `%${platform}%`);
    }
    if (country) {
      query += ' AND country LIKE @country';
      request.input('country', sql.VarChar, `%${country}%`);
    }

    const result = await request.query(query);
    const inventoryData = result.recordset;

    console.log('Total overstock inventory items found:', inventoryData.length);

    res.json({
      success: true,
      message: 'Inventory overstock data retrieved successfully',
      data: { inventoryData }
    });

  } catch (error) {
    console.error('Inventory overstock service error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryUnderstockData = async (req, res) => {
  try {
    const { country, platform } = req.query;

    const pool = await getConnection(req);
    let query = 'SELECT * FROM std_inventory WHERE stock_status = @stockStatus AND dos_2 <= @dos2 AND afn_fulfillable_quantity<=@afn_fulfillable_quantity ';
    const request = pool.request();
    request.input('stockStatus', sql.VarChar, 'Understock');
    request.input('dos2', sql.Int, 30);
    request.input('afn_fulfillable_quantity', sql.Int, 30);

    // Add filters for platform and country if provided
    if (platform) {
      query += ' AND platform LIKE @platform';
      request.input('platform', sql.VarChar, `%${platform}%`);
    }
    if (country) {
      query += ' AND country LIKE @country';
      request.input('country', sql.VarChar, `%${country}%`);
    }

    const result = await request.query(query);
    const inventoryData = result.recordset;

    console.log('Total understock inventory items found:', inventoryData.length);

    res.json({
      success: true,
      message: 'Inventory understock data retrieved successfully',
      data: { inventoryData }
    });

  } catch (error) {
    console.error('Inventory understock service error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryActiveSKUOutOfStockData = async (req, res) => {
  try {
    const { country, platform } = req.query;

    const pool = await getConnection(req);
    let query = 'SELECT * FROM std_inventory WHERE stock_status = @stockStatus AND dos_2 = @dos2 AND afn_fulfillable_quantity=@afn_fulfillable_quantity';
    const request = pool.request();
    request.input('stockStatus', sql.VarChar, 'Understock');
    request.input('dos2', sql.Int, 0);
    request.input('afn_fulfillable_quantity', sql.Int, 0);

    // Add filters for platform and country if provided
    if (platform) {
      query += ' AND platform LIKE @platform';
      request.input('platform', sql.VarChar, `%${platform}%`);
    }
    if (country) {
      query += ' AND country LIKE @country';
      request.input('country', sql.VarChar, `%${country}%`);
    }

    const result = await request.query(query);
    const inventoryData = result.recordset;

    console.log('Total activeSKUoutofstock inventory items found:', inventoryData.length);

    res.json({
      success: true,
      message: 'Inventory activeSKUoutofstock data retrieved successfully',
      data: { inventoryData }
    });

  } catch (error) {
    console.error('Inventory activeSKUoutofstock service error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryCountSummary = async (req, res) => {
  try {
    const pool = await getConnection(req);
    const query = `
      SELECT country, platform, COUNT(*) as count
      FROM std_inventory
      GROUP BY country, platform
    `;
    const request = pool.request();

    const result = await request.query(query);
    const countSummary = result.recordset;

    console.log('Inventory count summary:', countSummary.length);

    res.json({
      success: true,
      message: 'Inventory count summary retrieved successfully',
      data: countSummary
    });

  } catch (error) {
    console.error('Inventory count summary service error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryStockStatusCounts = async (req, res) => {
  try {
    const { country, platform } = req.query;

    const pool = await getConnection(req);

    // Build base WHERE clause
    let baseWhere = '1=1';
    const request = pool.request();

    if (platform) {
      baseWhere += ' AND platform LIKE @platform';
      request.input('platform', sql.VarChar, `%${platform}%`);
    }
    if (country) {
      baseWhere += ' AND country LIKE @country';
      request.input('country', sql.VarChar, `%${country}%`);
    }

    // Count overstock: stock_status: "Overstock", dos_2: >= 90
    const overstockQuery = `SELECT COUNT(*) as count FROM std_inventory WHERE ${baseWhere} AND stock_status = 'Overstock' AND dos_2 >= 90 AND afn_fulfillable_quantity >= 90`;
    const overstockRequest = pool.request();
    if (platform) overstockRequest.input('platform', sql.VarChar, `%${platform}%`);
    if (country) overstockRequest.input('country', sql.VarChar, `%${country}%`);
    const overstockResult = await overstockRequest.query(overstockQuery);
    const overstockCount = overstockResult.recordset[0].count;

    // Count understock: stock_status: "Understock", dos_2: <= 30
    const understockQuery = `SELECT COUNT(*) as count FROM std_inventory WHERE ${baseWhere} AND stock_status = 'Understock' AND dos_2 <= 30 AND afn_fulfillable_quantity <= 30`;
    const understockRequest = pool.request();
    if (platform) understockRequest.input('platform', sql.VarChar, `%${platform}%`);
    if (country) understockRequest.input('country', sql.VarChar, `%${country}%`);
    const understockResult = await understockRequest.query(understockQuery);
    const understockCount = understockResult.recordset[0].count;

    // Count active SKU out of stock: stock_status: "Understock", dos_2: 0
    const activeSKUOutOfStockQuery = `SELECT COUNT(*) as count FROM std_inventory WHERE ${baseWhere} AND stock_status = 'Understock' AND dos_2 = 0 AND afn_fulfillable_quantity = 0`;
    const activeSKUOutOfStockRequest = pool.request();
    if (platform) activeSKUOutOfStockRequest.input('platform', sql.VarChar, `%${platform}%`);
    if (country) activeSKUOutOfStockRequest.input('country', sql.VarChar, `%${country}%`);
    const activeSKUOutOfStockResult = await activeSKUOutOfStockRequest.query(activeSKUOutOfStockQuery);
    const activeSKUOutOfStockCount = activeSKUOutOfStockResult.recordset[0].count;

    // Get average instock rate percent, excluding 0 values
    const instockRateQuery = `SELECT AVG(instock_rate_percent) as instock_rate_percent FROM std_inventory WHERE ${baseWhere} AND instock_rate_percent IS NOT NULL AND instock_rate_percent != 0`;
    const instockRateRequest = pool.request();
    if (platform) instockRateRequest.input('platform', sql.VarChar, `%${platform}%`);
    if (country) instockRateRequest.input('country', sql.VarChar, `%${country}%`);
    const instockRateResult = await instockRateRequest.query(instockRateQuery);
    const instockRatePercent = instockRateResult.recordset[0].instock_rate_percent || 0;

    console.log('Stock status counts:', { overstockCount, understockCount, activeSKUOutOfStockCount, instockRatePercent });

    res.json({
      success: true,
      message: 'Inventory stock status counts retrieved successfully',
      data: {
        overstockCount,
        understockCount,
        activeSKUOutOfStockCount,
        instock_rate_percent: instockRatePercent
      }
    });

  } catch (error) {
    console.error('Inventory stock status counts service error:', error);
    res.status(500).json({ error: error.message });
  }
};
