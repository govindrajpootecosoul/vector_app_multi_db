const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getMainPool } = require('../config/db');

class UserService {
  async login(email, password) {
    try {
      // Use main database pool for authentication
      const pool = getMainPool();
      if (!pool) {
        throw new Error('Database connection not established');
      }

      // Check if app_users table exists, create if not (with databaseName field)
      const tableCheck = await pool.request()
        .query(`IF OBJECT_ID('dbo.app_users', 'U') IS NULL 
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
                END`);

      // Add database_name column if it doesn't exist (for existing tables)
      await pool.request()
        .query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.app_users') AND name = 'database_name')
                BEGIN
                  ALTER TABLE dbo.app_users ADD database_name VARCHAR(255) NULL
                END`);

      const result = await pool.request()
        .input('email', sql.VarChar, email)
        .query('SELECT * FROM app_users WHERE email = @email');

      const user = result.recordset[0];
      if (!user) {
        throw new Error('User not found');
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }

      // Include databaseName in JWT token payload
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          client_id: user.client_id,
          databaseName: user.database_name || user.databaseName // Support both field names
        },
        process.env.JWT_SECRET,
        { expiresIn: '44110h' }
      );

      // Decode token to get expiration time
      const decoded = jwt.decode(token);
      const expiresAt = new Date(decoded.exp * 1000); // Convert to milliseconds

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
            databaseName: user.database_name || user.databaseName,
            role: user.role,
            account_status: user.account_status,
          },
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async signup({ name, email, password, phone, role, clientId, databaseName }) {
    try {
      // Use main database pool for user registration
      const pool = getMainPool();
      if (!pool) {
        throw new Error('Database connection not established');
      }

      // Validate required fields
      if (!databaseName) {
        throw new Error('databaseName is required');
      }

      // Check if app_users table exists, create if not (with databaseName field)
      const tableCheck = await pool.request()
        .query(`IF OBJECT_ID('dbo.app_users', 'U') IS NULL 
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
                END`);

      // Add database_name column if it doesn't exist (for existing tables)
      await pool.request()
        .query(`IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.app_users') AND name = 'database_name')
                BEGIN
                  ALTER TABLE dbo.app_users ADD database_name VARCHAR(255) NULL
                END`);

      // Check if user with email already exists
      const existingUserResult = await pool.request()
        .input('email', sql.VarChar, email)
        .query('SELECT id FROM app_users WHERE email = @email');

      if (existingUserResult.recordset.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash the password
      const hashedPassword = await this.hashPassword(password);

      // Insert new user with databaseName
      const insertResult = await pool.request()
        .input('user_name', sql.VarChar, name)
        .input('email', sql.VarChar, email)
        .input('password', sql.VarChar, hashedPassword)
        .input('phone', sql.VarChar, phone)
        .input('role', sql.VarChar, role)
        .input('client_id', sql.VarChar, clientId)
        .input('database_name', sql.VarChar, databaseName)
        .query(`INSERT INTO app_users (user_name, email, password, phone, role, client_id, database_name)
                VALUES (@user_name, @email, @password, @phone, @role, @client_id, @database_name)`);

      return {
        success: true,
        message: 'User registered successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      // Use main database pool for user queries
      const pool = getMainPool();
      if (!pool) {
        throw new Error('Database connection not established');
      }

      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT * FROM app_users WHERE id = @userId');

      const user = result.recordset[0];
      if (!user) {
        throw new Error('User not found');
      }

      return {
        user_name: user.user_name,
        email: user.email,
        client_id: user.client_id,
        databaseName: user.database_name || user.databaseName,
        profile_picture: user.profile_picture,
        mobile: user.phone,
        permission_level: user.role,
        account_status: user.account_status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error) {
      throw error;
    }
  }

  async getClientByClientId(clientId) {
    try {
      // Use main database pool for client config queries
      const pool = getMainPool();
      if (!pool) {
        throw new Error('Database connection not established');
      }

      const result = await pool.request()
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

  async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }
}

module.exports = new UserService();
