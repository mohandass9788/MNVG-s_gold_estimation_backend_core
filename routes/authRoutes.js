const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

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

module.exports = router;
