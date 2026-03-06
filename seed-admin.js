// seed-admin.js — Run once to create an admin account
// Usage: node seed-admin.js
require('dotenv').config();
const prisma = require('./prisma/client');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    const phone = process.argv[2] || '9999999999';
    const password = process.argv[3] || 'Admin@123';

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
        if (existing.role !== 'admin') {
            await prisma.user.update({ where: { phone }, data: { role: 'admin' } });
            console.log(`✅ Existing user ${phone} promoted to admin.`);
        } else {
            console.log(`ℹ️  Admin with phone ${phone} already exists.`);
        }
        await prisma.$disconnect();
        return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
        data: {
            id: uuidv4(),
            phone,
            password: hashed,
            name: 'Super Admin',
            shop_name: 'MNV Groups',
            role: 'admin',
            max_allowed_devices: 10,
            is_trial: false,
        }
    });
    console.log(`✅ Admin created!`);
    console.log(`   Phone   : ${phone}`);
    console.log(`   Password: ${password}`);
    console.log(`   ID      : ${admin.id}`);
    await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
