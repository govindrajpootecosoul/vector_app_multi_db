
const salesanalysisService = require('../services/salesanalysis.service');

exports.getSalesData = async (req, res) => {
  try {
    await salesanalysisService.getSalesData(req, res);
  } catch (error) {
    console.error('Sales data controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRegionalSales = async (req, res) => {
  try {
    await salesanalysisService.getRegionalSales(req, res);
  } catch (error) {
    console.error('Regional sales controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getSkuList = async (req, res) => {
  try {
    await salesanalysisService.getSkuList(req, res);
  } catch (error) {
    console.error('SKU list controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getCategoriesList = async (req, res) => {
  try {
    await salesanalysisService.getCategoriesList(req, res);
  } catch (error) {
    console.error('Categories list controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getProductNames = async (req, res) => {
  try {
    await salesanalysisService.getProductNames(req, res);
  } catch (error) {
    console.error('Product names controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getStates = async (req, res) => {
  try {
    await salesanalysisService.getStates(req, res);
  } catch (error) {
    console.error('States controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getCitiesByState = async (req, res) => {
  try {
    await salesanalysisService.getCitiesByState(req, res);
  } catch (error) {
    console.error('Cities by state controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getStatesList = async (req, res) => {
  try {
    await salesanalysisService.getStatesList(req, res);
  } catch (error) {
    console.error('States list controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getCitiesList = async (req, res) => {
  try {
    await salesanalysisService.getCitiesList(req, res);
  } catch (error) {
    console.error('Cities list controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getSalesComparison = async (req, res) => {
  try {
    await salesanalysisService.getSalesComparison(req, res);
  } catch (error) {
    console.error('Sales comparison controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAdData = async (req, res) => {
  try {
    await salesanalysisService.getAdData(req, res);
  } catch (error) {
    console.error('Ad data controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getComprehensiveSalesData = async (req, res) => {
  try {
    await salesanalysisService.getComprehensiveSalesData(req, res);
  } catch (error) {
    console.error('Comprehensive sales data controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getMonthlySalesData = async (req, res) => {
  try {
    await salesanalysisService.getMonthlySalesData(req, res);
  } catch (error) {
    console.error('Monthly sales data controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTimeTrend = async (req, res) => {
  try {
    await salesanalysisService.getTimeTrend(req, res);
  } catch (error) {
    console.error('Time trend controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTop5StateSales = async (req, res) => {
  try {
    await salesanalysisService.getTop5StateSales(req, res);
  } catch (error) {
    console.error('Top 5 state sales controller error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getDayWiseSales = async (req, res) => {
  try {
    await salesanalysisService.getDayWiseSales(req, res);
  } catch (error) {
    console.error('Day-wise sales controller error:', error);
    res.status(500).json({ error: error.message });
  }
};
