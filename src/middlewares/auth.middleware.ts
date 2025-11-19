/**
 * Authentication Middleware (TypeScript)
 * 
 * Validates JWT tokens and extracts user information including databaseName.
 * Attaches databaseName to request for dynamic database switching.
 */

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JWTPayload } from '../types';
import logger from '../utils/logger';

/**
 * Middleware to authenticate JWT token and extract user information
 * Also extracts databaseName from token and attaches it to request for dynamic database switching
 * 
 * @param {AuthenticatedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('Access attempt without token');
    res.status(401).json({
      success: false,
      message: 'Access token required',
    });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error('JWT_SECRET not configured');
    res.status(500).json({
      success: false,
      message: 'Server configuration error',
    });
    return;
  }

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      logger.warn('Invalid token attempt');
      res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }

    // Type assertion for decoded token
    const user = decoded as JWTPayload;

    // Attach user info to request (userId, email, client_id, databaseName)
    req.user = user;

    // Extract databaseName from token and attach to request
    // This will be used by getConnection() to switch to the correct database
    if (user.databaseName) {
      req.databaseName = user.databaseName;
      logger.info(`Database context set to: ${user.databaseName} for user: ${user.email}`);
    } else {
      logger.warn(`No databaseName found in token for user: ${user.email}`);
    }

    next();
  });
};

