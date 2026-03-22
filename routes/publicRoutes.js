const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');

/**
 * @swagger
 * /api/public/status:
 *   get:
 *     summary: Get App Status (Version, Maintenance, Broadcast)
 *     description: Returns the current app configuration for startup checks.
 *     tags: [Public]
 */
router.get('/status', async (req, res) => {
    try {
        const config = await prisma.app_config.findFirst();
        res.json({
            min_version: config?.min_version || "1.0.0",
            latest_version: config?.latest_version || "1.0.0",
            maintenance_mode: config?.maintenance_mode || false,
            broadcast_message: config?.broadcast_message || "",
            contact: {
                phone: config?.phone || "+91 9788339566",
                whatsapp: config?.whatsapp || "https://wa.me/919788339566"
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── GET /api/public/legal/privacy ──────────────────────────────────────────
router.get('/legal/privacy', async (req, res) => {
    try {
        const config = await prisma.app_config.findFirst({ select: { privacy_policy_html: true } });
        if (config && config.privacy_policy_html) {
            return res.send(config.privacy_policy_html);
        }
        res.send('<html><body style="font-family:sans-serif;padding:40px;"><h1>Privacy Policy</h1><p>Placeholder content. Please update in Admin Panel.</p></body></html>');
    } catch (error) {
        res.status(500).send('Error loading content.');
    }
});

// ─── GET /api/public/legal/terms ─────────────────────────────────────────────
router.get('/legal/terms', async (req, res) => {
    try {
        const config = await prisma.app_config.findFirst({ select: { terms_conditions_html: true } });
        if (config && config.terms_conditions_html) {
            return res.send(config.terms_conditions_html);
        }
        res.send('<html><body style="font-family:sans-serif;padding:40px;"><h1>Terms & Conditions</h1><p>Placeholder content. Please update in Admin Panel.</p></body></html>');
    } catch (error) {
        res.status(500).send('Error loading content.');
    }
});

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

/**
 * @swagger
 * /api/public/request-call:
 *   post:
 *     summary: Submit a call request
 *     description: Saves a call request from the app (e.g., from the activation chat).
 *     tags: [Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               source:
 *                 type: string
 *     responses:
 *       201:
 *         description: Request submitted successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
router.post('/request-call', async (req, res) => {
    try {
        const { name, phone, source } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ error: "Name and phone are required" });
        }

        const newRequest = await prisma.request_call.create({
            data: {
                name,
                phone,
                source: source || 'unknown'
            }
        });

        res.status(201).json({ 
            message: "Call request submitted successfully", 
            id: newRequest.id 
        });
    } catch (error) {
        console.error("Error submitting call request:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /api/public/tutorial-video:
 *   get:
 *     summary: Get Tutorial Video Details
 *     description: Returns the official tutorial video link and metadata for the app.
 *     tags: [Public]
 */
router.get('/tutorial-video', async (req, res) => {
    res.json({
        isEnabled: true,
        videoUrl: "https://www.youtube.com/watch?v=EXAMPLE_ID",
        title: "Welcome Tutorial",
        description: "Learn how to use the Gold Estimation app",
        showOnScreens: ["activation", "dashboard"]
    });
});

module.exports = router;
