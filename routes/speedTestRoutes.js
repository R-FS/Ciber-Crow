const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const speedTestController = require('../controllers/speedTestController');

// Save speed test result (protected route)
router.post('/save', authenticateToken, speedTestController.saveTestResult);

// Get user's test history (protected route)
router.get('/history', authenticateToken, speedTestController.getTestHistory);

// Get test statistics (protected route)
router.get('/stats', authenticateToken, speedTestController.getTestStats);

module.exports = router;
