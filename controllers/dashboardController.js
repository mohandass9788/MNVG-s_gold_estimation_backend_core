const prisma = require('../prisma/client');

/**
 * Get quick summary stats for the mobile app dashboard
 */
exports.getStats = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [estCount, purCount, repCount, estSum] = await Promise.all([
            prisma.estimation.count({ where: { userId } }),
            prisma.purchase.count({ where: { userId } }),
            prisma.repair.count({ where: { userId } }),
            prisma.estimation.aggregate({
                where: { userId },
                _sum: { total_amount: true }
            })
        ]);

        res.json({
            status: 'success',
            data: {
                counts: {
                    estimations: estCount || 0,
                    purchases: purCount || 0,
                    repairs: repCount || 0
                },
                totals: {
                    estimation_value: parseFloat(estSum._sum.total_amount || 0).toFixed(2)
                }
            }
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
