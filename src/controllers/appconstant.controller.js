const appConstantService = require('../services/appconstant.service');
const logger = require('../utils/logger');

const getAllConstants = async (req, res) => {
  try {
    const constants = await appConstantService.getAllConstants(req);

    logger.info('App constants fetched successfully');
    res.status(200).json({
      success: true,
      message: 'App constants retrieved successfully',
      data: constants,
    });
  } catch (error) {
    logger.error(`Get app constants error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getConstantByKey = async (req, res) => {
  try {
    const { key } = req.params;
    const constant = await appConstantService.getConstantByKey(key, req);

    logger.info(`App constant fetched for key: ${key}`);
    res.status(200).json({
      success: true,
      message: 'App constant retrieved successfully',
      data: constant,
    });
  } catch (error) {
    logger.error(`Get app constant error: ${error.message}`);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllConstants,
  getConstantByKey,
};
