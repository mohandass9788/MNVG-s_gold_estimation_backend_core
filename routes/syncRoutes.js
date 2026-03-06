const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { verifyToken, checkSubscription } = require('../middlewares/authMiddleware');

// Receive data from local SQLite and save to MySQL
// Requires active subscription (POST request)
router.post('/push', verifyToken, checkSubscription, syncController.pushData);

// Send data down to App for initial sync / restore
// Allowed even in read-only mode (GET request)
router.post('/pull', verifyToken, syncController.pullData); // Still needs verify, but checkSubscription logic is built for 'GET', since we need to send JSON payload for pull we use POST

module.exports = router;
