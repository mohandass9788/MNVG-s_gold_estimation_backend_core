const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            select: {
                phone: true,
                role: true,
                name: true,
                shop_name: true
            }
        });
        console.log(JSON.stringify(users, null, 2));
    } catch (e) {
        console.error("Error fetching users:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
