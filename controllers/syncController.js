const prisma = require('../prisma/client');
const { v4: uuidv4 } = require('uuid');

console.log(">>> SYNC_ENGINE_V4_LOADED <<<");

// Sync Local DB App data up to Cloud DB
exports.pushData = async (req, res) => {
    try {
        const { userId } = req.user;
        console.log(">>> SYNC_VERSION_3 STARTING <<<");
        const { estimations, purchases, repairs, employees, customers } = req.body;

        const syncResults = {
            estimations: 0,
            purchases: 0,
            repairs: 0,
            employees: 0,
            customers: 0
        };

        // Helper to pick and coerce types
        const cleanData = (input, schema) => {
            const result = {};
            for (const [key, type] of Object.entries(schema)) {
                if (input[key] === undefined || input[key] === null) continue;

                if (type === 'Int') {
                    result[key] = parseInt(input[key]) || 0;
                } else if (type === 'Float') {
                    result[key] = parseFloat(input[key]) || 0;
                } else if (type === 'Json') {
                    if (typeof input[key] === 'string') {
                        try { result[key] = JSON.parse(input[key]); } catch (e) { result[key] = {}; }
                    } else {
                        result[key] = input[key];
                    }
                } else {
                    result[key] = input[key];
                }
            }
            return result;
        };

        const schemas = {
            estimation: { local_id: 'String', bill_no: 'Int', customer_name: 'String', customer_phone: 'String', total_amount: 'Float', items: 'Json', status: 'String' },
            purchase: { local_id: 'String', bill_no: 'Int', customer_name: 'String', customer_phone: 'String', total_amount: 'Float', items: 'Json' },
            repair: { local_id: 'String', receipt_no: 'Int', customer_name: 'String', customer_phone: 'String', item_desc: 'String', estimated_cost: 'Float', advance_paid: 'Float', status: 'String', date: 'String' },
            employee: { local_id: 'String', name: 'String', phone: 'String', role: 'String', salary: 'Float', status: 'String' },
            customer: { local_id: 'String', name: 'String', phone: 'String', address: 'String', total_visits: 'Int' }
        };

        // Use Prisma Transactions for safer bulk updates
        await prisma.$transaction(async (tx) => {
            // 1. Sync Estimations
            if (estimations && Array.isArray(estimations)) {
                for (const est of estimations) {
                    try {
                        const data = cleanData(est, schemas.estimation);
                        const existing = await tx.estimation.findFirst({
                            where: { userId, local_id: est.local_id }
                        });

                        if (existing) {
                            await tx.estimation.update({
                                where: { id: existing.id },
                                data: { ...data, userId }
                            });
                        } else {
                            await tx.estimation.create({
                                data: { ...data, userId, id: uuidv4() }
                            });
                        }
                        syncResults.estimations++;
                    } catch (e) { console.error(`Failed to sync estimation ${est.local_id}:`, e.message); }
                }
            }

            // 2. Sync Purchases
            if (purchases && Array.isArray(purchases)) {
                for (const pur of purchases) {
                    try {
                        const data = cleanData(pur, schemas.purchase);
                        const existing = await tx.purchase.findFirst({
                            where: { userId, local_id: pur.local_id }
                        });

                        if (existing) {
                            await tx.purchase.update({
                                where: { id: existing.id },
                                data: { ...data, userId }
                            });
                        } else {
                            await tx.purchase.create({
                                data: { ...data, userId, id: uuidv4() }
                            });
                        }
                        syncResults.purchases++;
                    } catch (e) { console.error(`Failed to sync purchase ${pur.local_id}:`, e.message); }
                }
            }

            // 3. Sync Repairs
            if (repairs && Array.isArray(repairs)) {
                for (const rep of repairs) {
                    try {
                        const data = cleanData(rep, schemas.repair);
                        const existing = await tx.repair.findFirst({
                            where: { userId, local_id: rep.local_id }
                        });

                        if (existing) {
                            await tx.repair.update({
                                where: { id: existing.id },
                                data: { ...data, userId }
                            });
                        } else {
                            await tx.repair.create({
                                data: { ...data, userId, id: uuidv4() }
                            });
                        }
                        syncResults.repairs++;
                    } catch (e) { console.error(`Failed to sync repair ${rep.local_id}:`, e.message); }
                }
            }

            // 4. Sync Employees
            if (employees && Array.isArray(employees)) {
                for (const emp of employees) {
                    try {
                        const data = cleanData(emp, schemas.employee);
                        const existing = await tx.employee.findFirst({
                            where: { userId, local_id: emp.local_id }
                        });

                        if (existing) {
                            await tx.employee.update({
                                where: { id: existing.id },
                                data: { ...data, userId }
                            });
                        } else {
                            await tx.employee.create({
                                data: { ...data, userId, id: uuidv4() }
                            });
                        }
                        syncResults.employees++;
                    } catch (e) { console.error(`Failed to sync employee ${emp.local_id}:`, e.message); }
                }
            }

            // 5. Sync Customers
            if (customers && Array.isArray(customers)) {
                for (const cus of customers) {
                    try {
                        const data = cleanData(cus, schemas.customer);
                        const existing = await tx.customer.findFirst({
                            where: { userId, local_id: cus.local_id }
                        });

                        if (existing) {
                            await tx.customer.update({
                                where: { id: existing.id },
                                data: { ...data, userId }
                            });
                        } else {
                            await tx.customer.create({
                                data: { ...data, userId, id: uuidv4() }
                            });
                        }
                        syncResults.customers++;
                    } catch (e) { console.error(`Failed to sync customer ${cus.local_id}:`, e.message); }
                }
            }
        });

        res.status(200).json({ message: 'Sync Successful [V5_MANUAL]', details: syncResults });
    } catch (error) {
        console.error('Push Sync Error:', error);
        res.status(500).json({ error: 'Failed to sync data to server', message: error.message });
    }
};

// Retrieve all customer data from Cloud to device
exports.pullData = async (req, res) => {
    try {
        const { userId } = req.user;

        // Fetch all related data in parallel with safe selectors to avoid missing column crashes
        const [estimations, purchases, repairs, employees, customers] = await Promise.all([
            prisma.estimation.findMany({ 
                where: { userId },
                select: { id: true, local_id: true, bill_no: true, customer_name: true, customer_phone: true, total_amount: true, items: true, date: true, userId: true }
            }),
            prisma.purchase.findMany({ where: { userId } }),
            prisma.repair.findMany({ 
                where: { userId },
                select: { id: true, local_id: true, receipt_no: true, customer_name: true, customer_phone: true, item_desc: true, estimated_cost: true, advance_paid: true, status: true, date: true, userId: true }
            }),
            prisma.employee.findMany({ 
                where: { userId }, 
                select: { id: true, local_id: true, name: true, phone: true, role: true, salary: true, userId: true }
            }),
            prisma.customer.findMany({ where: { userId } })
        ]);

        // Post-process to add missing status if needed (so app doesn't crash)
        const backupData = {
            estimations: estimations.map(e => ({ ...e, status: e.status || 'active' })),
            purchases,
            repairs,
            employees: employees.map(emp => ({ ...emp, status: emp.status || 'active' })),
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

/**
 * Save remote diagnostic logs from the mobile app
 */
exports.saveLog = async (req, res) => {
    try {
        const { level, message, device_info } = req.body;
        const userId = req.user?.id;

        await prisma.app_log.create({
            data: {
                userId: userId || null,
                level: level || 'info',
                message: message || 'No message',
                device_info: device_info || {}
            }
        });

        res.status(201).json({ status: 'success' });
    } catch (error) {
        console.error('Log Save Error:', error);
        res.status(500).json({ error: 'Failed to save log' });
    }
};

/**
 * Update the push notification token for the current session
 */
exports.updateDeviceToken = async (req, res) => {
    try {
        const { pushToken } = req.body;

        if (!pushToken) {
            return res.status(400).json({ error: 'Push token is required' });
        }

        // Ensure current session exists (req.session is attached by authMiddleware)
        if (!req.session || !req.session.id) {
            return res.status(401).json({ error: 'No active session found' });
        }

        await prisma.session.update({
            where: { id: req.session.id },
            data: { push_token: pushToken }
        });

        res.status(200).json({
            status: 'success',
            message: 'Device token updated successfully'
        });

    } catch (error) {
        console.error('Update Token Error:', error);
        res.status(500).json({ error: 'Failed to update device token' });
    }
};
