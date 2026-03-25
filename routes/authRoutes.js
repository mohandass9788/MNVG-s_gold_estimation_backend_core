const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User Authentication and Registration Flow
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new shop owner account
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               password:
 *                 type: string
 *                 example: "secret123"
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               shop_name:
 *                 type: string
 *                 example: "John's Gold"
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input or User already exists
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login via mobile app to obtain sync token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               password:
 *                 type: string
 *                 example: "secret123"
 *               device_name:
 *                 type: string
 *                 example: "iPhone 15 Pro"
 *               device_id:
 *                 type: string
 *                 example: "device-uuid-123"
 *     responses:
 *       200:
 *         description: JWT Token and user info returned
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/status:
 *   get:
 *     summary: Get current subscription/payment status
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current status returned
 */
router.get('/status', verifyToken, authController.getStatus);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile details
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile details returned
 *       404:
 *         description: User not found
 */
router.get('/profile', verifyToken, authController.getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile details
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               shop_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', verifyToken, authController.updateProfile);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and revoke current device session
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', verifyToken, authController.logout);

/**
 * @swagger
 * /api/auth/verify-session:
 *   get:
 *     summary: Verify if the current session token is still valid
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session is valid
 *       401:
 *         description: Session expired or invalid
 */
router.get('/verify-session', verifyToken, authController.verifySession);

/**
 * @swagger
 * /api/auth/profile/password:
 *   post:
 *     summary: Change user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       401:
 *         description: Current password mismatch
 */
router.post('/profile/password', verifyToken, authController.changePassword);

/**
 * @swagger
 * /api/auth/profile:
 *   delete:
 *     summary: Delete user account and all associated data
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       404:
 *         description: User not found
 */
router.delete('/profile', verifyToken, authController.deleteAccount);

module.exports = router;
