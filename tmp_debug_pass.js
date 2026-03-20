const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany({
        select: { phone: true, role: true, plain_password: true },
        take: 20
    });
    console.log(JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}
check();
