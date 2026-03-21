const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /api/report/activation:
 *   post:
 *     summary: Report device activation
 *     description: Automatically reports device details to nexooai@gmail.com upon activation.
 *     tags: [Report]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               device_id:
 *                 type: string
 *               device_name:
 *                 type: string
 *               phone:
 *                 type: string
 *               shop_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Activation reported successfully
 */
router.post('/activation', (req, res) => {
    console.log("Device Activation Reported:", req.body);
    // Future extension: Send email using nodemailer
    res.json({ message: "Activation reported successfully" });
});

module.exports = router;
