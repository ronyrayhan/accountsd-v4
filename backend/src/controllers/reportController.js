const { Account, Transaction, TransactionHistory, AccountHistory, GlobalSetting, Bill } = require('../models');
const { logger } = require('../utils/logger');

/**
 * Get Trial Balance using MongoDB Aggregation Pipeline
 * Performance: ~10x faster than JavaScript loops for 1000+ accounts
 */
const getTrialBalance = async (req, res) => {
    try {
        // Use aggregation to compute debit/credit for BDT
        const bdtPipeline = await Account.aggregate([
            {
                $project: {
                    code: 1,
                    name: 1,
                    type: 1,
                    isDebitNature: {
                        $in: ['$type', ['Asset', 'Expense']]
                    },
                    balance: '$current_balance_bdt'
                }
            },
            {
                $project: {
                    code: 1,
                    name: 1,
                    type: 1,
                    debit: {
                        $cond: [
                            { $eq: ['$isDebitNature', true] },
                            { $cond: [{ $gte: ['$balance', 0] }, '$balance', 0] },
                            { $cond: [{ $lt: ['$balance', 0] }, { $abs: '$balance' }, 0] }
                        ]
                    },
                    credit: {
                        $cond: [
                            { $eq: ['$isDebitNature', true] },
                            { $cond: [{ $lt: ['$balance', 0] }, { $abs: '$balance' }, 0] },
                            { $cond: [{ $gte: ['$balance', 0] }, '$balance', 0] }
                        ]
                    }
                }
            },
            {
                $facet: {
                    entries: [
                        { $project: { code: 1, account: '$name', type: 1, debit: 1, credit: 1 } }
                    ],
                    totals: [
                        {
                            $group: {
                                _id: null,
                                total_debit: { $sum: '$debit' },
                                total_credit: { $sum: '$credit' }
                            }
                        }
                    ]
                }
            }
        ]);

        // Use aggregation to compute debit/credit for USD
        const usdPipeline = await Account.aggregate([
            {
                $project: {
                    code: 1,
                    name: 1,
                    type: 1,
                    isDebitNature: {
                        $in: ['$type', ['Asset', 'Expense']]
                    },
                    balance: '$current_balance_usd'
                }
            },
            {
                $project: {
                    code: 1,
                    name: 1,
                    type: 1,
                    debit: {
                        $cond: [
                            { $eq: ['$isDebitNature', true] },
                            { $cond: [{ $gte: ['$balance', 0] }, '$balance', 0] },
                            { $cond: [{ $lt: ['$balance', 0] }, { $abs: '$balance' }, 0] }
                        ]
                    },
                    credit: {
                        $cond: [
                            { $eq: ['$isDebitNature', true] },
                            { $cond: [{ $lt: ['$balance', 0] }, { $abs: '$balance' }, 0] },
                            { $cond: [{ $gte: ['$balance', 0] }, '$balance', 0] }
                        ]
                    }
                }
            },
            {
                $facet: {
                    entries: [
                        { $project: { code: 1, account: '$name', type: 1, debit: 1, credit: 1 } }
                    ],
                    totals: [
                        {
                            $group: {
                                _id: null,
                                total_debit: { $sum: '$debit' },
                                total_credit: { $sum: '$credit' }
                            }
                        }
                    ]
                }
            }
        ]);

        const bdtResult = bdtPipeline[0];
        const usdResult = usdPipeline[0];

        const bdtTotals = bdtResult.totals[0] || { total_debit: 0, total_credit: 0 };
        const usdTotals = usdResult.totals[0] || { total_debit: 0, total_credit: 0 };

        res.json({
            bdt: {
                entries: bdtResult.entries,
                total_debit: bdtTotals.total_debit,
                total_credit: bdtTotals.total_credit,
                is_balanced: Math.abs(bdtTotals.total_debit - bdtTotals.total_credit) < 0.01
            },
            usd: {
                entries: usdResult.entries,
                total_debit: usdTotals.total_debit,
                total_credit: usdTotals.total_credit,
                is_balanced: Math.abs(usdTotals.total_debit - usdTotals.total_credit) < 0.01
            }
        });
    } catch (error) {
        logger.error('Trial Balance error', { error: error.message, stack: error.stack });
        res.status(500).json({ detail: error.message });
    }
};

const getCustomSummary = async (req, res) => {
    try {
        const { range } = req.query;
        const now = new Date();
        let start, end = new Date(now);
        end.setUTCHours(23, 59, 59, 999);

        if (range === 'yesterday') {
            const yesterday = new Date();
            yesterday.setUTCDate(now.getUTCDate() - 1);
            start = new Date(yesterday.setUTCHours(0, 0, 0, 0));
            end = new Date(yesterday.setUTCHours(23, 59, 59, 999));
        } else {
            start = new Date(now);
            start.setUTCHours(0, 0, 0, 0);
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
                    source_type: { $ne: 'Transfer' },
                    $or: [
                        { currency: 'BDT' },
                        {
                            currency: 'USD',
                            source_type: { $ne: 'Exchange' },
                            converted_amount_bdt: { $exists: true, $ne: null }
                        }
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
                    source_type: { $ne: 'Transfer' },
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
        const { startDate, endDate, limit } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setUTCHours(23, 59, 59, 999);
                query.timestamp.$lte = end;
            }
        }

        let mongoQuery = SystemLog.find(query).sort({ timestamp: -1 });

        // Default limit is 300, but can be overridden by 'all' or a specific number
        if (limit !== 'all') {
            mongoQuery = mongoQuery.limit(parseInt(limit) || 300);
        }

        const logs = await mongoQuery;

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

const getCapexOpexStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate) : new Date();
        end.setUTCHours(23, 59, 59, 999);

        // Helper to merge aggregation results
        const mergeResults = (txnData, billData, keyFn) => {
            const map = new Map();

            // Add transaction data
            txnData.forEach(item => {
                const key = keyFn(item);
                map.set(key, {
                    ...item,
                    total: item.total || 0,
                    total_usd: item.total_usd || 0
                });
            });

            // Merge bill data
            billData.forEach(item => {
                const key = keyFn(item);
                if (map.has(key)) {
                    const existing = map.get(key);
                    map.set(key, {
                        ...existing,
                        total: existing.total + (item.total || 0),
                        total_usd: existing.total_usd + (item.total_usd || 0),
                        count: (existing.count || 0) + (item.count || 0)
                    });
                } else {
                    map.set(key, {
                        ...item,
                        total: item.total || 0,
                        total_usd: item.total_usd || 0
                    });
                }
            });

            return Array.from(map.values());
        };

        // 1. Transaction Totals Pipeline
        const txnTotalsPipeline = [
            {
                $match: {
                    type: 'Debit',
                    source_type: { $nin: ['Transfer', 'Exchange'] },
                    $expr: {
                        $and: [
                            { $gte: [{ $ifNull: ["$invoice_date", "$date"] }, start] },
                            { $lte: [{ $ifNull: ["$invoice_date", "$date"] }, end] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: { $ifNull: ["$expense_type", "Uncategorized"] },
                    total: { $sum: { $ifNull: ["$converted_amount_bdt", "$amount"] } },
                    total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } },
                    count: { $sum: 1 }
                }
            }
        ];

        // 2. Bill Totals Pipeline (Unpaid only)
        const billTotalsPipeline = [
            {
                $match: {
                    status: 'Unpaid',
                    invoice_date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: { $ifNull: ["$expense_type", "Uncategorized"] },
                    total: { $sum: { $cond: [{ $eq: ["$currency", "BDT"] }, "$amount", 0] } },
                    total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } },
                    count: { $sum: 1 }
                }
            }
        ];

        // 3. Transaction Trend Pipeline
        const txnTrendPipeline = [
            {
                $match: {
                    type: 'Debit',
                    source_type: { $nin: ['Transfer', 'Exchange'] },
                    $expr: {
                        $and: [
                            { $gte: [{ $ifNull: ["$invoice_date", "$date"] }, start] },
                            { $lte: [{ $ifNull: ["$invoice_date", "$date"] }, end] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: { $ifNull: ["$invoice_date", "$date"] } },
                        year: { $year: { $ifNull: ["$invoice_date", "$date"] } },
                        type: { $ifNull: ["$expense_type", "Uncategorized"] }
                    },
                    total: { $sum: { $ifNull: ["$converted_amount_bdt", "$amount"] } },
                    total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ];

        // 4. Bill Trend Pipeline
        const billTrendPipeline = [
            {
                $match: {
                    status: 'Unpaid',
                    invoice_date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$invoice_date" },
                        year: { $year: "$invoice_date" },
                        type: { $ifNull: ["$expense_type", "Uncategorized"] }
                    },
                    total: { $sum: { $cond: [{ $eq: ["$currency", "BDT"] }, "$amount", 0] } },
                    total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ];

        // 5. Transaction Categories Pipeline
        const txnCategoryPipeline = [
            {
                $match: {
                    type: 'Debit',
                    source_type: { $nin: ['Transfer', 'Exchange'] },
                    $expr: {
                        $and: [
                            { $gte: [{ $ifNull: ["$invoice_date", "$date"] }, start] },
                            { $lte: [{ $ifNull: ["$invoice_date", "$date"] }, end] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        type: { $ifNull: ["$expense_type", "Uncategorized"] },
                        category: { $ifNull: ["$expense_category", "Uncategorized"] }
                    },
                    total: { $sum: { $ifNull: ["$converted_amount_bdt", "$amount"] } },
                    total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } }
                }
            },
            { $sort: { total: -1 } }
        ];

        // 6. Bill Categories Pipeline
        const billCategoryPipeline = [
            {
                $match: {
                    status: 'Unpaid',
                    invoice_date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        type: { $ifNull: ["$expense_type", "Uncategorized"] },
                        category: { $ifNull: ["$expense_category", "Uncategorized"] }
                    },
                    total: { $sum: { $cond: [{ $eq: ["$currency", "BDT"] }, "$amount", 0] } },
                    total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } }
                }
            },
            { $sort: { total: -1 } }
        ];

        // Execute all aggregations in parallel
        const [txnTotals, billTotals, txnTrend, billTrend, txnCategories, billCategories, txnList, billList] = await Promise.all([
            Transaction.aggregate(txnTotalsPipeline),
            Bill.aggregate(billTotalsPipeline),
            Transaction.aggregate(txnTrendPipeline),
            Bill.aggregate(billTrendPipeline),
            Transaction.aggregate(txnCategoryPipeline),
            Bill.aggregate(billCategoryPipeline),
            Transaction.find({
                type: 'Debit',
                source_type: { $nin: ['Transfer', 'Exchange'] },
                $expr: {
                    $and: [
                        { $gte: [{ $ifNull: ["$invoice_date", "$date"] }, start] },
                        { $lte: [{ $ifNull: ["$invoice_date", "$date"] }, end] }
                    ]
                }
            }).sort({ invoice_date: -1, date: -1 }).limit(100).populate('account_id'),
            Bill.find({
                status: 'Unpaid',
                invoice_date: { $gte: start, $lte: end }
            }).sort({ invoice_date: -1 })
        ]);

        // Merge results
        const totals = mergeResults(txnTotals, billTotals, item => item._id);
        const trend = mergeResults(txnTrend, billTrend, item => `${item._id.year}-${item._id.month}-${item._id.type}`);
        const categories = mergeResults(txnCategories, billCategories, item => `${item._id.type}-${item._id.category}`);

        // Normalize bills for list display
        const normalizedBills = billList.map(bill => ({
            _id: bill._id,
            date: bill.invoice_date,
            invoice_date: bill.invoice_date,
            description: `${bill.description} (Unpaid Bill - ${bill.company_name})`,
            amount: bill.amount,
            currency: bill.currency,
            expense_type: bill.expense_type,
            expense_category: bill.expense_category,
            account: { name: 'Accounts Payable' },
            trx_id: 'PENDING',
            is_pending_bill: true
        }));

        // Combine and sort list
        const list = [...txnList, ...normalizedBills].sort((a, b) =>
            new Date(b.invoice_date || b.date) - new Date(a.invoice_date || a.date)
        );

        res.json({ totals, trend, list, categories });
    } catch (error) {
        console.error('CapexOpex Error:', error);
        res.status(500).json({ detail: error.message });
    }
};

const exportCapexOpex = async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate) : new Date();
        end.setUTCHours(23, 59, 59, 999);

        // Reuse the same aggregation logic from getCapexOpexStats
        // (Copy the pipelines and execution from getCapexOpexStats)
        const mergeResults = (txnData, billData, keyFn) => {
            const map = new Map();
            txnData.forEach(item => {
                const key = keyFn(item);
                map.set(key, { ...item, total: item.total || 0, total_usd: item.total_usd || 0 });
            });
            billData.forEach(item => {
                const key = keyFn(item);
                if (map.has(key)) {
                    const existing = map.get(key);
                    map.set(key, {
                        ...existing,
                        total: existing.total + (item.total || 0),
                        total_usd: existing.total_usd + (item.total_usd || 0),
                        count: (existing.count || 0) + (item.count || 0)
                    });
                } else {
                    map.set(key, { ...item, total: item.total || 0, total_usd: item.total_usd || 0 });
                }
            });
            return Array.from(map.values());
        };

        // Transaction and Bill pipelines (same as getCapexOpexStats)
        const txnTotalsPipeline = [
            { $match: { type: 'Debit', source_type: { $nin: ['Transfer', 'Exchange'] }, $expr: { $and: [{ $gte: [{ $ifNull: ["$invoice_date", "$date"] }, start] }, { $lte: [{ $ifNull: ["$invoice_date", "$date"] }, end] }] } } },
            { $group: { _id: { $ifNull: ["$expense_type", "Uncategorized"] }, total: { $sum: { $ifNull: ["$converted_amount_bdt", "$amount"] } }, total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } }, count: { $sum: 1 } } }
        ];
        const billTotalsPipeline = [
            { $match: { status: 'Unpaid', invoice_date: { $gte: start, $lte: end } } },
            { $group: { _id: { $ifNull: ["$expense_type", "Uncategorized"] }, total: { $sum: { $cond: [{ $eq: ["$currency", "BDT"] }, "$amount", 0] } }, total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } }, count: { $sum: 1 } } }
        ];
        const txnCategoryPipeline = [
            { $match: { type: 'Debit', source_type: { $nin: ['Transfer', 'Exchange'] }, $expr: { $and: [{ $gte: [{ $ifNull: ["$invoice_date", "$date"] }, start] }, { $lte: [{ $ifNull: ["$invoice_date", "$date"] }, end] }] } } },
            { $group: { _id: { type: { $ifNull: ["$expense_type", "Uncategorized"] }, category: { $ifNull: ["$expense_category", "Uncategorized"] } }, total: { $sum: { $ifNull: ["$converted_amount_bdt", "$amount"] } }, total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } } } },
            { $sort: { total: -1 } }
        ];
        const billCategoryPipeline = [
            { $match: { status: 'Unpaid', invoice_date: { $gte: start, $lte: end } } },
            { $group: { _id: { type: { $ifNull: ["$expense_type", "Uncategorized"] }, category: { $ifNull: ["$expense_category", "Uncategorized"] } }, total: { $sum: { $cond: [{ $eq: ["$currency", "BDT"] }, "$amount", 0] } }, total_usd: { $sum: { $cond: [{ $eq: ["$currency", "USD"] }, "$amount", 0] } } } },
            { $sort: { total: -1 } }
        ];

        const [txnTotals, billTotals, txnCategories, billCategories, txnList, billList] = await Promise.all([
            Transaction.aggregate(txnTotalsPipeline),
            Bill.aggregate(billTotalsPipeline),
            Transaction.aggregate(txnCategoryPipeline),
            Bill.aggregate(billCategoryPipeline),
            Transaction.find({ type: 'Debit', source_type: { $nin: ['Transfer', 'Exchange'] }, $expr: { $and: [{ $gte: [{ $ifNull: ["$invoice_date", "$date"] }, start] }, { $lte: [{ $ifNull: ["$invoice_date", "$date"] }, end] }] } }).sort({ invoice_date: -1, date: -1 }).populate('account_id'),
            Bill.find({ status: 'Unpaid', invoice_date: { $gte: start, $lte: end } }).sort({ invoice_date: -1 })
        ]);

        const totals = mergeResults(txnTotals, billTotals, item => item._id);
        const categories = mergeResults(txnCategories, billCategories, item => `${item._id.type}-${item._id.category}`);

        const normalizedBills = billList.map(bill => ({
            invoice_date: bill.invoice_date,
            date: bill.invoice_date,
            description: `${bill.description} (Unpaid Bill - ${bill.company_name})`,
            amount: bill.amount,
            currency: bill.currency,
            expense_type: bill.expense_type,
            expense_category: bill.expense_category,
            account: { name: 'Accounts Payable' },
            trx_id: 'PENDING'
        }));

        const allTransactions = [...txnList, ...normalizedBills].sort((a, b) => new Date(b.invoice_date || b.date) - new Date(a.invoice_date || a.date));

        // Create Excel Workbook
        const workbook = new ExcelJS.Workbook();

        // BDT Sheet
        const bdtSheet = workbook.addWorksheet('BDT Report');
        bdtSheet.columns = [
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Amount (BDT)', key: 'amount', width: 15 }
        ];

        // Add summary
        bdtSheet.addRow(['SUMMARY']);
        totals.forEach(t => {
            bdtSheet.addRow({ type: t._id, category: 'Total', amount: t.total });
        });
        bdtSheet.addRow([]);

        // Add categories
        bdtSheet.addRow(['CATEGORY BREAKDOWN']);
        categories.forEach(c => {
            bdtSheet.addRow({ type: c._id.type, category: c._id.category, amount: c.total });
        });
        bdtSheet.addRow([]);

        // Add transactions
        bdtSheet.addRow(['TRANSACTIONS']);
        bdtSheet.addRow(['Date', 'Invoice Date', 'Description', 'Type', 'Category', 'Amount (BDT)', 'Account', 'TRX ID']);
        allTransactions.filter(t => t.currency === 'BDT' || !t.currency).forEach(t => {
            bdtSheet.addRow([
                t.date ? new Date(t.date).toLocaleDateString() : '',
                t.invoice_date ? new Date(t.invoice_date).toLocaleDateString() : '',
                t.description,
                t.expense_type,
                t.expense_category,
                t.amount,
                t.account?.name || t.account_id?.name || '',
                t.trx_id
            ]);
        });

        // USD Sheet
        const usdSheet = workbook.addWorksheet('USD Report');
        usdSheet.columns = [
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Amount (USD)', key: 'amount', width: 15 }
        ];

        usdSheet.addRow(['SUMMARY']);
        totals.forEach(t => {
            usdSheet.addRow({ type: t._id, category: 'Total', amount: t.total_usd });
        });
        usdSheet.addRow([]);

        usdSheet.addRow(['CATEGORY BREAKDOWN']);
        categories.forEach(c => {
            usdSheet.addRow({ type: c._id.type, category: c._id.category, amount: c.total_usd });
        });
        usdSheet.addRow([]);

        usdSheet.addRow(['TRANSACTIONS']);
        usdSheet.addRow(['Date', 'Invoice Date', 'Description', 'Type', 'Category', 'Amount (USD)', 'Account', 'TRX ID']);
        allTransactions.filter(t => t.currency === 'USD').forEach(t => {
            usdSheet.addRow([
                t.date ? new Date(t.date).toLocaleDateString() : '',
                t.invoice_date ? new Date(t.invoice_date).toLocaleDateString() : '',
                t.description,
                t.expense_type,
                t.expense_category,
                t.amount,
                t.account?.name || t.account_id?.name || '',
                t.trx_id
            ]);
        });

        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=CapEx_OpEx_Report_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ detail: error.message });
    }
};

module.exports = {
    getTrialBalance,
    getCustomSummary,
    getStats,
    getSystemLogs,
    getPrediction,
    getCapexOpexStats,
    exportCapexOpex
};
