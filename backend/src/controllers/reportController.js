const { Account, Transaction, TransactionHistory, AccountHistory, GlobalSetting } = require('../models');

const getTrialBalance = async (req, res) => {
    try {
        const accounts = await Account.find();
        const bdt_entries = [];
        const usd_entries = [];
        let t_debit_bdt = 0, t_credit_bdt = 0;
        let t_debit_usd = 0, t_credit_usd = 0;

        accounts.forEach(acc => {
            const isDebitNature = ['Asset', 'Expense'].includes(acc.type);

            // BDT
            let d_bdt = 0, c_bdt = 0;
            if (isDebitNature) {
                if (acc.current_balance_bdt >= 0) d_bdt = acc.current_balance_bdt;
                else c_bdt = Math.abs(acc.current_balance_bdt);
            } else {
                if (acc.current_balance_bdt >= 0) c_bdt = acc.current_balance_bdt;
                else d_bdt = Math.abs(acc.current_balance_bdt);
            }
            t_debit_bdt += d_bdt;
            t_credit_bdt += c_bdt;
            bdt_entries.push({ code: acc.code, account: acc.name, type: acc.type, debit: d_bdt, credit: c_bdt });

            // USD
            let d_usd = 0, c_usd = 0;
            if (isDebitNature) {
                if (acc.current_balance_usd >= 0) d_usd = acc.current_balance_usd;
                else c_usd = Math.abs(acc.current_balance_usd);
            } else {
                if (acc.current_balance_usd >= 0) c_usd = acc.current_balance_usd;
                else d_usd = Math.abs(acc.current_balance_usd);
            }
            t_debit_usd += d_usd;
            t_credit_usd += c_usd;
            usd_entries.push({ code: acc.code, account: acc.name, type: acc.type, debit: d_usd, credit: c_usd });
        });

        res.json({
            bdt: { entries: bdt_entries, total_debit: t_debit_bdt, total_credit: t_credit_bdt, is_balanced: Math.abs(t_debit_bdt - t_credit_bdt) < 0.01 },
            usd: { entries: usd_entries, total_debit: t_debit_usd, total_credit: t_credit_usd, is_balanced: Math.abs(t_debit_usd - t_credit_usd) < 0.01 }
        });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getCustomSummary = async (req, res) => {
    try {
        const { range } = req.query;
        const now = new Date();
        let start, end = new Date(now.setHours(23, 59, 59, 999));

        if (range === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            start = new Date(yesterday.setHours(0, 0, 0, 0));
            end = new Date(yesterday.setHours(23, 59, 59, 999));
        } else {
            start = new Date(now.setHours(0, 0, 0, 0));
        }

        const spend_bdt_agg = await Transaction.aggregate([
            {
                $match: {
                    type: 'Debit',
                    source_type: { $nin: ['Transfer', 'Exchange'] },
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ["$converted_amount_bdt", "$amount"] } }
                }
            }
        ]);
        const spend_bdt = (spend_bdt_agg.length > 0) ? spend_bdt_agg[0].total : 0;

        const spend_usd_agg = await Transaction.aggregate([
            {
                $match: {
                    type: 'Debit',
                    currency: 'USD',
                    conversion_type: 'None',
                    source_type: { $nin: ['Transfer', 'Exchange'] },
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" }
                }
            }
        ]);
        const spend_usd = (spend_usd_agg.length > 0) ? spend_usd_agg[0].total : 0;

        res.json({ spend_bdt, spend_usd, start: start.toISOString(), end: end.toISOString() });
    } catch (error) {
        console.error('getCustomSummary error:', error);
        res.status(500).json({ detail: error.message });
    }
};

const getStats = async (req, res) => {
    try {
        const bdtStats = await Transaction.aggregate([
            {
                $match: {
                    source_type: { $nin: ['Transfer', 'Exchange'] },
                    $or: [
                        { currency: 'BDT' },
                        { converted_amount_bdt: { $exists: true, $ne: null } }
                    ]
                }
            },
            {
                $group: {
                    _id: { account_id: "$account_id", type: "$type" },
                    total_bdt: { $sum: { $ifNull: ["$converted_amount_bdt", "$amount"] } }
                }
            }
        ]);

        const usdStats = await Transaction.aggregate([
            {
                $match: {
                    source_type: { $nin: ['Transfer', 'Exchange'] },
                    currency: 'USD'
                }
            },
            {
                $group: {
                    _id: { account_id: "$account_id", type: "$type" },
                    total_usd: { $sum: "$amount" }
                }
            }
        ]);

        const stats = {
            bdt: { debit: {}, credit: {} },
            usd: { debit: {}, credit: {} }
        };

        bdtStats.forEach(row => {
            const typeKey = row._id.type.toLowerCase();
            if (stats.bdt[typeKey]) {
                stats.bdt[typeKey][row._id.account_id.toString()] = parseFloat(row.total_bdt) || 0;
            }
        });

        usdStats.forEach(row => {
            const typeKey = row._id.type.toLowerCase();
            if (stats.usd[typeKey]) {
                stats.usd[typeKey][row._id.account_id.toString()] = parseFloat(row.total_usd) || 0;
            }
        });

        res.json(stats);
    } catch (error) {
        console.error('getStats error:', error);
        res.status(500).json({ detail: error.message });
    }
};

const getSystemLogs = async (req, res) => {
    try {
        const { SystemLog } = require('../models');
        const logs = await SystemLog.find()
            .sort({ timestamp: -1 })
            .limit(300);

        const mapped = logs.map(l => ({
            time: l.timestamp,
            user: l.user,
            action: l.action,
            detail: l.detail,
            type: l.type
        }));

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getPrediction = async (req, res) => {
    try {
        const days_ahead = parseInt(req.query.days_ahead) || 30;
        const txns = await Transaction.find({ type: 'Debit' });

        if (!txns.length) {
            return res.json({ total_predicted: 0, daily_average: 0, message: 'Not enough data' });
        }

        const dailySpendMap = {};
        txns.forEach(t => {
            const date = new Date(t.date).toISOString().split('T')[0];
            const amount = parseFloat(t.amount);
            dailySpendMap[date] = (dailySpendMap[date] || 0) + amount;
        });

        const dates = Object.keys(dailySpendMap).sort();
        const start = new Date(dates[0]);
        const end = new Date(dates[dates.length - 1]);
        const dayDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        const totalAmount = Object.values(dailySpendMap).reduce((a, b) => a + b, 0);
        const avg_daily_spend = totalAmount / dayDiff;
        const total_predicted = avg_daily_spend * days_ahead;

        res.json({
            days_ahead,
            daily_average: Math.round(avg_daily_spend * 100) / 100,
            total_predicted: Math.round(total_predicted * 100) / 100,
            method: 'Simple Moving Average'
        });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

module.exports = {
    getTrialBalance,
    getCustomSummary,
    getStats,
    getSystemLogs,
    getPrediction
};
