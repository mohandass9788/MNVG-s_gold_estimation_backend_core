const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'admin_fallback_secret_2026';
const ADMIN_COOKIE = 'admin_token';

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin Control Panel (HTMX UI Endpoints)
 */

// ─── Middleware: Require Admin ───────────────────────────────────────────────
// ─── Middleware: Require Admin (Any Admin) ───────────────────────────────────
const requireAdmin = (req, res, next) => {
    const token = req.cookies[ADMIN_COOKIE];
    if (!token) return res.redirect('/admin/login');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'super_admin' && decoded.role !== 'admin') {
            res.clearCookie(ADMIN_COOKIE);
            return res.redirect('/admin/login');
        }
        req.admin = decoded;
        next();
    } catch {
        res.clearCookie(ADMIN_COOKIE);
        res.redirect('/admin/login');
    }
};

// ─── Middleware: Require Super Admin ──────────────────────────────────────────
const requireSuperAdmin = (req, res, next) => {
    const token = req.cookies[ADMIN_COOKIE];
    if (!token) return res.redirect('/admin/login');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'super_admin') {
            return res.status(403).send('Forbidden: Super Admin access required.');
        }
        req.admin = decoded;
        next();
    } catch {
        res.clearCookie(ADMIN_COOKIE);
        res.redirect('/admin/login');
    }
};

/**
 * @swagger
 * /admin/login:
 *   get:
 *     summary: Render Admin Login Page
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: HTML page for login
 */
// ─── GET /admin/login ────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
    if (req.cookies[ADMIN_COOKIE]) return res.redirect('/admin');
    res.render('admin-login', { error: null });
});

/**
 * @swagger
 * /admin/login:
 *   post:
 *     summary: Authenticate Admin User
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "9000000000"
 *               password:
 *                 type: string
 *                 example: "Admin@123"
 *     responses:
 *       302:
 *         description: Redirect to /admin on success
 *       200:
 *         description: Login error page rendered
 */
// ─── POST /admin/login ───────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
            return res.render('admin-login', { error: 'Invalid credentials or not an admin.' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.render('admin-login', { error: 'Incorrect password.' });
        }
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
        res.cookie(ADMIN_COOKIE, token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 });
        res.redirect('/admin');
    } catch (e) {
        console.error(e);
        res.render('admin-login', { error: 'Server error. Try again.' });
    }
});

/**
 * @swagger
 * /admin/logout:
 *   get:
 *     summary: Logout Admin User
 *     tags: [Admin]
 *     responses:
 *       302:
 *         description: Redirect to /admin/login
 */
// ─── GET /admin/logout ───────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
    res.clearCookie(ADMIN_COOKIE);
    res.redirect('/admin/login');
});

/**
 * @swagger
 * /admin:
 *   get:
 *     summary: Render Admin Dashboard
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: HTML dashboard page
 *       302:
 *         description: Redirect to login if unauthorized
 */
// ─── GET /admin ──────────────────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
    try {
        const [usersCount, activeSessions, trialCount, users] = await Promise.all([
            prisma.user.count({ where: { role: 'customer' } }),
            prisma.session.count(),
            prisma.user.count({ where: { is_trial: true, role: 'customer' } }),
            prisma.user.findMany({ where: { role: 'customer' }, orderBy: { created_at: 'desc' } })
        ]);
        res.render('dashboard', { usersCount, activeSessions, trialCount, users, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Dashboard error');
    }
});

/**
 * @swagger
 * /admin/user/add:
 *   post:
 *     summary: Add an new user (shop owner) via Admin Dashboard
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               shop_name:
 *                 type: string
 *               max_allowed_devices:
 *                 type: integer
 *               trial_days:
 *                 type: integer
 *     responses:
 *       200:
 *         description: HTML table row of the newly added user
 */
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

/**
 * @swagger
 * /admin/user/{id}/edit-form:
 *   get:
 *     summary: Get Edit User Form (Modal content)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HTML form partial
 */
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

/**
 * @swagger
 * /admin/user/{id}/edit:
 *   post:
 *     summary: Update an existing user
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               shop_name:
 *                 type: string
 *               phone:
 *                 type: string
 *               max_allowed_devices:
 *                 type: integer
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user HTML row
 */
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

/**
 * @swagger
 * /admin/user/{id}/extend:
 *   post:
 *     summary: Extend User Subscription
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               days:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Updated user HTML row
 */
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

/**
 * @swagger
 * /admin/user/{id}/devices:
 *   post:
 *     summary: Update Max Allowed Devices for User
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               max_allowed_devices:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Updated user HTML row
 */
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

/**
 * @swagger
 * /admin/user/{id}:
 *   delete:
 *     summary: Delete a User
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns empty string (HTMX element removal trick)
 */
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

/**
 * @swagger
 * /admin/user/{id}/customers:
 *   get:
 *     summary: Render User's Customers Page
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HTML Page of customers
 */
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

/**
 * @swagger
 * /admin/customer/add:
 *   post:
 *     summary: Add new Customer to a User
 *     tags: [Admin]
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: HTML row of customer
 */
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

/**
 * @swagger
 * /admin/customer/{id}/edit-form:
 *   get:
 *     summary: Get Edit Customer Form
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HTML form partial
 */
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

/**
 * @swagger
 * /admin/customer/{id}/edit:
 *   post:
 *     summary: Edit Customer Details
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated customer HTML row
 */
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

/**
 * @swagger
 * /admin/customer/{id}:
 *   delete:
 *     summary: Delete a Customer
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns empty string (HTMX deletes element)
 */
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

// ─── ADMIN MANAGEMENT ROUTES (Super Admin Only) ─────────────────────────────

/**
 * @swagger
 * /admin/admins:
 *   get:
 *     summary: Render Admin Management Page
 *     tags: [Admin]
 */
router.get('/admins', requireSuperAdmin, async (req, res) => {
    try {
        const admins = await prisma.user.findMany({
            where: { role: { in: ['super_admin', 'admin'] } },
            orderBy: { created_at: 'desc' }
        });
        res.render('admins', { admins, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading admins');
    }
});

/**
 * @swagger
 * /admin/admins/add:
 *   post:
 *     summary: Add New Admin
 *     tags: [Admin]
 */
router.post('/admins/add', requireSuperAdmin, async (req, res) => {
    const { phone, password, name } = req.body;
    try {
        const existing = await prisma.user.findUnique({ where: { phone } });
        if (existing) return res.status(400).send('Phone already in use.');

        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                id: uuidv4(),
                phone,
                password: hashed,
                name: name || '',
                role: 'admin',
                is_trial: false,
                max_allowed_devices: 10
            }
        });
        res.render('partials/admin-row', { user, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error creating admin');
    }
});

/**
 * @swagger
 * /admin/admins/{id}/edit-form:
 *   get:
 *     summary: Get Edit Admin Form
 *     tags: [Admin]
 */
router.get('/admins/:id/edit-form', requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        res.render('partials/edit-admin-form', { user });
    } catch (e) {
        res.status(500).send('Error loading form');
    }
});

/**
 * @swagger
 * /admin/admins/{id}/edit:
 *   post:
 *     summary: Update Admin
 *     tags: [Admin]
 */
router.post('/admins/:id/edit', requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, phone, password } = req.body;
    try {
        const updateData = { name, phone };
        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password, 10);
        }
        const user = await prisma.user.update({ where: { id }, data: updateData });
        res.render('partials/admin-row', { user, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error updating admin');
    }
});

/**
 * @swagger
 * /admin/admins/{id}:
 *   delete:
 *     summary: Delete Admin
 *     tags: [Admin]
 */
router.delete('/admins/:id', requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    if (id === req.admin.id) return res.status(400).send('Cannot delete yourself.');
    try {
        await prisma.user.delete({ where: { id } });
        res.status(200).send('');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error deleting admin');
    }
});

module.exports = router;

