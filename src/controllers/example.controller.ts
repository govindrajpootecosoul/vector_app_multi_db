/**
 * Example Protected API Controller (TypeScript)
 * 
 * This is an example of a protected API endpoint that uses dynamic database connection.
 * The database connection is automatically switched based on the databaseName in the JWT token.
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { getConnection } from '../utils/database';
import sql from 'mssql';
import logger from '../utils/logger';

/**
 * Example: Get projects from client-specific database
 * GET /api/projects
 * Requires authentication
 * 
 * This endpoint demonstrates:
 * 1. JWT token validation (via auth middleware)
 * 2. Automatic database switching based on databaseName in token
 * 3. Querying client-specific data
 */
export const getProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const clientId = req.user.client_id;
    const databaseName = req.databaseName;

    if (!databaseName) {
      res.status(400).json({
        success: false,
        message: 'Database name not found in token',
      });
      return;
    }

    // getConnection automatically uses req.databaseName to connect to the correct database
    const pool = await getConnection(req);

    // Example query - adjust table name and structure based on your schema
    const result = await pool
      .request()
      .input('clientId', sql.VarChar, clientId)
      .query(`
        SELECT * 
        FROM projects 
        WHERE client_id = @clientId
        ORDER BY created_at DESC
      `);

    logger.info(`Projects fetched for client: ${clientId} from database: ${databaseName}`);

    res.status(200).json({
      success: true,
      message: 'Projects retrieved successfully',
      data: {
        databaseName,
        clientId,
        projects: result.recordset,
        count: result.recordset.length,
      },
    });
  } catch (error: any) {
    logger.error(`Get projects error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Example: Get users from client-specific database
 * GET /api/users
 * Requires authentication
 */
export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const clientId = req.user.client_id;
    const databaseName = req.databaseName;

    if (!databaseName) {
      res.status(400).json({
        success: false,
        message: 'Database name not found in token',
      });
      return;
    }

    // getConnection automatically uses req.databaseName to connect to the correct database
    const pool = await getConnection(req);

    // Example query - adjust table name and structure based on your schema
    const result = await pool
      .request()
      .input('clientId', sql.VarChar, clientId)
      .query(`
        SELECT id, name, email, role, created_at
        FROM users 
        WHERE client_id = @clientId
        ORDER BY created_at DESC
      `);

    logger.info(`Users fetched for client: ${clientId} from database: ${databaseName}`);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        databaseName,
        clientId,
        users: result.recordset,
        count: result.recordset.length,
      },
    });
  } catch (error: any) {
    logger.error(`Get users error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

