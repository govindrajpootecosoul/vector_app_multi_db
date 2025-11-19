/**
 * Database Table Initialization Utility
 * 
 * Creates required tables (std_orders, std_inventory, std_ad_sales) if they don't exist
 * This should be called when connecting to a client database
 */

const sql = require('mssql');

/**
 * Initialize all required tables for a client database
 * @param {sql.ConnectionPool} pool - Database connection pool
 */
const initializeClientTables = async (pool) => {
  try {
    // Initialize std_orders table
    await pool.request().query(`
      IF OBJECT_ID('dbo.std_orders', 'U') IS NULL 
      BEGIN 
        CREATE TABLE dbo.std_orders (
          id INT IDENTITY(1,1) PRIMARY KEY,
          client_id VARCHAR(255) NOT NULL,
          purchase_date DATETIME,
          purchase_hour INT,
          purchase_time VARCHAR(50),
          order_status VARCHAR(50),
          sku VARCHAR(255),
          product_name VARCHAR(500),
          product_category VARCHAR(255),
          quantity INT,
          total_sales FLOAT,
          item_price FLOAT,
          city VARCHAR(255),
          state VARCHAR(255),
          country VARCHAR(255),
          platform VARCHAR(255),
          aov FLOAT,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        )
      END
    `);
    
    // Create indexes for std_orders if they don't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_std_orders_client_id' AND object_id = OBJECT_ID('dbo.std_orders'))
        CREATE INDEX idx_std_orders_client_id ON std_orders(client_id);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_std_orders_purchase_date' AND object_id = OBJECT_ID('dbo.std_orders'))
        CREATE INDEX idx_std_orders_purchase_date ON std_orders(purchase_date);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_std_orders_sku' AND object_id = OBJECT_ID('dbo.std_orders'))
        CREATE INDEX idx_std_orders_sku ON std_orders(sku);
    `);

    // Initialize std_inventory table with all columns
    await pool.request().query(`
      IF OBJECT_ID('dbo.std_inventory', 'U') IS NULL 
      BEGIN 
        CREATE TABLE dbo.std_inventory (
          id INT IDENTITY(1,1) PRIMARY KEY,
          inventory_date DATETIME,
          country VARCHAR(255),
          platform VARCHAR(255),
          sku VARCHAR(255),
          asin VARCHAR(255),
          product_category VARCHAR(255),
          product_name VARCHAR(500),
          product_cogs FLOAT,
          type VARCHAR(255),
          sale_lost FLOAT,
          previous_sale_lost FLOAT,
          wh_stock_value FLOAT,
          sellable_stock_value FLOAT,
          afn_warehouse_quantity INT,
          afn_fulfillable_quantity INT,
          afn_unsellable_quantity INT,
          afn_reserved_quantity INT,
          afn_total_quantity INT,
          amazon_reserved INT,
          customer_reserved INT,
          fc_transfer INT,
          fc_processing INT,
          afn_inbound_receiving_quantity INT,
          sell_thru FLOAT,
          dos_2 INT,
          days_in_stock INT,
          total_days INT,
          days_out_of_stock INT,
          instock_rate_percent FLOAT,
          previous_dis INT,
          previous_total_days INT,
          previous_days_out_of_stock INT,
          quantity INT,
          previous_avg_unit_sold_qty FLOAT,
          mtq_overstock INT,
          mtq_understock INT,
          stock_status VARCHAR(50),
          inv_age_0_to_30_days INT,
          inv_age_31_to_60_days INT,
          inv_age_61_to_90_days INT,
          inv_age_91_to_180_days INT,
          inv_age_181_to_270_days INT,
          inv_age_271_to_365_days INT,
          inv_age_365_plus_days INT,
          units_shipped_t7 INT,
          units_shipped_t30 INT,
          units_shipped_t60 INT,
          units_shipped_t90 INT,
          estimated_storage_cost_next_month FLOAT,
          quantity_to_be_charged_ais_241_270_days INT,
          estimated_ais_241_270_days FLOAT,
          quantity_to_be_charged_ais_271_300_days INT,
          estimated_ais_271_300_days FLOAT,
          quantity_to_be_charged_ais_301_330_days INT,
          estimated_ais_301_330_days FLOAT,
          estimated_cost_savings_of_recommended_actions FLOAT,
          estimated_ais_331_365_days FLOAT,
          estimated_ais_365_plus_days FLOAT,
          client_id VARCHAR(255),
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        )
      END
    `);
    
    // Add missing columns if table already exists (for existing databases)
    const columnsToAdd = [
      { name: 'inventory_date', type: 'DATETIME' },
      { name: 'asin', type: 'VARCHAR(255)' },
      { name: 'product_cogs', type: 'FLOAT' },
      { name: 'type', type: 'VARCHAR(255)' },
      { name: 'sale_lost', type: 'FLOAT' },
      { name: 'previous_sale_lost', type: 'FLOAT' },
      { name: 'wh_stock_value', type: 'FLOAT' },
      { name: 'sellable_stock_value', type: 'FLOAT' },
      { name: 'afn_warehouse_quantity', type: 'INT' },
      { name: 'afn_unsellable_quantity', type: 'INT' },
      { name: 'afn_reserved_quantity', type: 'INT' },
      { name: 'afn_total_quantity', type: 'INT' },
      { name: 'amazon_reserved', type: 'INT' },
      { name: 'customer_reserved', type: 'INT' },
      { name: 'fc_transfer', type: 'INT' },
      { name: 'fc_processing', type: 'INT' },
      { name: 'afn_inbound_receiving_quantity', type: 'INT' },
      { name: 'sell_thru', type: 'FLOAT' },
      { name: 'days_in_stock', type: 'INT' },
      { name: 'total_days', type: 'INT' },
      { name: 'days_out_of_stock', type: 'INT' },
      { name: 'previous_dis', type: 'INT' },
      { name: 'previous_total_days', type: 'INT' },
      { name: 'previous_days_out_of_stock', type: 'INT' },
      { name: 'previous_avg_unit_sold_qty', type: 'FLOAT' },
      { name: 'mtq_overstock', type: 'INT' },
      { name: 'mtq_understock', type: 'INT' },
      { name: 'inv_age_0_to_30_days', type: 'INT' },
      { name: 'inv_age_31_to_60_days', type: 'INT' },
      { name: 'inv_age_61_to_90_days', type: 'INT' },
      { name: 'inv_age_91_to_180_days', type: 'INT' },
      { name: 'inv_age_181_to_270_days', type: 'INT' },
      { name: 'inv_age_271_to_365_days', type: 'INT' },
      { name: 'inv_age_365_plus_days', type: 'INT' },
      { name: 'units_shipped_t7', type: 'INT' },
      { name: 'units_shipped_t30', type: 'INT' },
      { name: 'units_shipped_t60', type: 'INT' },
      { name: 'units_shipped_t90', type: 'INT' },
      { name: 'estimated_storage_cost_next_month', type: 'FLOAT' },
      { name: 'quantity_to_be_charged_ais_241_270_days', type: 'INT' },
      { name: 'estimated_ais_241_270_days', type: 'FLOAT' },
      { name: 'quantity_to_be_charged_ais_271_300_days', type: 'INT' },
      { name: 'estimated_ais_271_300_days', type: 'FLOAT' },
      { name: 'quantity_to_be_charged_ais_301_330_days', type: 'INT' },
      { name: 'estimated_ais_301_330_days', type: 'FLOAT' },
      { name: 'estimated_cost_savings_of_recommended_actions', type: 'FLOAT' },
      { name: 'estimated_ais_331_365_days', type: 'FLOAT' },
      { name: 'estimated_ais_365_plus_days', type: 'FLOAT' }
    ];
    
    for (const column of columnsToAdd) {
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID('dbo.std_inventory') 
          AND name = '${column.name}'
        )
        BEGIN
          ALTER TABLE dbo.std_inventory ADD ${column.name} ${column.type}
        END
      `);
    }
    
    // Create indexes for std_inventory if they don't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_std_inventory_client_id' AND object_id = OBJECT_ID('dbo.std_inventory'))
        CREATE INDEX idx_std_inventory_client_id ON std_inventory(client_id);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_std_inventory_sku' AND object_id = OBJECT_ID('dbo.std_inventory'))
        CREATE INDEX idx_std_inventory_sku ON std_inventory(sku);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_std_inventory_stock_status' AND object_id = OBJECT_ID('dbo.std_inventory'))
        CREATE INDEX idx_std_inventory_stock_status ON std_inventory(stock_status);
    `);

    // Initialize std_ad_sales table
    await pool.request().query(`
      IF OBJECT_ID('dbo.std_ad_sales', 'U') IS NULL 
      BEGIN 
        CREATE TABLE dbo.std_ad_sales (
          id INT IDENTITY(1,1) PRIMARY KEY,
          client_id VARCHAR(255) NOT NULL,
          platform VARCHAR(255),
          country VARCHAR(255),
          sku VARCHAR(255),
          year_month VARCHAR(50),
          ad_sales FLOAT,
          ad_spend FLOAT,
          total_gross_sales FLOAT,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        )
      END
    `);
    
    // Create indexes for std_ad_sales if they don't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_std_ad_sales_client_id' AND object_id = OBJECT_ID('dbo.std_ad_sales'))
        CREATE INDEX idx_std_ad_sales_client_id ON std_ad_sales(client_id);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_std_ad_sales_year_month' AND object_id = OBJECT_ID('dbo.std_ad_sales'))
        CREATE INDEX idx_std_ad_sales_year_month ON std_ad_sales(year_month);
    `);

    console.log('✅ Client database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing client database tables:', error);
    throw error;
  }
};

module.exports = {
  initializeClientTables,
};

