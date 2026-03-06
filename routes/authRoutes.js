const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Admin only (or first-time setup)
router.post('/register', authController.register);

// Mobile App / Admin Panel
router.post('/login', authController.login);

module.exports = router;
