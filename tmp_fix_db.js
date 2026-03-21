const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking and fixing database columns...");
    try {
        // Add 'status' to employee
        try {
            console.log("Adding 'status' to 'employee'...");
            await prisma.$executeRawUnsafe(`ALTER TABLE employee ADD COLUMN status VARCHAR(64) DEFAULT 'active';`);
        } catch(e) { console.log("Note: employee.status likely already exists."); }

        // Add 'status' to estimation
        try {
            console.log("Adding 'status' to 'estimation'...");
            await prisma.$executeRawUnsafe(`ALTER TABLE estimation ADD COLUMN status VARCHAR(64) DEFAULT 'active';`);
        } catch(e) { console.log("Note: estimation.status likely already exists."); }

        console.log("Database schema fix complete!");
    } catch (error) {
        console.error("Failed to fix schema:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
