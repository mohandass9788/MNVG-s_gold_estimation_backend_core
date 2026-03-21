const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { verifyToken, checkSubscription } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Sync
 *   description: Offline-First Data Synchronization
 */

/**
 * @swagger
 * /api/sync/push:
 *   post:
 *     summary: Push offline data from mobile app to cloud database
 *     description: Upserts multiple entity arrays inside a single database transaction. Requires active subscription.
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estimations:
 *                 type: array
 *                 items:
 *                   type: object
 *               purchases:
 *                 type: array
 *                 items:
 *                   type: object
 *               repairs:
 *                 type: array
 *                 items:
 *                   type: object
 *               customers:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Sync Successful with processed record counts
 *       403:
 *         description: Subscription Expired (Read-Only Mode)
 */
router.post('/push', verifyToken, checkSubscription, syncController.pushData);

/**
 * @swagger
 * /api/sync/pull:
 *   post:
 *     summary: Pull all user data from cloud to mobile app
 *     description: Fetches all remote records associated with the user account. Works even if subscription is expired (Read-Only).
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup data retrieved successfully
 *       401:
 *         description: Unauthorized (Invalid Token)
 */
router.post('/pull', verifyToken, syncController.pullData);

/**
 * @swagger
 * /api/sync/logs:
 *   post:
 *     summary: Upload App Diagnostic Logs
 *     description: Store error or debug logs from the mobile app for admin review.
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 */
router.post('/logs', verifyToken, syncController.saveLog);

module.exports = router;
