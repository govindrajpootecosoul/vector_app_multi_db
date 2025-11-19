const express = require('express');
const { authenticateToken } = require('../middlewares/auth.middleware');
const decompositionController = require('../controllers/decomposition.controller');

const router = express.Router({ mergeParams: true });

router.get('/summary', authenticateToken, decompositionController.getSummary);

module.exports = router;

