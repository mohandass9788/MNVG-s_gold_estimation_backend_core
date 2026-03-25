const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'admin_fallback_secret_2026';
const ADMIN_COOKIE = 'admin_token';

const requireAdmin = (req, res, next) => {
    const token = req.cookies[ADMIN_COOKIE];
    if (!token) {
        const redirectUrl = req.originalUrl !== '/admin' ? `/admin/login?next=${encodeURIComponent(req.originalUrl)}` : '/admin/login';
        return res.redirect(redirectUrl);
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'super_admin' && decoded.role !== 'admin') {
            res.clearCookie(ADMIN_COOKIE);
            const redirectUrl = req.originalUrl !== '/admin' ? `/admin/login?next=${encodeURIComponent(req.originalUrl)}` : '/admin/login';
            return res.redirect(redirectUrl);
        }
        req.admin = decoded;
        next();
    } catch {
        res.clearCookie(ADMIN_COOKIE);
        const redirectUrl = req.originalUrl !== '/admin' ? `/admin/login?next=${encodeURIComponent(req.originalUrl)}` : '/admin/login';
        res.redirect(redirectUrl);
    }
};

const requireSuperAdmin = (req, res, next) => {
    const token = req.cookies[ADMIN_COOKIE];
    if (!token) {
        const redirectUrl = req.originalUrl !== '/admin' ? `/admin/login?next=${encodeURIComponent(req.originalUrl)}` : '/admin/login';
        return res.redirect(redirectUrl);
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'super_admin') {
            return res.status(403).send('Forbidden: Super Admin access required.');
        }
        req.admin = decoded;
        next();
    } catch {
        res.clearCookie(ADMIN_COOKIE);
        const redirectUrl = req.originalUrl !== '/admin' ? `/admin/login?next=${encodeURIComponent(req.originalUrl)}` : '/admin/login';
        res.redirect(redirectUrl);
    }
};

module.exports = {
    requireAdmin,
    requireSuperAdmin,
    ADMIN_COOKIE,
    JWT_SECRET
};
