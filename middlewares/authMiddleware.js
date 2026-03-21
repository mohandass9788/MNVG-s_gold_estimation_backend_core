const jwt = require('jsonwebtoken');
const prisma = require('../prisma/client');

exports.verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];

        // Decode and verify the JWT signature
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

        // Cross-check with DB if the token is still an active session (Handles max device logouts)
        const activeSession = await prisma.session.findUnique({
            where: { token }
        });

        if (!activeSession) {
            return res.status(401).json({
                error: 'Session expired or logged out from another device.',
                code: 'LOGGED_OUT'
            });
        }

        // Update last active time async
        prisma.session.update({
            where: { id: activeSession.id },
            data: { last_active: new Date() }
        }).catch(e => console.error("Error updating session time:", e));

        req.user = decoded;
        req.session = activeSession;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please log in again.' });
        }
        return res.status(401).json({ error: 'Invalid token.' });
    }
};

exports.checkSubscription = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const now = new Date();
        const expiryDate = new Date(user.subscription_valid_upto);

        // If subscription is expired
        if (!user.subscription_valid_upto || now > expiryDate) {

            // READ-ONLY MODE LOGIC
            // Allow GET methods (Viewing data)
            if (req.method === 'GET') {
                return next();
            }

            // Block POST, PUT, DELETE operations (Creating new bills, updating, printing)
            return res.status(403).json({
                error: 'Trial or Subscription Expired. Read-only mode active.',
                code: 'SUBSCRIPTION_EXPIRED'
            });
        }

        // If active, proceed normally
        next();
    } catch (error) {
        console.error('Subscription Check Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
