/**
 * Database Utility (TypeScript)
 * 
 * Provides utilities for getting database connections dynamically based on request context.
 * Extracts databaseName from the request object (set by auth middleware) and returns
 * the appropriate connection pool.
 */

import { ConnectionPool } from 'mssql';
import { getPoolForDatabase, getMainPool } from '../config/db';
import { AuthenticatedRequest } from '../types';

/**
 * Gets the Azure SQL connection pool for a specific database
 * This function extracts databaseName from the request object (set by auth middleware)
 * and returns the appropriate connection pool
 * 
 * @param {AuthenticatedRequest} req - Express request object (optional, for dynamic database switching)
 * @returns {Promise<ConnectionPool>} SQL connection pool for the client database
 */
export const getConnection = async (req: AuthenticatedRequest | null = null): Promise<ConnectionPool> => {
  // If request object is provided and has databaseName, use it
  if (req && req.databaseName) {
    const pool = await getPoolForDatabase(req.databaseName);
    if (!pool) {
      throw new Error(`Database connection not established for: ${req.databaseName}`);
    }
    return pool;
  }

  // If no request or databaseName, return main pool (for authentication)
  const pool = getMainPool();
  if (!pool) {
    throw new Error('Main database connection not established');
  }
  return pool;
};

/**
 * Gets the main database connection pool (for authentication)
 * @returns {ConnectionPool} Main database connection pool
 */
export const getMainConnection = (): ConnectionPool => {
  const pool = getMainPool();
  if (!pool) {
    throw new Error('Main database connection not established');
  }
  return pool;
};

