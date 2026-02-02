const { Transaction, Account, GlobalSetting, TransactionHistory, Attachment, AccountPermission } = require('../models');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const fs = require('fs');
const { logEvent } = require('../utils/logger');

const getSetting = async (key, defaultValue) => {
    const setting = await GlobalSetting.findOne({ key });
    return setting ? setting.value : defaultValue;
};

const calculateBalanceAt = async (accountId, date) => {
    const account = await Account.findById(accountId);
    if (!account) return { bdt: 0, usd: 0 };

    let bdt = Number(account.opening_balance_bdt || 0);
    let usd = Number(account.opening_balance_usd || 0);

    // Get all transactions BEFORE the given date (adjusted for local perception if needed)
    // If date is '2026-02-02', we want everything before local 2026-02-02 00:00 (+06:00)
    let targetDate = new Date(date);
    // If it's a mid-night UTC date, adjust it to local mid-night
    if (targetDate.getUTCHours() === 0) {
        targetDate.setUTCHours(targetDate.getUTCHours() - 6);
    }

    const txns = await Transaction.find({
        account_id: accountId,
        date: { $lt: targetDate }
    });

    for (const txn of txns) {
        const amt = Number(txn.amount || 0);
        const convAmt = Number(txn.converted_amount_bdt || 0);

        if (txn.currency === 'BDT') {
            if (txn.type === 'Credit') bdt = Math.round((bdt + amt) * 100) / 100;
            else if (txn.type === 'Debit') bdt = Math.round((bdt - amt) * 100) / 100;
        } else {
            if (txn.conversion_type === 'None' || txn.source_type === 'Exchange') {
                if (txn.type === 'Credit') usd = Math.round((usd + amt) * 100) / 100;
                else if (txn.type === 'Debit') usd = Math.round((usd - amt) * 100) / 100;
            } else {
                const bdtImpact = convAmt;
                if (txn.type === 'Credit') bdt = Math.round((bdt + bdtImpact) * 100) / 100;
                else if (txn.type === 'Debit') bdt = Math.round((bdt - bdtImpact) * 100) / 100;
            }
        }
    }
    return { bdt, usd };
};

/**
 * Recalculates the current balance for a specific account.
 * It fetches all transactions for the account and sums them up from the opening balance.
 * 
 * Logic:
 * - BDT transactions update the BDT balance.
 * - USD transactions update the USD balance IF no conversion happens.
 * - Exchange transactions (Buy/Sell USD) update the respective currency balance.
 * 
 * @param {string} accountId - The account ID to sync
 * @param {object} session - Optional MongoDB session for transactional operations
 */
const syncAccountBalance = async (accountId, session = null) => {
    const account = await Account.findById(accountId).session(session);
    if (!account) return;

    // Start with Opening Balances
    let bdt = Number(account.opening_balance_bdt || 0);
    let usd = Number(account.opening_balance_usd || 0);

    const txns = await Transaction.find({ account_id: account._id }).session(session);

    for (const txn of txns) {
        const amt = Number(txn.amount || 0);
        const convAmt = Number(txn.converted_amount_bdt || 0);

        if (txn.currency === 'BDT') {
            // Simple BDT Transaction
            if (txn.type === 'Credit') bdt = Math.round((bdt + amt) * 100) / 100;
            else if (txn.type === 'Debit') bdt = Math.round((bdt - amt) * 100) / 100;
        } else {
            // USD Transaction logic
            if (txn.conversion_type === 'None' || txn.source_type === 'Exchange') {
                // If it's a direct USD transaction or a Currency Exchange:
                // Update the USD balance directly.
                if (txn.type === 'Credit') usd = Math.round((usd + amt) * 100) / 100;
                else if (txn.type === 'Debit') usd = Math.round((usd - amt) * 100) / 100;
            } else {
                // If it's a Conversion (e.g., spending USD but tracking in BDT equivalent):
                // Update BDT using the converted amount.
                const bdtImpact = convAmt;
                if (txn.type === 'Credit') bdt = Math.round((bdt + bdtImpact) * 100) / 100;
                else if (txn.type === 'Debit') bdt = Math.round((bdt - bdtImpact) * 100) / 100;
            }
        }
    }

    // Save the final calculated balances
    account.current_balance_bdt = bdt;
    account.current_balance_usd = usd;
    await account.save({ session });

    // Automatic Summary Update (Addon Module)
    try {
        const { syncSummaries } = require('./summaryController');
        // We sync for the current date. For imports, the import loop handles other dates if needed.
        await syncSummaries(accountId, new Date());
    } catch (e) {
        // Module might be removed, ignore
    }
};

const createTransaction = async (req, res) => {
    const { withTransaction } = require('../utils/transaction');

    try {
        const {
            description, amount, currency, type, account_id,
            conversion_type, conversion_rate, reference, source_type,
            transfer_target_id, date
        } = req.body;

        const account = await Account.findById(account_id);
        if (!account) {
            return res.status(404).json({ detail: 'Account not found' });
        }

        // Security: Check if the non-admin user has permission for this specific account
        if (req.user.role !== 'Admin') {
            const hasAccess = await AccountPermission.findOne({
                role: req.user.role, account_id, can_access: true
            });
            if (!hasAccess) {
                return res.status(403).json({ detail: `You do not have permission to record entries for ${account.name}` });
            }
        }

        // Special case for Transfer
        if (type === 'Transfer') {
            return await handleTransfer(req, res);
        }

        let finalAmount = parseFloat(amount);
        let finalCurrency = currency;
        let convRate = conversion_rate ? parseFloat(conversion_rate) : null;
        let convAmountBdt = null;

        if (conversion_type !== 'None') {
            if (conversion_type === 'Auto') {
                const rateStr = await getSetting('usd_bdt_rate', '110');
                convRate = parseFloat(rateStr);
            }

            if (currency === 'USD') {
                convAmountBdt = Math.round(finalAmount * convRate * 100) / 100;
                finalAmount = convAmountBdt;
                finalCurrency = 'BDT';
            } else {
                convAmountBdt = null;
                finalAmount = amount;
                finalCurrency = 'BDT';
            }
        }

        if (type === 'Debit') {
            const currentBal = finalCurrency === 'BDT' ? account.current_balance_bdt : account.current_balance_usd;
            if (currentBal < finalAmount) {
                return res.status(400).json({ detail: `Insufficient funds in ${account.name} (${finalCurrency}). Balance: ${currentBal}` });
            }
        }

        // Execute with automatic transaction fallback
        const transaction = await withTransaction(async (session) => {
            const txnData = {
                date: date || new Date(),
                description,
                amount,
                currency,
                type,
                conversion_type,
                conversion_rate: convRate,
                converted_amount_bdt: convAmountBdt,
                reference,
                source_type,
                account_id: account._id
            };

            const created = session
                ? await Transaction.create([txnData], { session })
                : await Transaction.create(txnData);

            const txn = session ? created[0] : created;

            await syncAccountBalance(account_id, session);

            if (req.file) {
                const attachmentData = {
                    file_path: req.file.path,
                    filename: req.file.filename,
                    transaction_id: txn._id
                };

                if (session) {
                    await Attachment.create([attachmentData], { session });
                } else {
                    await Attachment.create(attachmentData);
                }
            }

            return txn;
        });

        await logEvent(req.user.username, 'New Entry', `Created ${type} entry [${transaction.serial_number}] in account ${account.name}: ${description} (${currency} ${amount})`, 'entry');

        res.status(201).json(transaction);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const handleTransfer = async (req, res) => {
    const { withTransaction } = require('../utils/transaction');

    try {
        const {
            description, amount, currency, account_id,
            conversion_type, conversion_rate, date, transfer_target_id
        } = req.body;

        const sender = await Account.findById(account_id);
        const receiver = await Account.findById(transfer_target_id);

        if (!sender || !receiver) {
            return res.status(404).json({ detail: 'One or more accounts not found' });
        }

        const transfer_id = uuidv4();
        const amt = parseFloat(amount);

        // Execute all transfer operations with automatic transaction fallback
        await withTransaction(async (session) => {
            // Case 1: Direct Transfer (No Currency Conversion)
            if (conversion_type === 'None') {
                if (sender._id.toString() === receiver._id.toString()) {
                    throw new Error('Cannot transfer to same account without conversion');
                }

                const currentBal = currency === 'BDT' ? sender.current_balance_bdt : sender.current_balance_usd;
                if (currentBal < amt) {
                    throw new Error('Insufficient funds');
                }

                const debitData = {
                    date: date || new Date(),
                    description: `Transfer ${currency} to ${receiver.name}`,
                    amount: amt, currency, type: 'Debit', account_id: sender._id, transfer_id, source_type: 'Transfer'
                };

                const creditData = {
                    date: date || new Date(),
                    description: `Transfer ${currency} from ${sender.name}`,
                    amount: amt, currency, type: 'Credit', account_id: receiver._id, transfer_id, source_type: 'Transfer'
                };

                if (session) {
                    await Transaction.create([debitData], { session });
                    await Transaction.create([creditData], { session });
                } else {
                    await Transaction.create(debitData);
                    await Transaction.create(creditData);
                }

            } else {
                // Case 2: Transfer with Conversion (Exchange)
                let convRate = conversion_rate ? parseFloat(conversion_rate) : null;
                if (conversion_type === 'Auto') {
                    convRate = parseFloat(await getSetting('usd_bdt_rate', '110'));
                }

                const bdtAmount = currency === 'BDT' ? amt : amt * convRate;

                // Sub-case 2A: Same Account Exchange (Buying USD with BDT)
                if (sender._id.toString() === receiver._id.toString()) {
                    if (sender.current_balance_bdt < bdtAmount) {
                        throw new Error(`Insufficient BDT funds for conversion. Need ${bdtAmount}`);
                    }

                    const transactions = [
                        {
                            date: date || new Date(), description: `Convert BDT to USD from ${sender.name}`,
                            amount: bdtAmount, currency: 'BDT', type: 'Debit', account_id: sender._id, transfer_id,
                            source_type: 'Exchange', conversion_type, conversion_rate: convRate
                        },
                        {
                            date: date || new Date(), description: `Convert BDT to USD to ${sender.name}`,
                            amount: amt, currency: 'USD', type: 'Credit', account_id: sender._id, transfer_id,
                            source_type: 'Exchange', conversion_type, conversion_rate: convRate, converted_amount_bdt: bdtAmount
                        }
                    ];

                    if (session) {
                        for (const txn of transactions) {
                            await Transaction.create([txn], { session });
                        }
                    } else {
                        for (const txn of transactions) {
                            await Transaction.create(txn);
                        }
                    }

                } else {
                    // Sub-case 2B: Transfer to different account WITH conversion
                    if (sender.current_balance_bdt < bdtAmount) {
                        throw new Error(`Insufficient BDT funds for conversion transfer. Need ${bdtAmount}`);
                    }

                    const transactions = [
                        {
                            date: date || new Date(), description: `Transfer BDT from ${sender.name}`,
                            amount: bdtAmount, currency: 'BDT', type: 'Debit', account_id: sender._id, transfer_id,
                            source_type: 'Transfer', conversion_type, conversion_rate: convRate
                        },
                        {
                            date: date || new Date(), description: `Transfer BDT to ${receiver.name}`,
                            amount: bdtAmount, currency: 'BDT', type: 'Credit', account_id: receiver._id, transfer_id,
                            source_type: 'Transfer', conversion_type, conversion_rate: convRate
                        },
                        {
                            date: date || new Date(), description: `Transfer to Convert USD to BDT from ${receiver.name}`,
                            amount: bdtAmount, currency: 'BDT', type: 'Debit', account_id: receiver._id, transfer_id,
                            source_type: 'Exchange', conversion_type, conversion_rate: convRate
                        },
                        {
                            date: date || new Date(), description: `USD convert from ${receiver.name}`,
                            amount: amt, currency: 'USD', type: 'Credit', account_id: receiver._id, transfer_id,
                            source_type: 'Exchange', conversion_type, conversion_rate: convRate, converted_amount_bdt: bdtAmount
                        }
                    ];

                    if (session) {
                        for (const txn of transactions) {
                            await Transaction.create([txn], { session });
                        }
                    } else {
                        for (const txn of transactions) {
                            await Transaction.create(txn);
                        }
                    }
                }
            }

            await syncAccountBalance(sender._id, session);
            await syncAccountBalance(receiver._id, session);

            if (req.file) {
                const tx = session
                    ? await Transaction.findOne({ transfer_id }).session(session)
                    : await Transaction.findOne({ transfer_id });

                if (tx) {
                    const attachmentData = {
                        file_path: req.file.path,
                        filename: req.file.filename,
                        transaction_id: tx._id
                    };

                    if (session) {
                        await Attachment.create([attachmentData], { session });
                    } else {
                        await Attachment.create(attachmentData);
                    }
                }
            }
        });

        res.status(201).json({ message: 'Transfer successful' });
        await logEvent(req.user.username, 'Transfer', `Transferred ${amount} ${currency} from ${sender.name} to ${receiver.name}`, 'entry');
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getTransactions = async (req, res) => {
    try {
        let limit = parseInt(req.query.limit) || 1000;
        const { startDate, endDate, accountId, currency, type, search } = req.query;
        let query = {};

        // Account-level filtering for non-admins
        if (req.user.role !== 'Admin') {
            const allowedLinks = await AccountPermission.find({
                role: req.user.role, can_access: true
            });
            const allowedIds = allowedLinks.map(l => l.account_id.toString());

            // If user explicitly filters by an account, ensure they have access to it
            if (accountId) {
                if (!allowedIds.includes(accountId.toString())) {
                    // If they try to access a forbidden account, return nothing
                    return res.json([]);
                }
                query.account_id = accountId;
            } else {
                // Otherwise limit to all permitted accounts
                query.account_id = { $in: allowedIds };
            }
        } else {
            // Admin can filter by any account
            if (accountId) {
                query.account_id = accountId;
            }
        }

        // Apply other filters
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                const s = new Date(startDate + 'T00:00:00Z');
                s.setUTCHours(s.getUTCHours() - 6);
                query.date.$gte = s;
            }
            if (endDate) {
                const e = new Date(endDate + 'T23:59:59.999Z');
                e.setUTCHours(e.getUTCHours() - 6);
                query.date.$lte = e;
            }
        }

        console.log('Transaction Filter Query:', JSON.stringify(query, null, 2));

        if (currency) query.currency = currency;
        if (type) query.type = type;

        if (search) {
            query.description = { $regex: search, $options: 'i' };
        }

        let q = Transaction.find(query).sort({ date: -1, serial_number: -1 }).populate(['account_id', 'attachments']);
        if (limit !== -1) q = q.limit(limit);

        const transactions = await q;

        let openingBdt = 0;
        let openingUsd = 0;

        let targetAccountIds = [];
        if (accountId) {
            targetAccountIds = [accountId];
        } else if (req.user.role !== 'Admin') {
            const allowedLinks = await AccountPermission.find({ role: req.user.role, can_access: true });
            targetAccountIds = allowedLinks.map(l => l.account_id);
        } else {
            const allAccounts = await Account.find({}, '_id');
            targetAccountIds = allAccounts.map(a => a._id);
        }

        for (const accId of targetAccountIds) {
            if (startDate) {
                const bal = await calculateBalanceAt(accId, new Date(startDate));
                openingBdt += bal.bdt;
                openingUsd += bal.usd;
            } else {
                const account = await Account.findById(accId);
                if (account) {
                    openingBdt += Number(account.opening_balance_bdt || 0);
                    openingUsd += Number(account.opening_balance_usd || 0);
                }
            }
        }

        // Map account_id to account to match Sequelize output structure
        const mapped = transactions.map(t => {
            const obj = t.toObject();
            obj.account = obj.account_id;
            delete obj.account_id;
            return obj;
        });

        res.json({
            transactions: mapped,
            openingBdt: Math.round(openingBdt * 100) / 100,
            openingUsd: Math.round(openingUsd * 100) / 100
        });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const updateTransaction = async (req, res) => {
    try {
        const txn = await Transaction.findById(req.params.id);
        if (!txn) {
            return res.status(404).json({ detail: 'Transaction not found' });
        }

        // Authorization check for non-admins
        if (req.user.role !== 'Admin') {
            const hasAccess = await AccountPermission.findOne({
                role: req.user.role,
                account_id: txn.account_id,
                can_access: true
            });
            if (!hasAccess) {
                return res.status(403).json({ detail: "You do not have permission to edit transactions for this account." });
            }
        }

        for (let key in req.body) {
            if (txn[key] !== undefined && String(txn[key]) !== String(req.body[key])) {
                await TransactionHistory.create({
                    transaction_id: txn._id,
                    changed_by: req.user.username,
                    field_name: key,
                    old_value: String(txn[key]),
                    new_value: String(req.body[key])
                });
                txn[key] = req.body[key];
            }
        }

        await txn.save();
        await syncAccountBalance(txn.account_id);
        await logEvent(req.user.username, 'Update Txn', `Updated transaction ${txn.serial_number}: ${txn.description}`, 'edit');
        res.json(txn);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const deleteTransaction = async (req, res) => {
    try {
        const txn = await Transaction.findById(req.params.id);
        if (!txn) {
            return res.status(404).json({ detail: 'Transaction not found' });
        }

        // Authorization: Only Admins can delete transactions
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ detail: "Only administrators can delete transactions." });
        }

        const accountId = txn.account_id;
        const txnRef = txn.trx_id || `SR-${txn.serial_number}`;
        const desc = txn.description;

        await Transaction.findByIdAndDelete(req.params.id);

        // Delete associated history and attachments (optional but good for cleanup)
        await TransactionHistory.deleteMany({ transaction_id: req.params.id });

        // Recalculate balance
        await syncAccountBalance(accountId);

        await logEvent(req.user.username, 'Delete Txn', `Deleted transaction ${txnRef}: ${desc}`, 'delete');

        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getTransactionHistory = async (req, res) => {
    try {
        const txn = await Transaction.findById(req.params.id);
        if (!txn) return res.status(404).json({ detail: 'Transaction not found' });

        // Authorization check for non-admins
        if (req.user.role !== 'Admin') {
            const hasAccess = await AccountPermission.findOne({
                role: req.user.role,
                account_id: txn.account_id,
                can_access: true
            });
            if (!hasAccess) {
                return res.status(403).json({ detail: "You do not have permission to view history for this transaction." });
            }
        }

        const history = await TransactionHistory.find({ transaction_id: req.params.id })
            .sort({ changed_at: -1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const downloadTemplate = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Transaction Template');
        worksheet.columns = [
            { header: 'Date (YYYY-MM-DD)', key: 'date', width: 20 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Currency (BDT/USD)', key: 'currency', width: 15 },
            { header: 'Type (Credit/Debit)', key: 'type', width: 15 },
            { header: 'Account Code', key: 'account_code', width: 15 }
        ];
        worksheet.addRow({
            date: new Date().toISOString().split('T')[0],
            description: 'Sample Purchase',
            amount: 1000.50,
            currency: 'BDT',
            type: 'Debit',
            account_code: '1001'
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=transaction_template.xlsx');
        await workbook.xlsx.write(res);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const previewTransactions = async (req, res) => {
    if (!req.file) return res.status(400).json({ detail: 'No file uploaded' });
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.getWorksheet(1);
        const accountImpact = {};
        const errors = [];
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);

            // Helper to extract primitive value from cell
            const getVal = (cellIndex) => {
                let val = row.getCell(cellIndex).value;
                if (val && typeof val === 'object') {
                    if (val.result !== undefined) return val.result; // Formula result
                    if (val.text !== undefined) return val.text;     // Rich text
                }
                return val;
            };

            const date = getVal(1) || new Date();
            const description = getVal(2);
            let amountVal = getVal(3);
            const amount = parseFloat(amountVal);
            const currency = getVal(4);
            const type = getVal(5);
            const accountCodeRaw = getVal(6);
            const accountCode = accountCodeRaw ? accountCodeRaw.toString().trim() : null;

            if (!description || isNaN(amount) || !currency || !type || !accountCode) continue;

            if (!accountImpact[accountCode]) {
                const account = await Account.findOne({ code: accountCode });
                if (!account) {
                    errors.push(`Row ${i}: Account code '${accountCode}' not found in system.`);
                    continue;
                }
                accountImpact[accountCode] = {
                    name: account.name,
                    code: account.code,
                    count: 0,
                    netBdt: 0,
                    netUsd: 0,
                    currentBdt: Number(account.current_balance_bdt || 0),
                    currentUsd: Number(account.current_balance_usd || 0)
                };
            }
            const impact = accountImpact[accountCode];
            impact.count += 1;
            const change = (type === 'Credit' ? amount : -amount);
            if (currency === 'BDT') impact.netBdt = Math.round((impact.netBdt + change) * 100) / 100;
            else impact.netUsd = Math.round((impact.netUsd + change) * 100) / 100;
        }
        if (errors.length > 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ detail: 'Validation failed', errors });
        }
        res.json(Object.values(accountImpact).map(impact => ({
            ...impact,
            projectedBdt: Math.round((impact.currentBdt + impact.netBdt) * 100) / 100,
            projectedUsd: Math.round((impact.currentUsd + impact.netUsd) * 100) / 100,
            netBdt: impact.netBdt,
            netUsd: impact.netUsd
        })));
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ detail: error.message });
    }
};

const importTransactions = async (req, res) => {
    if (!req.file) return res.status(400).json({ detail: 'No file uploaded' });
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.getWorksheet(1);
        const usdRateStr = await getSetting('usd_bdt_rate', '110');
        const usdRate = parseFloat(usdRateStr);

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);

            // Helper to extract primitive value from cell
            const getVal = (cellIndex) => {
                let val = row.getCell(cellIndex).value;
                if (val && typeof val === 'object') {
                    if (val.result !== undefined) return val.result;
                    if (val.text !== undefined) return val.text;
                }
                return val;
            };

            const date = getVal(1) || new Date();
            const description = getVal(2);
            let amountVal = getVal(3);
            const amount = parseFloat(amountVal);
            const currency = getVal(4);
            const type = getVal(5);
            const accountCodeRaw = getVal(6);
            const accountCode = accountCodeRaw ? accountCodeRaw.toString().trim() : null;

            if (!description || isNaN(amount) || !currency || !type || !accountCode) continue;

            const account = await Account.findOne({ code: accountCode });
            if (!account) throw new Error(`Row ${i}: Account code '${accountCode}' not found.`);

            let convAmountBdt = null;
            if (currency === 'USD') convAmountBdt = Math.round(amount * usdRate * 100) / 100;

            await Transaction.create({
                date: date || new Date(),
                description,
                amount,
                currency,
                type,
                account_id: account._id,
                conversion_type: 'None',
                converted_amount_bdt: convAmountBdt,
                source_type: 'Import'
            });

            await syncAccountBalance(account._id);
        }
        if (req.file) fs.unlinkSync(req.file.path);
        await logEvent(req.user.username, 'Import Success', 'Successfully imported transactions from Excel', 'entry');
        res.json({ message: 'Import successful' });
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(400).json({ detail: error.message });
    }
};

const getAccountStatement = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const account = await Account.findById(id);
        if (!account) return res.status(404).json({ detail: 'Account not found' });

        const query = { account_id: id };
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                const s = new Date(startDate + 'T00:00:00Z');
                s.setUTCHours(s.getUTCHours() - 6);
                query.date.$gte = s;
            }
            if (endDate) {
                const e = new Date(endDate + 'T23:59:59.999Z');
                e.setUTCHours(e.getUTCHours() - 6);
                query.date.$lte = e;
            }
        }

        const transactions = await Transaction.find(query).sort({ date: 1, _id: 1 }).populate('attachments');

        let runningBdt = Number(account.opening_balance_bdt || 0);
        let runningUsd = Number(account.opening_balance_usd || 0);

        if (startDate) {
            const hist = await calculateBalanceAt(id, new Date(startDate));
            runningBdt = hist.bdt;
            runningUsd = hist.usd;
        }

        const periodOpeningBdt = runningBdt;
        const periodOpeningUsd = runningUsd;

        const statement = transactions.map(txn => {
            const amt = Number(txn.amount || 0);
            const convAmt = Number(txn.converted_amount_bdt || 0);

            if (txn.currency === 'BDT') {
                if (txn.type === 'Credit') runningBdt = Math.round((runningBdt + amt) * 100) / 100;
                else runningBdt = Math.round((runningBdt - amt) * 100) / 100;
            } else {
                if (txn.conversion_type === 'None' || txn.source_type === 'Exchange') {
                    if (txn.type === 'Credit') runningUsd = Math.round((runningUsd + amt) * 100) / 100;
                    else runningUsd = Math.round((runningUsd - amt) * 100) / 100;
                } else {
                    const bdtImpact = convAmt;
                    if (txn.type === 'Credit') runningBdt = Math.round((runningBdt + bdtImpact) * 100) / 100;
                    else runningBdt = Math.round((runningBdt - bdtImpact) * 100) / 100;
                }
            }

            const obj = txn.toObject();
            obj.runningBdt = runningBdt;
            obj.runningUsd = runningUsd;
            return obj;
        });

        res.json({
            account,
            statement,
            periodOpeningBdt,
            periodOpeningUsd
        });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const downloadAccountStatement = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const account = await Account.findById(id);
        if (!account) return res.status(404).json({ detail: 'Account not found' });

        const query = { account_id: id };
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                const s = new Date(startDate + 'T00:00:00Z');
                s.setUTCHours(s.getUTCHours() - 6);
                query.date.$gte = s;
            }
            if (endDate) {
                const e = new Date(endDate + 'T23:59:59.999Z');
                e.setUTCHours(e.getUTCHours() - 6);
                query.date.$lte = e;
            }
        }

        const transactions = await Transaction.find(query).sort({ date: 1, _id: 1 }).populate('attachments');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Account Statement');

        worksheet.columns = [
            { header: 'TRX ID', key: 'trx_id', width: 12 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Rate', key: 'rate', width: 10 },
            { header: 'Converted (BDT)', key: 'conv_bdt', width: 15 },
            { header: 'Running BDT', key: 'running_bdt', width: 18 },
            { header: 'Running USD', key: 'running_usd', width: 18 }
        ];

        let runningBdt = Number(account.opening_balance_bdt || 0);
        let runningUsd = Number(account.opening_balance_usd || 0);

        if (startDate) {
            const hist = await calculateBalanceAt(id, new Date(startDate));
            runningBdt = hist.bdt;
            runningUsd = hist.usd;
        }

        const periodOpeningBdt = runningBdt;
        const periodOpeningUsd = runningUsd;

        worksheet.addRow({
            trx_id: '-',
            date: 'Opening',
            description: 'Beginning Balance',
            running_bdt: periodOpeningBdt,
            running_usd: periodOpeningUsd
        });

        transactions.forEach(txn => {
            const amt = Number(txn.amount || 0);
            const convAmt = Number(txn.converted_amount_bdt || 0);

            if (txn.currency === 'BDT') {
                if (txn.type === 'Credit') runningBdt = Math.round((runningBdt + amt) * 100) / 100;
                else runningBdt = Math.round((runningBdt - amt) * 100) / 100;
            } else {
                if (txn.conversion_type === 'None' || txn.source_type === 'Exchange') {
                    if (txn.type === 'Credit') runningUsd = Math.round((runningUsd + amt) * 100) / 100;
                    else runningUsd = Math.round((runningUsd - amt) * 100) / 100;
                } else {
                    const bdtImpact = convAmt;
                    if (txn.type === 'Credit') runningBdt = Math.round((runningBdt + bdtImpact) * 100) / 100;
                    else runningBdt = Math.round((runningBdt - bdtImpact) * 100) / 100;
                }
            }

            worksheet.addRow({
                trx_id: txn.trx_id || 'N/A',
                date: new Date(txn.date).toLocaleDateString(),
                description: txn.description,
                currency: txn.currency,
                type: txn.type,
                amount: amt,
                rate: txn.conversion_rate || '-',
                conv_bdt: convAmt || '-',
                running_bdt: runningBdt,
                running_usd: runningUsd
            });
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.getColumn('amount').numFmt = '#,##0.00';
        worksheet.getColumn('conv_bdt').numFmt = '#,##0.00';
        worksheet.getColumn('running_bdt').numFmt = '#,##0.00';
        worksheet.getColumn('running_usd').numFmt = '#,##0.00';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Statement_${account.code}_${new Date().toISOString().split('T')[0]}.xlsx`);
        await workbook.xlsx.write(res);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const exportLedger = async (req, res) => {
    try {
        const { startDate, endDate, accountId, currency, type } = req.query;
        let query = {};
        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (accountId) query.account_id = accountId;
        if (currency) query.currency = currency;
        if (type) query.type = type;

        const transactions = await Transaction.find(query).sort({ date: -1, _id: -1 }).populate('account_id');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Transaction Ledger');

        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Account', key: 'account', width: 25 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Rate', key: 'rate', width: 10 },
            { header: 'Converted (BDT)', key: 'conv_bdt', width: 15 },
            { header: 'Reference', key: 'reference', width: 15 },
            { header: 'Source', key: 'source', width: 15 }
        ];

        transactions.forEach(t => {
            worksheet.addRow({
                date: new Date(t.date).toLocaleDateString(),
                description: t.description,
                account: t.account_id?.name || 'Unknown',
                currency: t.currency,
                type: t.type,
                amount: Number(t.amount),
                rate: t.conversion_rate || '-',
                conv_bdt: t.converted_amount_bdt || '-',
                reference: t.reference || '-',
                source: t.source_type || '-'
            });
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.getColumn('amount').numFmt = '#,##0.00';
        worksheet.getColumn('conv_bdt').numFmt = '#,##0.00';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Ledger_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
        await workbook.xlsx.write(res);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

module.exports = {
    createTransaction,
    getTransactions,
    updateTransaction,
    deleteTransaction,
    getTransactionHistory,
    downloadTemplate,
    previewTransactions,
    importTransactions,
    getAccountStatement,
    downloadAccountStatement,
    exportLedger
};
