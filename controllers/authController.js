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

        // Set trial valid upto 1 day from now
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 1);

        const user = await prisma.user.create({
            data: {
                id: uuidv4(),
                phone,
                password: hashedPassword,
                name: name || '',
                shop_name: shop_name || '',
                subscription_valid_upto: trialEndDate,
                is_trial: true,
                role: 'customer',
                max_allowed_devices: 1, // Default 1 for self-registered users as requested
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

        // Check if account is active
        if (user.is_active === false) {
            return res.status(403).json({ error: 'Account deactivated. Please contact admin.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, phone: user.phone, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '365d' } // Long lived token for offline apps
        );

        // Create or Update Session (Persistent Hardware tracking)
        const existingDeviceSession = device_id ? await prisma.session.findFirst({
            where: { userId: user.id, device_id }
        }) : null;

        if (existingDeviceSession) {
            // Reuse this slot, update token and activity
            await prisma.session.update({
                where: { id: existingDeviceSession.id },
                data: {
                    token,
                    device_name: device_name || existingDeviceSession.device_name,
                    last_active: new Date()
                }
            });
        } else {
            // New Device - Check Limit
            const activeSessionsCount = await prisma.session.count({
                where: { userId: user.id }
            });

            if (activeSessionsCount >= user.max_allowed_devices) {
                // Remove oldest session to free slot
                const oldestSession = await prisma.session.findFirst({
                    where: { userId: user.id },
                    orderBy: { last_active: 'asc' }
                });

                if (oldestSession) {
                    await prisma.session.delete({ where: { id: oldestSession.id } });
                }
            }

            // Create new session slot
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
        }

        // Determine current subscription status
        const now = new Date();
        const expiryDate = new Date(user.subscription_valid_upto);
        const isSubscriptionValid = user.subscription_valid_upto && now <= expiryDate;

        let status = 'expired_paid';
        if (user.is_trial) {
            status = isSubscriptionValid ? 'active_trial' : 'expired_trial';
        } else {
            status = isSubscriptionValid ? 'active_paid' : 'expired_paid';
        }

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                shop_name: user.shop_name,
                is_trial: user.is_trial,
                subscription_valid_upto: user.subscription_valid_upto,
                isSubscriptionValid,
                status,
                features: {
                    chit: user.feature_chit,
                    purchase: user.feature_purchase,
                    estimation: user.feature_estimation,
                    advance_chit: user.feature_advance_chit,
                    repair: user.feature_repair
                }
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Check current status (Used after login to refresh status)
exports.getStatus = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const now = new Date();
        const expiryDate = new Date(user.subscription_valid_upto);
        const isSubscriptionValid = user.subscription_valid_upto && now <= expiryDate;

        let status = 'expired_paid';
        if (user.is_trial) {
            status = isSubscriptionValid ? 'active_trial' : 'expired_trial';
        } else {
            status = isSubscriptionValid ? 'active_paid' : 'expired_paid';
        }

        res.json({
            status,
            isSubscriptionValid,
            subscription_valid_upto: user.subscription_valid_upto,
            is_trial: user.is_trial,
            features: {
                chit: user.feature_chit,
                purchase: user.feature_purchase,
                estimation: user.feature_estimation,
                advance_chit: user.feature_advance_chit,
                repair: user.feature_repair
            }
        });
    } catch (error) {
        console.error('Status Check Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
