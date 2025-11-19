/**
 * User Controller (TypeScript)
 * 
 * Handles HTTP requests for user authentication and management.
 */

import { Response } from 'express';
import { AuthenticatedRequest, SignupRequest, LoginRequest } from '../types';
import userService from '../services/user.service';
import logger from '../utils/logger';

/**
 * Handle user login
 * POST /api/user/login
 */
export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
      return;
    }

    const result = await userService.login(email, password);

    logger.info(`User logged in: ${email}`);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`Login error: ${error.message}`);
    res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Handle user signup
 * POST /api/user/signup
 */
export const signup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const signupData: SignupRequest = req.body;
    const { name, email, password, phone, role, clientId, databaseName } = signupData;

    if (!name || !email || !password || !phone || !role || !clientId || !databaseName) {
      res.status(400).json({
        success: false,
        message: 'All fields are required: name, email, password, phone, role, clientId, databaseName',
      });
      return;
    }

    const result = await userService.signup(signupData);

    logger.info(`User registered: ${email} with database: ${databaseName}`);
    res.status(201).json(result);
  } catch (error: any) {
    logger.error(`Signup error: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get user details
 * GET /api/user/details
 * Requires authentication
 */
export const getUserDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const userId = req.user.userId; // Extracted from JWT token by middleware
    const userDetails = await userService.getUserById(userId);

    logger.info(`User details fetched for userId: ${userId}`);
    res.status(200).json({
      success: true,
      message: 'User details retrieved successfully',
      data: userDetails,
    });
  } catch (error: any) {
    logger.error(`Get user details error: ${error.message}`);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get client data
 * GET /api/user/client
 * Requires authentication
 */
export const getClientData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const clientId = req.user.client_id; // Extracted from JWT token
    const clientData = await userService.getClientByClientId(clientId);

    logger.info(`Client data fetched for clientId: ${clientId}`);
    res.status(200).json({
      success: true,
      message: 'Client data retrieved successfully',
      data: clientData,
    });
  } catch (error: any) {
    logger.error(`Get client data error: ${error.message}`);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

