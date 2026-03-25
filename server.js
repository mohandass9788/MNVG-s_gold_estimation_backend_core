const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Set View Engine for HTMX Admin Panel
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public'))); // For static assets like CSS/JS

// Routes
const authRoutes = require('./routes/authRoutes');
const syncRoutes = require('./routes/syncRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const reportRoutes = require('./routes/reportRoutes');
const productRoutes = require('./routes/productRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Swagger Documentation Point (Protected by Admin Auth)
const { requireAdmin } = require('./middlewares/adminAuth');
app.use('/api-docs', requireAdmin, swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/product', productRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeStr = `${hours}P ${minutes}M ${seconds}S`.replace('P', 'h').replace('M', 'm').replace('S', 's');

    res.render('index', {
        version: 'V100',
        uptime: uptimeStr,
        serverTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) + ' ' + new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
