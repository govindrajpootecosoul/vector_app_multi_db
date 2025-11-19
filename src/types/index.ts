/**
 * TypeScript type definitions for the multi-tenant database system
 */

import { Request } from 'express';
import { ConnectionPool } from 'mssql';

/**
 * Extended Express Request interface with user and database context
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  databaseName?: string;
}

/**
 * JWT Token Payload
 * Contains user information and database context
 */
export interface JWTPayload {
  userId: number;
  email: string;
  client_id: string;
  databaseName: string;
  iat?: number;
  exp?: number;
}

/**
 * Signup Request Body
 */
export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  clientId: string;
  databaseName: string;
}

/**
 * Login Request Body
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * User Database Record
 */
export interface UserRecord {
  id: number;
  user_name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  client_id: string;
  database_name: string;
  permission_level?: string;
  account_status: string;
  profile_picture?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Login Response Data
 */
export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    expiresAt: string;
    user: {
      user_name: string;
      email: string;
      client_id: string;
      databaseName: string;
      role: string;
      account_status: string;
    };
  };
}

/**
 * Signup Response
 */
export interface SignupResponse {
  success: boolean;
  message: string;
}

/**
 * Database Configuration
 */
export interface DatabaseConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
}

