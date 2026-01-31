const { DailySummary, MonthlySummary, Transaction, Account } = require('../models');
const ExcelJS = require('exceljs');

/**
 * Recalculates summaries for a specific account on a specific date.
 */
const syncSummaries = async (accountId, dateInput) => {
    const dateStr = new Date(dateInput).toISOString().split('T')[0];
    const monthStr = dateStr.substring(0, 7);

    // 1. Calculate Daily Summary
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    const txns = await Transaction.find({
        account_id: accountId,
        date: { $gte: startOfDay, $lte: endOfDay }
    });

    let creditBdt = 0, debitBdt = 0;
    let creditUsd = 0, debitUsd = 0;

    for (const t of txns) {
        const amt = Number(t.amount || 0);
        const convAmt = Number(t.converted_amount_bdt || 0);

        if (t.currency === 'BDT') {
            if (t.type === 'Credit') creditBdt += amt;
            else if (t.type === 'Debit') debitBdt += amt;
        } else {
            // If it's a direct USD transaction or Exchange, it impacts USD balance
            if (t.conversion_type === 'None' || t.source_type === 'Exchange') {
                if (t.type === 'Credit') creditUsd += amt;
                else if (t.type === 'Debit') debitUsd += amt;
            } else {
                // If converted to BDT equivalent
                if (t.type === 'Credit') creditBdt += convAmt;
                else if (t.type === 'Debit') debitBdt += convAmt;
            }
        }
    }

    // To get opening/closing, we need the balance at the end of the day or start of day.
    // However, the current system doesn't store historical balances per transaction.
    // A better approach for "Opening Balance" is (Closing Balance - Credits + Debits).

    // For now, let's use the current account balance as a reference and work backwards? 
    // No, that's complex for arbitrary dates.
    // Simpler logic: opening = (all transactions before this day) + opening_balance.

    const getBalanceAt = async (accId, upToDate) => {
        const account = await Account.findById(accId);
        let bdt = Number(account.opening_balance_bdt || 0);
        let usd = Number(account.opening_balance_usd || 0);

        const pastTxns = await Transaction.find({
            account_id: accId,
            date: { $lt: upToDate }
        });

        for (const txn of pastTxns) {
            const amt = Number(txn.amount || 0);
            const convAmt = Number(txn.converted_amount_bdt || 0);
            if (txn.currency === 'BDT') {
                if (txn.type === 'Credit') bdt += amt;
                else if (txn.type === 'Debit') bdt -= amt;
            } else {
                if (txn.conversion_type === 'None' || txn.source_type === 'Exchange') {
                    if (txn.type === 'Credit') usd += amt;
                    else if (txn.type === 'Debit') usd -= amt;
                } else {
                    if (txn.type === 'Credit') bdt += convAmt;
                    else if (txn.type === 'Debit') bdt -= convAmt;
                }
            }
        }
        return { bdt, usd };
    };

    const openingBalances = await getBalanceAt(accountId, startOfDay);

    await DailySummary.findOneAndUpdate(
        { account_id: accountId, date: dateStr },
        {
            opening_bdt: Math.round(openingBalances.bdt * 100) / 100,
            credit_bdt: Math.round(creditBdt * 100) / 100,
            debit_bdt: Math.round(debitBdt * 100) / 100,
            closing_bdt: Math.round((openingBalances.bdt + creditBdt - debitBdt) * 100) / 100,
            opening_usd: Math.round(openingBalances.usd * 100) / 100,
            credit_usd: Math.round(creditUsd * 100) / 100,
            debit_usd: Math.round(debitUsd * 100) / 100,
            closing_usd: Math.round((openingBalances.usd + creditUsd - debitUsd) * 100) / 100
        },
        { upsert: true, new: true }
    );

    // 2. Monthly Summary
    const startOfMonth = new Date(dateStr);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const monthTxns = await Transaction.find({
        account_id: accountId,
        date: { $gte: startOfMonth, $lt: endOfMonth }
    });

    let mCreditBdt = 0, mDebitBdt = 0, mCreditUsd = 0, mDebitUsd = 0;
    for (const t of monthTxns) {
        const amt = Number(t.amount || 0);
        const convAmt = Number(t.converted_amount_bdt || 0);
        if (t.currency === 'BDT') {
            if (t.type === 'Credit') mCreditBdt += amt;
            else if (t.type === 'Debit') mDebitBdt += amt;
        } else {
            if (t.conversion_type === 'None' || t.source_type === 'Exchange') {
                if (t.type === 'Credit') mCreditUsd += amt;
                else if (t.type === 'Debit') mDebitUsd += amt;
            } else {
                if (t.type === 'Credit') mCreditBdt += convAmt;
                else if (t.type === 'Debit') mDebitBdt += convAmt;
            }
        }
    }

    const mOpening = await getBalanceAt(accountId, startOfMonth);

    await MonthlySummary.findOneAndUpdate(
        { account_id: accountId, month: monthStr },
        {
            opening_bdt: Math.round(mOpening.bdt * 100) / 100,
            credit_bdt: Math.round(mCreditBdt * 100) / 100,
            debit_bdt: Math.round(mDebitBdt * 100) / 100,
            closing_bdt: Math.round((mOpening.bdt + mCreditBdt - mDebitBdt) * 100) / 100,
            opening_usd: Math.round(mOpening.usd * 100) / 100,
            credit_usd: Math.round(mCreditUsd * 100) / 100,
            debit_usd: Math.round(mDebitUsd * 100) / 100,
            closing_usd: Math.round((mOpening.usd + mCreditUsd - mDebitUsd) * 100) / 100
        },
        { upsert: true, new: true }
    );
};

const getDailySummaries = async (req, res) => {
    try {
        const { accountId, startDate, endDate } = req.query;
        let query = {};
        if (accountId) query.account_id = accountId;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = startDate;
            if (endDate) query.date.$lte = endDate;
        }
        const data = await DailySummary.find(query).sort({ date: -1 }).populate('account_id');
        res.json(data);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getMonthlySummaries = async (req, res) => {
    try {
        const { accountId, startMonth, endMonth } = req.query;
        let query = {};
        if (accountId) query.account_id = accountId;
        if (startMonth || endMonth) {
            query.month = {};
            if (startMonth) query.month.$gte = startMonth;
            if (endMonth) query.month.$lte = endMonth;
        }
        const data = await MonthlySummary.find(query).sort({ month: -1 }).populate('account_id');
        res.json(data);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const exportSummaries = async (req, res) => {
    try {
        const { type } = req.query; // 'daily' or 'monthly'
        const data = type === 'monthly' ? await MonthlySummary.find().populate('account_id') : await DailySummary.find().populate('account_id');

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(type === 'monthly' ? 'Monthly Summaries' : 'Daily Summaries');

        sheet.columns = [
            { header: 'Account', key: 'account', width: 20 },
            { header: type === 'monthly' ? 'Month' : 'Date', key: 'period', width: 15 },
            { header: 'Opening BDT', key: 'openBdt', width: 15 },
            { header: 'Credit BDT', key: 'crBdt', width: 15 },
            { header: 'Debit BDT', key: 'drBdt', width: 15 },
            { header: 'Closing BDT', key: 'closeBdt', width: 15 },
            { header: 'Opening USD', key: 'openUsd', width: 15 },
            { header: 'Credit USD', key: 'crUsd', width: 15 },
            { header: 'Debit USD', key: 'drUsd', width: 15 },
            { header: 'Closing USD', key: 'closeUsd', width: 15 },
        ];

        data.forEach(d => {
            sheet.addRow({
                account: d.account_id?.name || 'Unknown',
                period: type === 'monthly' ? d.month : d.date,
                openBdt: d.opening_bdt,
                crBdt: d.credit_bdt,
                drBdt: d.debit_bdt,
                closeBdt: d.closing_bdt,
                openUsd: d.opening_usd,
                crUsd: d.credit_usd,
                drUsd: d.debit_usd,
                closeUsd: d.closing_usd
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Summaries_${type}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

module.exports = {
    syncSummaries,
    getDailySummaries,
    getMonthlySummaries,
    exportSummaries
};
