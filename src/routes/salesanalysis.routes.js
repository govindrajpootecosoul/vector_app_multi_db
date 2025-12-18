const express = require('express');
const router = express.Router({ mergeParams: true });
const salesanalysisController = require('../controllers/salesanalysis.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Sales Data Query Endpoint
router.get('/sales', authenticateToken, salesanalysisController.getSalesData);

// Regional Sales Query Endpoint
router.get('/sales/region', authenticateToken, salesanalysisController.getRegionalSales);

// Sales Analysis Endpoints
router.get('/sku-list', authenticateToken, salesanalysisController.getSkuList);
router.get('/categories-list', authenticateToken, salesanalysisController.getCategoriesList);
router.get('/product-names', authenticateToken, salesanalysisController.getProductNames);
router.get('/states', authenticateToken, salesanalysisController.getStates);
router.get('/cities/:state', authenticateToken, salesanalysisController.getCitiesByState);
router.get('/states-list', authenticateToken, salesanalysisController.getStatesList);
router.get('/cities-list', authenticateToken, salesanalysisController.getCitiesList);
router.get('/compare', authenticateToken, salesanalysisController.getSalesComparison);

// Advertising Data Query Endpoint
router.get('/adData/filterData', authenticateToken, salesanalysisController.getAdData);

// Comprehensive Sales Analysis API (supports all filters in one endpoint)
router.get('/data', authenticateToken, salesanalysisController.getComprehensiveSalesData);

// Monthly Sales Data API
router.get('/monthlysalesdata', authenticateToken, salesanalysisController.getMonthlySalesData);

// Time Trend API
router.get('/timetrend', authenticateToken, salesanalysisController.getTimeTrend);

// Top 5 State Sales API
router.get('/top5statesales', authenticateToken, salesanalysisController.getTop5StateSales);

// Day-wise Sales API
router.get('/daywisesales', authenticateToken, salesanalysisController.getDayWiseSales);

module.exports = router;
