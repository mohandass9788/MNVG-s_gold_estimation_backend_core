const prisma = require('./prisma/client');
const { v4: uuidv4 } = require('uuid');

async function testSync() {
    const userId = "3c1efb21-6952-4a1a-b48c-97ad72f41cd9"; // From user's error message
    
    // Payload from user
    const payload = {
        "customers": [{"address": "", "id": "1", "local_id": "1", "name": "Ni", "phone": "7000000000", "total_visits": 0}],
        "employees": [{"id": "123", "local_id": "123", "name": "Mohandass", "phone": "9000000000", "role": "Manager", "status": "active"}],
        "estimations": [
            {
                "bill_no": 2, 
                "customer_name": "Estimation #2", 
                "customer_phone": "N/A", 
                "id": "1774045190631", 
                "items": "[{\"id\":\"1774045123805-412\",\"name\":\"Chain\",\"subProductName\":\"Machine Made\",\"pcs\":1,\"grossWeight\":5,\"stoneWeight\":0.5,\"netWeight\":4.5,\"purity\":22,\"makingCharge\":200,\"makingChargeType\":\"perGram\",\"wastage\":10,\"wastageType\":\"percentage\",\"rate\":14600,\"isManual\":true,\"goldValue\":65700,\"makingChargeValue\":900,\"wastageValue\":6570,\"gstValue\":2195.1,\"totalValue\":75365.1,\"metal\":\"GOLD\"}]", 
                "local_id": "1774045190631", 
                "status": "active", 
                "total_amount": 75365.1
            }
        ],
        "purchases": [],
        "repairs": []
    };

    const { estimations, purchases, repairs, employees, customers } = payload;

    const pickFields = (input, allowedKeys) => {
        const result = {};
        allowedKeys.forEach(key => {
            if (input[key] !== undefined) {
                result[key] = input[key];
            }
        });
        if (result.items && typeof result.items === 'string') {
            try {
                result.items = JSON.parse(result.items);
            } catch (e) {
                console.error("JSON Parse Error for items:", e);
            }
        }
        return result;
    };

    const estimationKeys = ['local_id', 'bill_no', 'customer_name', 'customer_phone', 'total_amount', 'items', 'date', 'status'];
    const employeeKeys = ['local_id', 'name', 'phone', 'role', 'salary', 'join_date', 'status'];
    const customerKeys = ['local_id', 'name', 'phone', 'address', 'total_visits'];

    try {
        console.log("Starting Transaction...");
        await prisma.$transaction(async (tx) => {
            // Check if user exists first (Foreign Key constraint)
            let user = await tx.user.findUnique({ where: { id: userId } });
            if (!user) {
                console.log("User not found, creating dummy user...");
                await tx.user.create({
                    data: {
                        id: userId,
                        phone: "9999999999",
                        password: "hash",
                        name: "Test User"
                    }
                });
            }

            for (const emp of employees) {
                console.log("Upserting Employee...");
                const data = pickFields(emp, employeeKeys);
                await tx.employee.upsert({
                    where: { userId_local_id: { userId, local_id: emp.local_id } },
                    update: { ...data, userId },
                    create: { ...data, userId, id: uuidv4() }
                });
            }

            for (const est of estimations) {
                console.log("Upserting Estimation...");
                const data = pickFields(est, estimationKeys);
                await tx.estimation.upsert({
                    where: { userId_local_id: { userId, local_id: est.local_id } },
                    update: { ...data, userId },
                    create: { ...data, userId, id: uuidv4() }
                });
            }
        });
        console.log("Sync Test Passed!");
    } catch (error) {
        console.error("Sync Test Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testSync();
