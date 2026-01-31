const { Bill, Attachment } = require('../models');
const { logEvent } = require('../utils/logger');

const getBills = async (req, res) => {
    try {
        const bills = await Bill.find().sort({ due_date: 1 }).populate('attachments');
        res.json(bills);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const createBill = async (req, res) => {
    try {
        const { invoice_date, due_date, description, company_name, amount, currency } = req.body;

        const bill = await Bill.create({
            invoice_date: invoice_date || new Date(),
            due_date,
            description,
            company_name,
            amount,
            currency: currency || 'BDT'
        });

        if (req.file) {
            await Attachment.create({
                file_path: req.file.path,
                filename: req.file.filename,
                bill_id: bill._id
            });
        }

        const createdBill = await Bill.findById(bill._id).populate('attachments');
        await logEvent(req.user.username, 'New Bill', `Added bill for ${company_name}: ${description} (${currency} ${amount})`, 'entry');
        res.status(201).json(createdBill);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const updateBillStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const bill = await Bill.findById(req.params.id);
        if (!bill) return res.status(404).json({ detail: 'Bill not found' });

        bill.status = status;
        await bill.save();
        await logEvent(req.user.username, 'Update Bill', `Changed bill status for ${bill.company_name} to ${status}`, 'edit');
        res.json(bill);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const deleteBill = async (req, res) => {
    try {
        const bill = await Bill.findByIdAndDelete(req.params.id);
        if (!bill) return res.status(404).json({ detail: 'Bill not found' });
        await logEvent(req.user.username, 'Delete Bill', `Deleted bill for ${bill.company_name}: ${bill.description}`, 'delete');
        res.json({ message: 'Bill deleted successfully' });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

module.exports = {
    getBills,
    createBill,
    updateBillStatus,
    deleteBill
};
