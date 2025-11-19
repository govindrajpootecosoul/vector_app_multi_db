/**
 * Database Connection Manager (TypeScript)
 * 
 * This module manages database connections for a multi-tenant architecture.
 * 
 * Why mssql over Sequelize:
 * - Direct SQL Server support with connection pooling
 * - Better performance for multi-tenant scenarios
 * - More control over connection management
 * - Simpler dynamic database switching
 * - Native Azure SQL Database support
 */

import sql from 'mssql';
import dotenv from 'dotenv';
// import { initializeClientTables } from '../utils/db-init'; // Commented out - not used currently

dotenv.config();

// Base database configuration for Azure SQL
const baseConfig: sql.config = {
  server: process.env.DB_SERVER || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

// Main database configuration (for user authentication)
const mainDbConfig: sql.config = {
  ...baseConfig,
  database: process.env.DB_DATABASE || 'main-db', // Main database for user management
};

// Connection pools cache - stores connections for different databases
const connectionPools = new Map<string, sql.ConnectionPool>();

// Main database pool (for authentication)
let mainPool: sql.ConnectionPool | null = null;

/**
 * Connect to the main database (for user authentication)
 * This is called once at server startup
 * @returns {Promise<sql.ConnectionPool>} Main database connection pool
 */
export const connectDB = async (): Promise<sql.ConnectionPool> => {
  let retries = 3;
  while (retries > 0) {
    try {
      mainPool = await sql.connect(mainDbConfig);
      connectionPools.set('main-db', mainPool);
      console.log('✅ Connected to main database (Azure SQL)');
      return mainPool;
    } catch (err) {
      console.error('❌ Main database connection failed', err);
      retries--;
      if (retries > 0) {
        console.log(`Retrying connection... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      }
    }
  }
  console.error('❌ Failed to connect to main database after retries');
  process.exit(1);
};

/**
 * Get connection pool for a specific database
 * Creates a new connection if not cached, or returns cached connection
 * @param {string} databaseName - Name of the database to connect to
 * @returns {Promise<sql.ConnectionPool>} Connection pool for the specified database
 */
export const getPoolForDatabase = async (databaseName: string): Promise<sql.ConnectionPool> => {
  // If no database name provided, return main pool
  if (!databaseName) {
    if (!mainPool) {
      throw new Error('Main database connection not established');
    }
    return mainPool;
  }

  // If it's the main database, return main pool
  if (databaseName === 'main-db' || databaseName === process.env.DB_DATABASE) {
    if (!mainPool) {
      throw new Error('Main database connection not established');
    }
    return mainPool;
  }

  // Check if pool already exists in cache
  if (connectionPools.has(databaseName)) {
    const pool = connectionPools.get(databaseName);
    // Check if pool is still connected
    if (pool && pool.connected) {
      return pool;
    } else {
      // Remove stale connection
      connectionPools.delete(databaseName);
    }
  }

  // Create new connection pool for client database
  try {
    const clientDbConfig: sql.config = {
      ...baseConfig,
      database: databaseName,
    };

    // Use ConnectionPool instead of sql.connect() to create separate pools
    const pool = new sql.ConnectionPool(clientDbConfig);
    await pool.connect();
    connectionPools.set(databaseName, pool);
    console.log(`✅ Connected to client database: ${databaseName}`);
    
    // Skip table initialization - tables should already exist with data
    // Only initialize if explicitly needed (for new databases)
    // Commented out to prevent interference with existing data
    /*
    try {
      const tableCheck = await pool.request().query(`
        SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME IN ('std_inventory', 'std_orders', 'std_ad_sales')
      `);
      const existingTables = tableCheck.recordset[0].count;
      
      if (existingTables < 3) {
        console.log(`Initializing missing tables for ${databaseName}...`);
        await initializeClientTables(pool);
      } else {
        console.log(`✅ Tables already exist in ${databaseName}, skipping initialization`);
      }
    } catch (initError) {
      console.warn(`⚠️ Warning: Could not check/initialize tables for ${databaseName}:`, initError);
    }
    */
    console.log(`✅ Connected to ${databaseName} - using existing tables`);
    
    return pool;
  } catch (err) {
    console.error(`❌ Failed to connect to database: ${databaseName}`, err);
    throw new Error(`Database connection failed for: ${databaseName}`);
  }
};

/**
 * Get the main database pool (for authentication)
 * @returns {sql.ConnectionPool} Main database connection pool
 * @throws {Error} If main pool is not initialized
 */
export const getMainPool = (): sql.ConnectionPool => {
  if (!mainPool) {
    throw new Error('Main database connection not established');
  }
  return mainPool;
};

/**
 * Get pool for a specific database (synchronous - returns cached pool if available)
 * @param {string} databaseName - Name of the database
 * @returns {sql.ConnectionPool|null} Connection pool or null if not cached
 */
export const getPool = (databaseName: string | null = null): sql.ConnectionPool | null => {
  if (!databaseName) {
    return mainPool;
  }
  return connectionPools.get(databaseName) || mainPool;
};

