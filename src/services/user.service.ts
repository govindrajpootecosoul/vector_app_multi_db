/**
 * User Service (TypeScript)
 * 
 * Handles user authentication and management operations.
 * All operations use the main database for user data storage.
 */

import sql from 'mssql';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getMainPool } from '../config/db';
import {
  SignupRequest,
  LoginRequest,
  LoginResponse,
  SignupResponse,
  UserRecord,
  JWTPayload,
} from '../types';

class UserService {
  /**
   * Authenticate user and generate JWT token with databaseName
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<LoginResponse>} Login response with token and user details
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      // Use main database pool for authentication
      const pool = getMainPool();
      if (!pool) {
        throw new Error('Database connection not established');
      }

      // Check if app_users table exists, create if not (with databaseName field)
      await pool.request().query(`
        IF OBJECT_ID('dbo.app_users', 'U') IS NULL 
        BEGIN 
          CREATE TABLE dbo.app_users (
            id INT IDENTITY(1,1) PRIMARY KEY, 
            user_name VARCHAR(255) NOT NULL, 
            email VARCHAR(255) NOT NULL UNIQUE, 
            password VARCHAR(255) NOT NULL, 
            phone VARCHAR(50), 
            role VARCHAR(50) NOT NULL, 
            client_id VARCHAR(255) NOT NULL, 
            database_name VARCHAR(255) NOT NULL,
            permission_level VARCHAR(50), 
            account_status VARCHAR(50) DEFAULT 'active', 
            created_at DATETIME DEFAULT GETDATE(), 
            updated_at DATETIME DEFAULT GETDATE()
          ) 
        END
      `);

      // Add database_name column if it doesn't exist (for existing tables)
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID('dbo.app_users') 
          AND name = 'database_name'
        )
        BEGIN
          ALTER TABLE dbo.app_users ADD database_name VARCHAR(255) NULL
        END
      `);

      // Query user by email
      const result = await pool
        .request()
        .input('email', sql.VarChar, email)
        .query('SELECT * FROM app_users WHERE email = @email');

      const user = result.recordset[0] as UserRecord;
      if (!user) {
        throw new Error('User not found');
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }

      // Get databaseName from user record
      const databaseName = user.database_name || (user as any).databaseName;

      // Include databaseName in JWT token payload
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      const tokenPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        client_id: user.client_id,
        databaseName: databaseName,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '44110h' });

      // Decode token to get expiration time
      const decoded = jwt.decode(token) as JWTPayload;
      const expiresAt = new Date((decoded.exp || 0) * 1000); // Convert to milliseconds

      return {
        success: true,
        message: 'Login successful',
        data: {
          token,
          expiresAt: expiresAt.toISOString(),
          user: {
            user_name: user.user_name,
            email: user.email,
            client_id: user.client_id,
            databaseName: databaseName,
            role: user.role,
            account_status: user.account_status,
          },
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Register a new user in the main database
   * @param {SignupRequest} signupData - User signup data including databaseName
   * @returns {Promise<SignupResponse>} Signup response
   */
  async signup(signupData: SignupRequest): Promise<SignupResponse> {
    try {
      // Use main database pool for user registration
      const pool = getMainPool();
      if (!pool) {
        throw new Error('Database connection not established');
      }

      // Validate required fields
      if (!signupData.databaseName) {
        throw new Error('databaseName is required');
      }

      // Check if app_users table exists, create if not (with databaseName field)
      await pool.request().query(`
        IF OBJECT_ID('dbo.app_users', 'U') IS NULL 
        BEGIN 
          CREATE TABLE dbo.app_users (
            id INT IDENTITY(1,1) PRIMARY KEY, 
            user_name VARCHAR(255) NOT NULL, 
            email VARCHAR(255) NOT NULL UNIQUE, 
            password VARCHAR(255) NOT NULL, 
            phone VARCHAR(50), 
            role VARCHAR(50) NOT NULL, 
            client_id VARCHAR(255) NOT NULL, 
            database_name VARCHAR(255) NOT NULL,
            permission_level VARCHAR(50), 
            account_status VARCHAR(50) DEFAULT 'active', 
            created_at DATETIME DEFAULT GETDATE(), 
            updated_at DATETIME DEFAULT GETDATE()
          ) 
        END
      `);

      // Add database_name column if it doesn't exist (for existing tables)
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID('dbo.app_users') 
          AND name = 'database_name'
        )
        BEGIN
          ALTER TABLE dbo.app_users ADD database_name VARCHAR(255) NULL
        END
      `);

      // Check if user with email already exists
      const existingUserResult = await pool
        .request()
        .input('email', sql.VarChar, signupData.email)
        .query('SELECT id FROM app_users WHERE email = @email');

      if (existingUserResult.recordset.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash the password
      const hashedPassword = await this.hashPassword(signupData.password);

      // Insert new user with databaseName
      await pool
        .request()
        .input('user_name', sql.VarChar, signupData.name)
        .input('email', sql.VarChar, signupData.email)
        .input('password', sql.VarChar, hashedPassword)
        .input('phone', sql.VarChar, signupData.phone)
        .input('role', sql.VarChar, signupData.role)
        .input('client_id', sql.VarChar, signupData.clientId)
        .input('database_name', sql.VarChar, signupData.databaseName)
        .query(`
          INSERT INTO app_users (user_name, email, password, phone, role, client_id, database_name)
          VALUES (@user_name, @email, @password, @phone, @role, @client_id, @database_name)
        `);

      return {
        success: true,
        message: 'User registered successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user details by ID from main database
   * @param {number} userId - User ID
   * @returns {Promise<Partial<UserRecord>>} User details
   */
  async getUserById(userId: number): Promise<Partial<UserRecord>> {
    try {
      // Use main database pool for user queries
      const pool = getMainPool();
      if (!pool) {
        throw new Error('Database connection not established');
      }

      const result = await pool
        .request()
        .input('userId', sql.Int, userId)
        .query('SELECT * FROM app_users WHERE id = @userId');

      const user = result.recordset[0] as UserRecord;
      if (!user) {
        throw new Error('User not found');
      }

      return {
        user_name: user.user_name,
        email: user.email,
        client_id: user.client_id,
        database_name: user.database_name || (user as any).databaseName,
        profile_picture: user.profile_picture,
        phone: user.phone,
        role: user.role,
        account_status: user.account_status,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get client configuration by client ID from main database
   * @param {string} clientId - Client ID
   * @returns {Promise<any>} Client configuration
   */
  async getClientByClientId(clientId: string): Promise<any> {
    try {
      // Use main database pool for client config queries
      const pool = getMainPool();
      if (!pool) {
        throw new Error('Database connection not established');
      }

      const result = await pool
        .request()
        .input('clientId', sql.VarChar, clientId)
        .query('SELECT * FROM ClientConfig WHERE client_id = @clientId');

      const client = result.recordset[0];
      if (!client) {
        throw new Error('Client not found');
      }
      return client;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }
}

export default new UserService();

