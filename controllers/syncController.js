const prisma = require('../prisma/client');

// Sync Local DB App data up to Cloud DB
exports.pushData = async (req, res) => {
    try {
        const { userId } = req.user;
        const { estimations, purchases, repairs, employees, customers } = req.body;

        const syncResults = {
            estimations: 0,
            purchases: 0,
            repairs: 0,
            employees: 0,
            customers: 0
        };

        // Use Prisma Transactions for safer bulk updates
        await prisma.$transaction(async (tx) => {
            // 1. Sync Estimations
            if (estimations && Array.isArray(estimations)) {
                for (const est of estimations) {
                    await tx.estimation.upsert({
                        where: { userId_local_id: { userId, local_id: est.local_id } },
                        update: { ...est, userId },
                        create: { ...est, userId }
                    });
                    syncResults.estimations++;
                }
            }

            // 2. Sync Purchases
            if (purchases && Array.isArray(purchases)) {
                for (const pur of purchases) {
                    await tx.purchase.upsert({
                        where: { userId_local_id: { userId, local_id: pur.local_id } },
                        update: { ...pur, userId },
                        create: { ...pur, userId }
                    });
                    syncResults.purchases++;
                }
            }

            // 3. Sync Repairs
            if (repairs && Array.isArray(repairs)) {
                for (const rep of repairs) {
                    await tx.repair.upsert({
                        where: { userId_local_id: { userId, local_id: rep.local_id } },
                        update: { ...rep, userId },
                        create: { ...rep, userId }
                    });
                    syncResults.repairs++;
                }
            }

            // 4. Sync Employees
            if (employees && Array.isArray(employees)) {
                for (const emp of employees) {
                    await tx.employee.upsert({
                        where: { userId_local_id: { userId, local_id: emp.local_id } },
                        update: { ...emp, userId },
                        create: { ...emp, userId }
                    });
                    syncResults.employees++;
                }
            }

            // 5. Sync Customers
            if (customers && Array.isArray(customers)) {
                for (const cus of customers) {
                    // Note: phone needs to be handled properly for duplicates, but we use local_id for sync identity
                    await tx.customer.upsert({
                        where: { userId_local_id: { userId, local_id: cus.local_id } },
                        update: { ...cus, userId },
                        create: { ...cus, userId }
                    });
                    syncResults.customers++;
                }
            }
        });

        res.status(200).json({ message: 'Sync Successful', details: syncResults });
    } catch (error) {
        console.error('Push Sync Error:', error);
        res.status(500).json({ error: 'Failed to sync data to server', message: error.message });
    }
};

// Retrieve all customer data from Cloud to device
exports.pullData = async (req, res) => {
    try {
        const { userId } = req.user;

        // Fetch all related data in parallel
        const [estimations, purchases, repairs, employees, customers] = await Promise.all([
            prisma.estimation.findMany({ where: { userId } }),
            prisma.purchase.findMany({ where: { userId } }),
            prisma.repair.findMany({ where: { userId } }),
            prisma.employee.findMany({ where: { userId } }),
            prisma.customer.findMany({ where: { userId } })
        ]);

        const backupData = {
            estimations,
            purchases,
            repairs,
            employees,
            customers
        };

        res.status(200).json({
            status: 'success',
            message: 'Backup data retrieved successfully',
            data: backupData
        });

    } catch (error) {
        console.error('Pull Sync Error:', error);
        res.status(500).json({ error: 'Failed to retrieve backup data', message: error.message });
    }
};
