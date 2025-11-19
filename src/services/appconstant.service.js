const { getConnection } = require('../utils/database');
const sql = require('mssql');

class AppConstantService {
  async getAllConstants(req) {
    try {
      const pool = await getConnection(req);
      const result = await pool.request().query('SELECT TOP 1 * FROM app_constant');
      return result.recordset[0] || {};
    } catch (error) {
      throw error;
    }
  }

  async getConstantByKey(key, req) {
    try {
      const pool = await getConnection(req);
      const result = await pool.request()
        .input('key', sql.VarChar, key)
        .query('SELECT * FROM app_constant WHERE key = @key');
      if (result.recordset.length === 0) {
        throw new Error('Constant not found');
      }
      return result.recordset[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AppConstantService();
