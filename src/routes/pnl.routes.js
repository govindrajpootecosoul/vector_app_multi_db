const express = require('express');
const router = express.Router();
const pnlController = require('../controllers/pnl.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.get('/pnl-data', authenticateToken, pnlController.getPnlData);
router.get('/pnlexecutive', authenticateToken, pnlController.getPnlExecutiveData);
router.get('/pnldropdown', authenticateToken, pnlController.getPnlDropdownData);

module.exports = router;
