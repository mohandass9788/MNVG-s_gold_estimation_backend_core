const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'admin_fallback_secret_2026';
const ADMIN_COOKIE = 'admin_token';

// ─── Middleware: Require Admin ───────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
    const token = req.cookies[ADMIN_COOKIE];
    if (!token) return res.redirect('/admin/login');
    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.clearCookie(ADMIN_COOKIE);
        res.redirect('/admin/login');
    }
};

// ─── GET /admin/login ────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
    if (req.cookies[ADMIN_COOKIE]) return res.redirect('/admin');
    res.render('admin-login', { error: null });
});

// ─── POST /admin/login ───────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user || user.role !== 'admin') {
            return res.render('admin-login', { error: 'Invalid credentials or not an admin.' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.render('admin-login', { error: 'Incorrect password.' });
        }
        const token = jwt.sign({ id: user.id, phone: user.phone, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        res.cookie(ADMIN_COOKIE, token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 });
        res.redirect('/admin');
    } catch (e) {
        console.error(e);
        res.render('admin-login', { error: 'Server error. Try again.' });
    }
});

// ─── GET /admin/logout ───────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
    res.clearCookie(ADMIN_COOKIE);
    res.redirect('/admin/login');
});

// ─── GET /admin ──────────────────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
    try {
        const [usersCount, activeSessions, trialCount, users] = await Promise.all([
            prisma.user.count({ where: { role: 'customer' } }),
            prisma.session.count(),
            prisma.user.count({ where: { is_trial: true } }),
            prisma.user.findMany({ orderBy: { created_at: 'desc' } })
        ]);
        res.render('dashboard', { usersCount, activeSessions, trialCount, users, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Dashboard error');
    }
});

// ─── POST /admin/user/add ────────────────────────────────────────────────────
router.post('/user/add', requireAdmin, async (req, res) => {
    const { phone, password, name, shop_name, max_allowed_devices, trial_days } = req.body;
    try {
        const existing = await prisma.user.findUnique({ where: { phone } });
        if (existing) {
            return res.status(400).json({ error: 'Phone already registered.' });
        }
        const hashed = await bcrypt.hash(password || 'Welcome@123', 10);
        const trialDays = parseInt(trial_days) || 7;
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        const user = await prisma.user.create({
            data: {
                id: uuidv4(),
                phone,
                password: hashed,
                name: name || '',
                shop_name: shop_name || '',
                max_allowed_devices: parseInt(max_allowed_devices) || 4,
                subscription_valid_upto: trialEnd,
                is_trial: true,
                role: 'customer',
            }
        });
        res.render('partials/user-row', { user });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error creating user.');
    }
});

// ─── GET /admin/user/:id/edit-form (HTMX modal load) ─────────────────────────
router.get('/user/:id/edit-form', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        res.render('partials/edit-user-form', { user });
    } catch (e) {
        res.status(500).send('Error loading edit form.');
    }
});

// ─── POST /admin/user/:id/edit ───────────────────────────────────────────────
router.post('/user/:id/edit', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, shop_name, phone, max_allowed_devices, password } = req.body;
    try {
        const updateData = { name, shop_name, phone, max_allowed_devices: parseInt(max_allowed_devices) };
        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password, 10);
        }
        const user = await prisma.user.update({ where: { id }, data: updateData });
        res.render('partials/user-row', { user });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error updating user.');
    }
});

// ─── POST /admin/user/:id/extend ─────────────────────────────────────────────
router.post('/user/:id/extend', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { days } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        let newDate = user.subscription_valid_upto ? new Date(user.subscription_valid_upto) : new Date();
        if (newDate < new Date()) newDate = new Date();
        newDate.setDate(newDate.getDate() + parseInt(days));
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { subscription_valid_upto: newDate, is_trial: false }
        });
        res.render('partials/user-row', { user: updatedUser });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error extending subscription.');
    }
});

// ─── POST /admin/user/:id/devices ────────────────────────────────────────────
router.post('/user/:id/devices', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { max_allowed_devices } = req.body;
    try {
        const user = await prisma.user.update({
            where: { id },
            data: { max_allowed_devices: parseInt(max_allowed_devices) }
        });
        res.render('partials/user-row', { user });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error updating devices.');
    }
});

// ─── DELETE /admin/user/:id ───────────────────────────────────────────────────
router.delete('/user/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.user.delete({ where: { id } });
        res.status(200).send('');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error deleting user.');
    }
});

// ─── GET /admin/user/:id/customers ───────────────────────────────────────────
router.get('/user/:id/customers', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [user, customers] = await Promise.all([
            prisma.user.findUnique({ where: { id } }),
            prisma.customer.findMany({ where: { userId: id }, orderBy: { name: 'asc' } })
        ]);
        res.render('customers', { user, customers, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading customers.');
    }
});

// ─── POST /admin/customer/add ─────────────────────────────────────────────────
router.post('/customer/add', requireAdmin, async (req, res) => {
    const { userId, name, phone, address } = req.body;
    try {
        const customer = await prisma.customer.create({
            data: {
                id: uuidv4(),
                local_id: uuidv4(),
                name,
                phone: phone || '',
                address: address || '',
                userId,
            }
        });
        res.render('partials/customer-row', { customer });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error adding customer.');
    }
});

// ─── GET /admin/customer/:id/edit-form (HTMX modal load) ─────────────────────
router.get('/customer/:id/edit-form', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const customer = await prisma.customer.findUnique({ where: { id } });
        res.render('partials/edit-customer-form', { customer });
    } catch (e) {
        res.status(500).send('Error loading customer edit form.');
    }
});

// ─── POST /admin/customer/:id/edit ───────────────────────────────────────────
router.post('/customer/:id/edit', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, phone, address } = req.body;
    try {
        const customer = await prisma.customer.update({
            where: { id },
            data: { name, phone: phone || '', address: address || '' }
        });
        res.render('partials/customer-row', { customer });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error updating customer.');
    }
});

// ─── DELETE /admin/customer/:id ──────────────────────────────────────────────
router.delete('/customer/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.customer.delete({ where: { id } });
        res.status(200).send('');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error deleting customer.');
    }
});

module.exports = router;
