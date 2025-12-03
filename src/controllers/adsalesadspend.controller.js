const adSalesAdSpendService = require('../services/adsalesadspend.service');
const logger = require('../utils/logger');

exports.getAdSalesAdSpendByDatabase = async (req, res) => {
  await adSalesAdSpendService.getAdSalesAdSpendByDatabase(req, res);
};

exports.getAdSalesAdSpendExecutiveallByDatabase = async (req, res) => {
  try {
    req.skipAdSalesDateRange = true;
    req.groupAdSalesByCountryDates = true;
    await adSalesAdSpendService.getAdSalesAdSpendByDatabase(req, res);
  } catch (error) {
    logger.error(`Get adSalesAdSpendExecutiveall data error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
