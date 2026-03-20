const express = require('express');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Item
 *   description: Item and Tag Management
 */

/**
 * @swagger
 * /api/item/scan-tag:
 *   post:
 *     summary: Scan Item Tag (Dummy for Testing)
 *     description: Returns item details for a given tag. Currently returns static dummy data for mobile app development.
 *     tags: [Item]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemtag:
 *                 type: string
 *               employeename:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item details retrieved
 */
router.post('/scan-tag', (req, res) => {
    const { itemtag, employeename } = req.body;
    
    // Static dummy data as requested for mobile app testing
    res.json({
        "TAGNO": "KBR884",
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
        "ITEMTAG": itemtag || "3KBR884",
        "LESSWT": "0.000",
        "WTTYPE": "N",
        "RATE": "6445.00"
    });
});

module.exports = router;
