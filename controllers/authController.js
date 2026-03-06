const prisma = require('../prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Initial Account Creation Setup
exports.register = async (req, res) => {
    try {
        const { phone, password, name, shop_name } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required' });
        }

        const existingUser = await prisma.user.findUnique({ where: { phone } });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this phone already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Set trial valid upto 7 days from now
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        const user = await prisma.user.create({
            data: {
                id: uuidv4(),
                phone,
                password: hashedPassword,
                name,
                shop_name,
                subscription_valid_upto: trialEndDate,
                is_trial: true,
            }
        });

        res.status(201).json({ message: 'User created successfully', userId: user.id });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Device Login with limit tracking
exports.login = async (req, res) => {
    try {
        const { phone, password, device_name, device_id } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required' });
        }

        const user = await prisma.user.findUnique({ where: { phone } });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, phone: user.phone, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '365d' } // Long lived token for offline apps
        );

        // Track Sessions Check Max Allowed Devices
        const activeSessionsCount = await prisma.session.count({
            where: { userId: user.id }
        });

        if (activeSessionsCount >= user.max_allowed_devices) {
            // Find the oldest active session to delete
            const oldestSession = await prisma.session.findFirst({
                where: { userId: user.id },
                orderBy: { last_active: 'asc' }
            });

            if (oldestSession) {
                await prisma.session.delete({ where: { id: oldestSession.id } });
            }
        }

        // Add new session
        await prisma.session.create({
            data: {
                id: uuidv4(),
                token,
                device_id: device_id || 'unknown_device',
                device_name: device_name || 'Unknown',
                userId: user.id,
                last_active: new Date(),
            }
        });

        // Determine current subscription status
        const isSubscriptionValid = user.subscription_valid_upto && new Date() <= new Date(user.subscription_valid_upto);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                shop_name: user.shop_name,
                is_trial: user.is_trial,
                subscription_valid_upto: user.subscription_valid_upto,
                isSubscriptionValid
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
