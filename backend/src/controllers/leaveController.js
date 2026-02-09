const mongoose = require('mongoose');
const { LeaveType, LeaveRequest, LeaveBalance, HREmployee } = require('../models/hrModels');
const { logger } = require('../utils/logger');
const fs = require('fs');

/**
 * Get all leave types (for settings & dropdowns)
 */
exports.getLeaveTypes = async (req, res) => {
    try {
        const types = await LeaveType.find({ is_active: true }).sort('name');
        res.json(types);
    } catch (error) {
        logger.error('Error fetching leave types', { error: error.message });
        res.status(500).json({ message: 'Failed to fetch leave types' });
    }
};

/**
 * Create or Update Leave Type (Admin only)
 */
exports.saveLeaveType = async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        let type;

        if (_id) {
            type = await LeaveType.findByIdAndUpdate(_id, data, { new: true });
        } else {
            type = await LeaveType.create(data);
        }

        res.json({ success: true, type });
    } catch (error) {
        logger.error('Error saving leave type', { error: error.message });
        res.status(500).json({ message: 'Failed to save leave type' });
    }
};

/**
 * Apply for Leave
 */
exports.applyForLeave = async (req, res) => {
    try {
        const { employee_id, leave_type_id, start_date, end_date, total_days, reason } = req.body;
        const files = req.files || []; // From Multer

        // 1. Validate Leave Type
        const type = await LeaveType.findById(leave_type_id);
        if (!type || !type.is_active) {
            return res.status(400).json({ message: 'Invalid leave type' });
        }

        // 2. Check Document Requirement
        if (type.requires_document && (!files.length && total_days >= type.document_threshold_days)) {
            return res.status(400).json({ message: `${type.name} requires a document for this duration.` });
        }

        // 3. Process Attachments
        const attachments = files.map(f => ({
            original_name: f.originalname,
            filename: f.filename,
            path: f.path
        }));

        // 4. Create Request
        const leaveRequest = await LeaveRequest.create({
            employee_id,
            leave_type: leave_type_id,
            start_date,
            end_date,
            total_days,
            reason,
            attachments,
            status: 'Pending',
            workflow_logs: [{
                action: 'Applied',
                performed_by: employee_id,
                performed_by_name: 'Employee', // Ideally fetch name
                comment: 'Application submitted'
            }]
        });

        // SYNC BALANCE
        const year = new Date(start_date).getFullYear();
        await syncLeaveBalance(employee_id, year);

        res.status(201).json({ success: true, message: 'Leave application submitted', leaveRequest });

    } catch (error) {
        logger.error('Error applying for leave', { error: error.message });
        res.status(500).json({ message: 'Failed to submit leave application' });
    }
};

/**
 * Get My Leaves (with Types populated)
 */
exports.getMyLeaves = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const leaves = await LeaveRequest.find({ employee_id })
            .populate('leave_type')
            .sort({ createdAt: -1 });
        res.json(leaves);
    } catch (error) {
        logger.error('Error fetching my leaves', { error: error.message });
        res.status(500).json({ message: 'Failed to fetch leave history' });
    }
};

/**
 * Get My Entitlements & Balances
 * Dynamically calculates balance: Default Quota - Used - Pending
 */
exports.getMyBalances = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const year = new Date().getFullYear();

        // 1. Fetch all active leave types
        const types = await LeaveType.find({ is_active: true });

        // 2. Fetch or Create Balance Record
        let balanceRecord = await LeaveBalance.findOne({ employee_id, year });
        if (!balanceRecord) {
            balanceRecord = await LeaveBalance.create({ employee_id, year, balances: [] });
        }

        // 3. Fetch Usage (Approved + Pending)
        const usage = await LeaveRequest.aggregate([
            {
                $match: {
                    employee_id: new mongoose.Types.ObjectId(employee_id),
                    status: { $in: ['Approved', 'Pending'] },
                    start_date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) }
                }
            },
            {
                $group: {
                    _id: '$leave_type',
                    used: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, '$total_days', 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, '$total_days', 0] } }
                }
            }
        ]);

        // 4. Construct Balance Sheet
        const balances = types.map(type => {
            // Check if we have a stored balance/quota for this type
            const storedBalance = balanceRecord.balances.find(b => b.leave_type.toString() === type._id.toString());

            // If stored total > 0, use it. Otherwise use default. 
            // Note: If we want to allow setting 0 explicitly, we'd need a flag, but for now 0 means strict fallback or no quota. 
            // Let's assume initialized record means explicit. 
            // Actually, better: if storedBalance exists, use its total. If not, use type default.
            const total_quota = storedBalance ? storedBalance.total : type.default_days;

            const usageRecord = usage.find(u => u._id.toString() === type._id.toString()) || { used: 0, pending: 0 };

            return {
                leave_type: type,
                total_quota: total_quota,
                used: usageRecord.used,
                pending: usageRecord.pending,
                available: total_quota - usageRecord.used - usageRecord.pending
            };
        });

        res.json(balances);

    } catch (error) {
        logger.error('Error calculating balances', { error: error.message });
        res.status(500).json({ message: 'Failed to calculate balances' });
    }
};

/**
 * Get all leave balances (Admin view)
 */
exports.getAllBalances = async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const { HREmployee } = require('../models/hrModels');

        // Fetch all active employees and their balances
        const employees = await HREmployee.find({ 'employment_info.status': 'Active' }, 'personal_info.full_name employee_id employment_info.current_department');
        const balances = await LeaveBalance.find({ year }).populate('balances.leave_type', 'name color');

        const result = employees.map(emp => {
            const balRec = balances.find(b => b.employee_id.toString() === emp._id.toString());
            return {
                _id: emp._id,
                employee_id: emp,
                balances: balRec ? balRec.balances : []
            };
        });

        res.json(result);
    } catch (error) {
        logger.error('Error fetching all balances', { error: error.message });
        res.status(500).json({ message: 'Failed to fetch all balances' });
    }
};

/**
 * Force Resync All Balances (Admin tool)
 */
exports.resyncAllBalances = async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const { HREmployee } = require('../models/hrModels');
        const employees = await HREmployee.find({ 'employment_info.status': 'Active' });

        for (const emp of employees) {
            await syncLeaveBalance(emp._id, year);
        }

        res.json({ success: true, message: `Synced balances for ${employees.length} employees` });
    } catch (error) {
        logger.error('Resync all error', { error: error.message });
        res.status(500).json({ message: 'Resync failed' });
    }
};

/**
 * Allocate/Override Leave Quota
 */
exports.allocateLeaves = async (req, res) => {
    try {
        const { employee_id, leave_type_id, total_days } = req.body;
        const year = new Date().getFullYear();

        let balance = await LeaveBalance.findOne({ employee_id, year });
        if (!balance) {
            balance = await LeaveBalance.create({ employee_id, year, balances: [] });
        }

        const index = balance.balances.findIndex(b => b.leave_type.toString() === leave_type_id);
        if (index > -1) {
            balance.balances[index].total = total_days;
        } else {
            balance.balances.push({
                leave_type: leave_type_id,
                total: total_days,
                used: 0,
                pending: 0,
                reserved: 0
            });
        }

        await balance.save();

        // SYNC BALANCE (Recalculate used/pending)
        await syncLeaveBalance(employee_id, year);

        res.json({ success: true, message: 'Leave quota updated' });

    } catch (error) {
        logger.error('Error allocating leave', { error: error.message });
        res.status(500).json({ message: 'Failed to allocate leave' });
    }
};

/**
 * Process Leave (Approve/Reject)
 */
exports.processLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, comment, manager_id, manager_name } = req.body; // action: Approved/Rejected

        const leave = await LeaveRequest.findById(id);
        if (!leave) return res.status(404).json({ message: 'Leave request not found' });

        if (leave.status !== 'Pending') {
            return res.status(400).json({ message: 'Leave request is already processed' });
        }

        leave.status = action;
        if (action === 'Approved') {
            leave.approved_by = manager_id;
            leave.approved_at = new Date();
        } else {
            leave.rejection_reason = comment;
        }

        leave.workflow_logs.push({
            action,
            performed_by: manager_id,
            performed_by_name: manager_name,
            comment,
            timestamp: new Date()
        });

        await leave.save();

        // SYNC BALANCE
        const year = new Date(leave.start_date).getFullYear();
        await syncLeaveBalance(leave.employee_id, year);

        res.json({ success: true, message: `Leave ${action} successfully` });

    } catch (error) {
        logger.error('Error processing leave', { error: error.message });
        res.status(500).json({ message: 'Failed to process leave' });
    }
};

/**
 * Helper: Recalculate and Sync LeaveBalance collection
 */
const syncLeaveBalance = async (employee_id, year) => {
    try {
        const types = await LeaveType.find({ is_active: true });
        let balanceRecord = await LeaveBalance.findOne({ employee_id, year });
        if (!balanceRecord) {
            balanceRecord = await LeaveBalance.create({ employee_id, year, balances: [] });
        }

        const usage = await LeaveRequest.aggregate([
            {
                $match: {
                    employee_id: new mongoose.Types.ObjectId(employee_id),
                    status: { $in: ['Approved', 'Pending'] },
                    start_date: {
                        $gte: new Date(year, 0, 1),
                        $lt: new Date(year + 1, 0, 1)
                    }
                }
            },
            {
                $group: {
                    _id: '$leave_type',
                    used: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, '$total_days', 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, '$total_days', 0] } }
                }
            }
        ]);

        const updatedBalances = types.map(type => {
            const stored = balanceRecord.balances.find(b => b.leave_type.toString() === type._id.toString());
            const usageRec = usage.find(u => u._id.toString() === type._id.toString()) || { used: 0, pending: 0 };

            return {
                leave_type: type._id,
                total: (stored && stored.total > 0) ? stored.total : type.default_days,
                used: usageRec.used,
                pending: usageRec.pending,
                reserved: stored ? stored.reserved : 0
            };
        });

        balanceRecord.balances = updatedBalances;
        await balanceRecord.save();
        logger.info('Leave balance synced', { employee_id, year });
    } catch (error) {
        logger.error('Error syncing leave balance', { error: error.message });
    }
};
