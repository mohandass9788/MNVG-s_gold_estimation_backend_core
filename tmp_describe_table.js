const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const columns = await prisma.$queryRawUnsafe(`DESCRIBE employee;`);
        console.log("EMPLOYEE TABLE STRUCTURE:");
        console.table(columns);
    } catch (error) {
        console.error("Failed to describe table:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
