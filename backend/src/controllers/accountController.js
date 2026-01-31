const { Account, AccountHistory, Transaction, AccountPermission } = require('../models');
const { logEvent } = require('../utils/logger');

const getAccounts = async (req, res) => {
    try {
        const accounts = await Account.find();

        if (req.user.role === 'Admin') {
            return res.json(accounts);
        }

        const { AccountPermission, IndividualAccountPermission } = require('../models');
        const [rolePerms, indPerms] = await Promise.all([
            AccountPermission.find({ role: req.user.role }),
            IndividualAccountPermission.find({ user_id: req.user._id })
        ]);

        const mergedMap = {};
        rolePerms.forEach(p => mergedMap[p.account_id.toString()] = p.can_access);
        indPerms.forEach(p => mergedMap[p.account_id.toString()] = p.can_access);

        const filtered = accounts.filter(acc => mergedMap[acc._id.toString()] === true);
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const createAccount = async (req, res) => {
    try {
        const { code, name, type, subtype, opening_balance_bdt, opening_balance_usd } = req.body;

        const existing = await Account.findOne({ code });
        if (existing) {
            return res.status(400).json({ detail: 'Code exists' });
        }

        const account = await Account.create({
            code,
            name,
            type,
            subtype,
            opening_balance_bdt,
            current_balance_bdt: opening_balance_bdt,
            opening_balance_usd,
            current_balance_usd: opening_balance_usd
        });

        await logEvent(req.user.username, 'New Account', `Created account: ${name} (${code})`, 'admin');

        res.status(201).json(account);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const account = await Account.findByIdAndDelete(req.params.id);
        if (!account) {
            return res.status(404).json({ detail: 'Account not found' });
        }
        await logEvent(req.user.username, 'Delete Account', `Deleted account: ${account.name} (${account.code})`, 'admin');
        res.json(account);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const updateBalance = async (req, res) => {
    try {
        const { new_balance_bdt, new_balance_usd, reason } = req.body;
        const account = await Account.findById(req.params.id);
        if (!account) {
            return res.status(404).json({ detail: 'Account not found' });
        }

        await AccountHistory.create({
            account_id: account._id,
            changed_by: req.user.username,
            reason,
            old_balance_bdt: account.current_balance_bdt,
            new_balance_bdt,
            old_balance_usd: account.current_balance_usd,
            new_balance_usd
        });

        account.current_balance_bdt = Math.round(new_balance_bdt * 100) / 100;
        account.current_balance_usd = Math.round(new_balance_usd * 100) / 100;
        await account.save();

        await logEvent(req.user.username, 'Adj Balance', `Manually adjusted balance for ${account.name}. Reason: ${reason}`, 'edit');

        res.json(account);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getAccountHistory = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role !== 'Admin') {
            const { AccountPermission, IndividualAccountPermission } = require('../models');

            // Check individual override first
            const indAccess = await IndividualAccountPermission.findOne({
                user_id: req.user._id,
                account_id: id
            });

            if (indAccess) {
                if (!indAccess.can_access) {
                    return res.status(403).json({ detail: "You do not have permission to view this account's history." });
                }
            } else {
                // Fallback to Role
                const roleAccess = await AccountPermission.findOne({
                    role: req.user.role,
                    account_id: id,
                    can_access: true
                });
                if (!roleAccess) {
                    return res.status(403).json({ detail: "You do not have permission to view this account's history." });
                }
            }
        }

        const history = await AccountHistory.find({ account_id: id })
            .sort({ changed_at: -1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const recalculateBalances = async (req, res) => {
    try {
        const accounts = await Account.find();

        for (const account of accounts) {
            let bdt = Number(account.opening_balance_bdt || 0);
            let usd = Number(account.opening_balance_usd || 0);

            const txns = await Transaction.find({ account_id: account._id });

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

            account.current_balance_bdt = bdt;
            account.current_balance_usd = usd;
            await account.save();
        }

        await logEvent(req.user.username, 'Balance Sync', 'Recalculated all account balances from transaction history', 'admin');

        res.json({ message: 'Balances recalculated successfully' });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

module.exports = {
    getAccounts,
    createAccount,
    deleteAccount,
    updateBalance,
    getAccountHistory,
    recalculateBalances
};
