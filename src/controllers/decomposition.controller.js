const decompositionService = require('../services/decomposition.service');

const ensureDatabaseName = (req, res) => {
  const databaseName = req.user?.databaseName || req.databaseName;
  if (!databaseName) {
    res.status(400).json({
      success: false,
      error: 'Database name not found in token',
      message: 'Please ensure your JWT token contains the databaseName field.'
    });
    return null;
  }
  req.databaseName = databaseName;
  return databaseName;
};

exports.getSummary = async (req, res) => {
  try {
    if (!ensureDatabaseName(req, res)) {
      return;
    }

    const result = await decompositionService.getSummary(req);

    res.status(200).json({
      success: true,
      message: 'Decomposition summary fetched successfully',
      previousSummary: result.previousSummary,
      cSummary: result.cSummary,
      data: result.data
    });
  } catch (error) {
    console.error('Decomposition summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch decomposition summary',
      error: error.message
    });
  }
};


