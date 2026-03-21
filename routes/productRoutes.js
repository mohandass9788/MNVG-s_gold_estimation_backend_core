const express = require('express');
const router = express.Router();

// Helper for dummy item data
const getDummyItem = (tag) => ({
    "TAGNO": tag || "KBR884",
    "PRODUCTCODE": "3",
    "PRODUCTNAME": "BRACELET - (K)",
    "SUBPRODUCTNAME": "BRACELET - (K)",
    "NOOFPIECES": "1",
    "GRSWEIGHT": "1.950",
    "NETWEIGHT": "1.950",
    "METNAME": "GOLD",
    "TAXVALUE": "3.00",
    "STONEVALUE": "0.00",
    "CALCULATIONTYPE": "W",
    "SELLINGPRICE": "13457.34",
    "MAXMCGR": "0.00",
    "MAXMCAMOUNT": "0.00",
    "MAXWASTAGEPER": "8.00",
    "MAXWASTAGEAMOUNT": "0.156",
    "TAXTYPE": "EXCLUSIVE",
    "SUBPRODUCTID": "3",
    "VALUE": "0.00",
    "ITEMTAG": tag || "3KBR884",
    "LESSWT": "0.000",
    "WTTYPE": "N",
    "RATE": "6445.00"
});

/**
 * @swagger
 * /api/product/tag/{tag}:
 *   get:
 *     summary: Get product details by tag
 *     tags: [Product]
 *     parameters:
 *       - in: path
 *         name: tag
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details retrieved
 */
router.get('/tag/:tag', (req, res) => {
    res.json(getDummyItem(req.params.tag));
});

/**
 * @swagger
 * /api/product/scan-tag:
 *   post:
 *     summary: Scan Item Tag
 *     tags: [Product]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemtag:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product details retrieved
 */
router.post('/scan-tag', (req, res) => {
    const { itemtag } = req.body;
    res.json(getDummyItem(itemtag));
});

/**
 * @swagger
 * /api/product/multi-tag:
 *   post:
 *     summary: Get multiple product details simultaneously
 *     tags: [Product]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Array of product details
 */
router.post('/multi-tag', (req, res) => {
    const { tags } = req.body;
    if (!tags || !Array.isArray(tags)) {
        return res.status(400).json({ error: "Tags array is required" });
    }
    const products = tags.map(tag => getDummyItem(tag));
    res.json({ products });
});

module.exports = router;
