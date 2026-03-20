const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');

/**
 * @swagger
 * /api/public/config:
 *   get:
 *     summary: Retrieve public app configuration
 *     description: Returns the public contact details and demo configuration for the activation screen.
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Configuration object retrieved successfully
 */
router.get('/config', async (req, res) => {
    try {
        let appConfig = null;
        try {
            appConfig = await prisma.app_config.findFirst();
        } catch (dbError) {
            console.error("DB error fetching config (fallback to defaults):", dbError.message);
        }

        if (!appConfig) {
            // Default config if not present in DB or DB schema not updated
            appConfig = {
                phone: "+91 9788339566",
                whatsapp: "https://wa.me/919788339566",
                email: "nexooai@gmail.com",
                demo_enabled: true,
                demo_message: "Please call our support numbers to activate the full version."
            };
        }

        const config = {
            contact: {
                phone: appConfig.phone || "+91 9788339566",
                whatsapp: appConfig.whatsapp || "https://wa.me/919788339566",
                email: appConfig.email || "nexooai@gmail.com"
            },
            demo: {
                enabled: appConfig.demo_enabled !== undefined ? appConfig.demo_enabled : true,
                message: appConfig.demo_message || "Please call our support numbers to activate the full version."
            }
        };
        res.status(200).json(config);
    } catch (error) {
        console.error("Error fetching public config:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
