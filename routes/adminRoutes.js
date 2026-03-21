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
        const [usersCount, activeSessionsCount, trialCount, users, allSessions] = await Promise.all([
            prisma.user.count({ where: { OR: [{ role: 'customer' }, { role: null }] } }),
            prisma.session.count(),
            prisma.user.count({ where: { is_trial: true, OR: [{ role: 'customer' }, { role: null }] } }),
            prisma.user.findMany({
                where: { OR: [{ role: 'customer' }, { role: null }] },
                include: {
                    _count: {
                        select: {
                            customer: true,
                            estimation: true,
                            purchase: true,
                            repair: true,
                            employee: true
                        }
                    },
                    session: {
                        orderBy: { last_active: 'desc' },
                        take: 1
                    }
                },
                orderBy: { created_at: 'desc' }
            }),
            prisma.session.findMany({
                include: { user: { select: { shop_name: true, name: true, phone: true } } },
                orderBy: { last_active: 'desc' }
            })
        ]);

        // Group sessions by shop_name
        const groupedSessions = allSessions.reduce((acc, s) => {
            const shop = s.user.shop_name || 'Individual';
            if (!acc[shop]) acc[shop] = [];
            acc[shop].push(s);
            return acc;
        }, {});

        res.render('dashboard', {
            usersCount,
            activeSessions: activeSessionsCount,
            trialCount,
            users,
            groupedSessions,
            admin: req.admin
        });
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

        const userInclude = {
            _count: {
                select: {
                    customer: true,
                    estimation: true,
                    purchase: true,
                    repair: true,
                    employee: true
                }
            },
            session: {
                orderBy: { last_active: 'desc' },
                take: 1
            }
        };

        const user = await prisma.user.create({
            data: {
                id: uuidv4(),
                phone,
                password: hashed,
                plain_password: password || 'Welcome@123',
                name: name || '',
                shop_name: shop_name || '',
                max_allowed_devices: parseInt(max_allowed_devices) || 1,
                subscription_valid_upto: trialEnd,
                is_trial: true,
                role: 'customer',
            },
            include: userInclude
        });
        res.render('partials/user-card', { user });
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
            updateData.plain_password = password;
        }
        const userInclude = {
            _count: {
                select: {
                    customer: true,
                    estimation: true,
                    purchase: true,
                    repair: true,
                    employee: true
                }
            },
            session: {
                orderBy: { last_active: 'desc' },
                take: 1
            }
        };
        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            include: userInclude
        });
        res.render('partials/user-card', { user });
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
 *               duration:
 *                 type: integer
 *               unit:
 *                 type: string
 *                 enum: [days, months, years]
 *     responses:
 *       200:
 *         description: Updated user HTML row or Shop Details status card
 * /admin/user/{id}/reset-password:
 *   post:
 *     summary: Reset User Password
 *     description: Resets password to a deterministic DDMM format if not specified.
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
 *               new_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: HTML status message
 */
// ─── POST /admin/user/:id/extend ─────────────────────────────────────────────
router.post('/user/:id/extend', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { duration, unit } = req.body; // duration: number, unit: 'days'|'months'|'years'
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        let newDate = user.subscription_valid_upto ? new Date(user.subscription_valid_upto) : new Date();
        if (newDate < new Date()) newDate = new Date();

        const amount = parseInt(duration);
        if (unit === 'years') newDate.setFullYear(newDate.getFullYear() + amount);
        else if (unit === 'months') newDate.setMonth(newDate.getMonth() + amount);
        else newDate.setDate(newDate.getDate() + amount);

        const userInclude = {
            _count: {
                select: {
                    customer: true,
                    estimation: true,
                    purchase: true,
                    repair: true,
                    employee: true
                }
            },
            session: {
                orderBy: { last_active: 'desc' },
                take: 1
            }
        };
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { subscription_valid_upto: newDate, is_trial: false },
            include: userInclude
        });

        // Determine if called from user-row/user-card or shop-details
        const hxTarget = req.headers['hx-target'];

        if (hxTarget && (hxTarget.startsWith('user-row') || hxTarget.startsWith('user-card'))) {
            res.render('partials/user-card', { user: updatedUser });
        } else {
            // Smart update for shop-details.ejs
            const expDate = updatedUser.subscription_valid_upto ? new Date(updatedUser.subscription_valid_upto) : null;
            const isExpired = !expDate || expDate < new Date();
            const dateStr = expDate ? expDate.toLocaleDateString('en-IN', { dateStyle: 'long' }) : 'Expired';
            const typeStr = updatedUser.is_trial ? 'Trial Account' : 'Paid Plan';
            const color = isExpired ? 'text-red-500' : 'text-green-600';

            res.send(`
            <div class="text-center py-4 bg-gray-50 rounded-xl border border-gray-100" id="sub-validity-status" hx-swap-oob="true">
                <p class="text-[9px] text-gray-400 font-bold uppercase mb-1">Subscription Valid Until</p>
                <p class="text-lg font-bold ${color}">${dateStr}</p>
                <span class="inline-block mt-2 px-3 py-1 bg-white rounded-full text-[9px] font-bold border border-gray-100 uppercase tracking-wider">${typeStr}</span>
            </div>
            <script>showToast('Subscription extended successfully!');</script>
            `);
        }
    } catch (e) {
        console.error(e);
        res.status(500).send('Error extending subscription.');
    }
});

// ─── POST /admin/user/:id/reset-password ──────────────────────────────────────
router.post('/user/:id/reset-password', requireAdmin, async (req, res) => {
    const { id } = req.params;
    let { new_password } = req.body;

    try {
        // Deterministic Password based on DDMM if not specified
        if (!new_password || new_password.trim() === '') {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
            new_password = `${day}${month}`;
        }

        const hashed = await bcrypt.hash(new_password, 10);
        await prisma.user.update({
            where: { id },
            data: {
                password: hashed,
                plain_password: new_password
            }
        });
        res.send(`
        <div class="text-green-600 font-bold text-[10px] uppercase">✅ Reset to: ${new_password}</div>
        <script>showToast('Password reset successfully!');</script>
        `);
    } catch (e) {
        console.error(e);
        res.status(500).send('Error resetting password.');
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
        const userInclude = {
            _count: {
                select: {
                    customer: true,
                    estimation: true,
                    purchase: true,
                    repair: true,
                    employee: true
                }
            },
            session: {
                orderBy: { last_active: 'desc' },
                take: 1
            }
        };
        const user = await prisma.user.update({
            where: { id },
            data: { max_allowed_devices: parseInt(max_allowed_devices) },
            include: userInclude
        });

        const hxTarget = req.headers['hx-target'];
        if (hxTarget && (hxTarget.startsWith('user-row') || hxTarget.startsWith('user-card'))) {
            res.render('partials/user-card', { user });
        } else {
            res.send(`
            <span class="text-[9px] font-bold text-gray-400" id="device-slots-status" hx-swap-oob="true">${user.session.length} / ${user.max_allowed_devices} SLOTS USED</span>
            <script>showToast('Device limit updated!');</script>
            `);
        }
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
 * /admin/user/{id}/details:
 *   get:
 *     summary: Render Shop Details Page
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HTML page of shop profile
 */
// ─── GET /admin/user/:id/details ────────────────────────────────────────────────
router.get('/user/:id/details', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        customer: true,
                        estimation: true,
                        purchase: true,
                        repair: true,
                        employee: true
                    }
                },
                session: {
                    orderBy: { last_active: 'desc' }
                }
            }
        });

        if (!user) return res.status(404).send('User not found');

        res.render('shop-details', { user, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading shop details.');
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
            prisma.user.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            customer: true,
                            estimation: true,
                            purchase: true,
                            repair: true,
                            employee: true
                        }
                    }
                }
            }),
            prisma.customer.findMany({ where: { userId: id }, orderBy: { name: 'asc' } })
        ]);
        res.render('customers', { user, customers, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading customers.');
    }
});

// ─── GET /admin/user/:id/estimations ─────────────────────────────────────────
router.get('/user/:id/estimations', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [user, rawEstimations] = await Promise.all([
            prisma.user.findUnique({
                where: { id },
                include: { _count: { select: { customer: true, estimation: true } } }
            }),
            prisma.estimation.findMany({
                where: { userId: id },
                orderBy: { date: 'desc' }, // Changed from created_at to date based on schema
                select: { id: true, local_id: true, bill_no: true, customer_name: true, customer_phone: true, total_amount: true, items: true, date: true, userId: true }
            })
        ]);

        // Add safe status default
        const estimations = rawEstimations.map(e => ({ ...e, status: e.status || 'active' }));

        res.render('estimations', { user, estimations, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading estimations');
    }
});

// ─── GET /admin/user/:id/purchases ───────────────────────────────────────────
router.get('/user/:id/purchases', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [user, purchases] = await Promise.all([
            prisma.user.findUnique({
                where: { id },
                include: { _count: { select: { purchase: true } } }
            }),
            prisma.purchase.findMany({
                where: { userId: id },
                orderBy: { date: 'desc' }
            })
        ]);
        res.render('purchases', { user, purchases, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading purchases');
    }
});

// ─── GET /admin/user/:id/repairs ─────────────────────────────────────────────
router.get('/user/:id/repairs', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [user, repairs] = await Promise.all([
            prisma.user.findUnique({
                where: { id },
                include: { _count: { select: { repair: true } } }
            }),
            prisma.repair.findMany({
                where: { userId: id },
                orderBy: { date: 'desc' },
                select: { id: true, local_id: true, receipt_no: true, customer_name: true, customer_phone: true, item_desc: true, estimated_cost: true, advance_paid: true, status: true, date: true, userId: true }
            })
        ]);
        res.render('repairs', { user, repairs, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading repairs');
    }
});

// ─── GET /estimation/:id/details (HTMX detail popup) ──────────────────
router.get('/estimation/:id/details', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const est = await prisma.estimation.findUnique({
            where: { id },
            select: { id: true, local_id: true, bill_no: true, customer_name: true, customer_phone: true, total_amount: true, items: true, date: true, userId: true }
        });
        if (!est) return res.status(404).send('Estimation not found');
        res.render('partials/estimation-details', { est });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading estimation details');
    }
});

// ─── GET /purchase/:id/details ───────────────────────────────────────────
router.get('/purchase/:id/details', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const p = await prisma.purchase.findUnique({ where: { id } });
        if (!p) return res.status(404).send('Purchase not found');
        res.render('partials/purchase-details', { p });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error');
    }
});

// ─── GET /repair/:id/details ─────────────────────────────────────────────
router.get('/repair/:id/details', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const r = await prisma.repair.findUnique({
            where: { id },
            select: { id: true, local_id: true, receipt_no: true, customer_name: true, customer_phone: true, item_desc: true, estimated_cost: true, advance_paid: true, status: true, date: true, userId: true }
        });
        if (!r) return res.status(404).send('Repair not found');
        res.render('partials/repair-details', { r });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error');
    }
});

// ─── GET /customer/:id/details ────────────────────────────────────────────────
router.get('/customer/:id/details', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const customer = await prisma.customer.findUnique({
            where: { id }
        });
        if (!customer) return res.status(404).send('Customer not found');

        // Manual counts based on phone number (since those tables don't have customerId relations)
        const [estCount, purCount, repCount] = await Promise.all([
            prisma.estimation.count({ where: { customer_phone: customer.phone, userId: customer.userId } }),
            prisma.purchase.count({ where: { customer_phone: customer.phone, userId: customer.userId } }),
            prisma.repair.count({ where: { customer_phone: customer.phone, userId: customer.userId } })
        ]);

        // Mock the _count object for the template
        customer._count = {
            estimation: estCount,
            purchase: purCount,
            repair: repCount
        };

        res.render('partials/customer-details', { customer });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error');
    }
});

// ─── DELETE Endpoints ────────────────────────────────────────────────────────
router.delete('/estimation/:id', requireAdmin, async (req, res) => {
    try { await prisma.estimation.delete({ where: { id: req.params.id } }); res.send(''); } catch (e) { res.status(500).send('Error'); }
});
router.delete('/purchase/:id', requireAdmin, async (req, res) => {
    try { await prisma.purchase.delete({ where: { id: req.params.id } }); res.send(''); } catch (e) { res.status(500).send('Error'); }
});
router.delete('/repair/:id', requireAdmin, async (req, res) => {
    try { await prisma.repair.delete({ where: { id: req.params.id } }); res.send(''); } catch (e) { res.status(500).send('Error'); }
});

/**
 * @swagger
 * /admin/session/{id}:
 *   delete:
 *     summary: Terminate an active user session
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session removed successfully
 */
// ─── DELETE /admin/session/:id ───────────────────────────────────────────────
router.delete('/session/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.session.delete({ where: { id } });
        res.send(''); // Return empty to remove element via hx-swap="delete"
    } catch (e) {
        console.error(e);
        res.status(500).send('Error deleting session.');
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
/**
 * @swagger
 * /admin/user/{id}/toggle-active:
 *   post:
 *     summary: Toggle User Active Status
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HTML status badge swapping
 */
// ─── POST /admin/user/:id/toggle-active ─────────────────────────────────────
router.post('/user/:id/toggle-active', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        await prisma.user.update({
            where: { id },
            data: { is_active: !user.is_active }
        });

        const active = !user.is_active;
        res.send(`
            <span class="px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all ${active ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}">
                ${active ? '✅' : '🚫'}
                <span class="uppercase tracking-widest">${active ? 'Active' : 'Deactivated'}</span>
            </span>
            <script>showToast('Status updated to ${active ? 'Active' : 'Inactive'}');</script>
        `);
    } catch (e) {
        console.error(e);
        res.status(500).send('Error');
    }
});

/**
 * @swagger
 * /admin/user/{id}/features:
 *   post:
 *     summary: Update User Feature Permissions
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
 *               chit: { type: string, example: "on" }
 *               purchase: { type: string, example: "on" }
 *               estimation: { type: string, example: "on" }
 *               advance_chit: { type: string, example: "on" }
 *               repair: { type: string, example: "on" }
 *     responses:
 *       200:
 *         description: HTML success message
 */
// ─── POST /admin/user/:id/features ──────────────────────────────────────────
router.post('/user/:id/features', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { chit, purchase, estimation, advance_chit, repair } = req.body;
    try {
        await prisma.user.update({
            where: { id },
            data: {
                feature_chit: chit === 'on',
                feature_purchase: purchase === 'on',
                feature_estimation: estimation === 'on',
                feature_advance_chit: advance_chit === 'on',
                feature_repair: repair === 'on'
            }
        });
        res.send('<div class="text-green-600 text-[10px] font-bold">✅ Features Updated</div>');
    } catch (e) {
        res.status(500).send('Error');
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
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [phone, password]
 *             properties:
 *               phone: { type: string }
 *               password: { type: string }
 *               name: { type: string }
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
                plain_password: password,
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
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               password: { type: string }
 */
router.post('/admins/:id/edit', requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, phone, password } = req.body;
    try {
        const updateData = { name, phone };
        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password, 10);
            updateData.plain_password = password;
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

/**
 * @swagger
 * /admin/config:
 *   get:
 *     summary: Render App Configuration Page
 *     tags: [Admin]
 */
router.get('/config', requireSuperAdmin, async (req, res) => {
    try {
        let config = await prisma.app_config.findFirst();
        if (!config) {
            config = {
                phone: "+91 9788339566",
                whatsapp: "https://wa.me/919788339566",
                email: "nexooai@gmail.com",
                demo_enabled: true,
                demo_message: "Please call our support numbers to activate the full version."
            };
        }
        res.render('admin-config', { config, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading config');
    }
});

/**
 * @swagger
 * /admin/config:
 *   post:
 *     summary: Update App Configuration
 *     tags: [Admin]
 */
router.post('/config', requireSuperAdmin, async (req, res) => {
    try {
        const { phone, whatsapp, email, demo_enabled, demo_message, min_version, latest_version, maintenance_mode, broadcast_message } = req.body;

        let config = await prisma.app_config.findFirst();
        const data = {
            phone: phone || '',
            whatsapp: whatsapp || '',
            email: email || '',
            demo_enabled: demo_enabled === 'on',
            demo_message: demo_message || '',
            min_version: min_version || '1.0.0',
            latest_version: latest_version || '1.0.0',
            maintenance_mode: maintenance_mode === 'on',
            broadcast_message: broadcast_message || ''
        };

        if (config) {
            await prisma.app_config.update({
                where: { id: config.id },
                data
            });
        } else {
            // DB schema might not be pushed if MySQL is down.
            // Catch error gracefully.
            try {
                await prisma.app_config.create({
                    data: { id: "1", ...data }
                });
            } catch (dbErr) {
                console.error("Could not save to DB (maybe schema not pushed):", dbErr);
                return res.status(500).send('<div class="text-red-600 font-bold p-2 bg-red-100 rounded">Database error. Run npx prisma db push.</div>');
            }
        }

        res.send(`<script>showToast('Configuration saved successfully!');</script>`);
    } catch (e) {
        console.error(e);
        res.status(500).send('Error saving config');
    }
});

// ─── ADMIN LOGS VIEW ──────────────────────────────────────────────────────────
router.get('/logs', requireSuperAdmin, async (req, res) => {
    try {
        const logs = await prisma.app_log.findMany({
            orderBy: { created_at: 'desc' },
            take: 100 // Last 100 logs
        });
        res.render('admin-logs', { logs, admin: req.admin });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading logs');
    }
});

router.delete('/logs/clear', requireSuperAdmin, async (req, res) => {
    try {
        await prisma.app_log.deleteMany();
        res.send('<div class="text-center py-20 text-gray-400 font-black uppercase tracking-widest h-full flex flex-col items-center justify-center">✅ Logs Cleared</div>');
    } catch (e) {
        res.status(500).send('Error');
    }
});

module.exports = router;

