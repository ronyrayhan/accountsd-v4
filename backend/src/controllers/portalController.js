const { User, ActiveSession } = require('../models');
const { HREmployee, AttendancePunch, AttendanceSummary, LeaveRequest, LeaveBalance, LeaveType } = require('../models/hrModels');
const { comparePassword, createToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Portal Login
 * Restricted to users with a linked employee profile
 */
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username }).populate('employee_id');

        if (!user || !(await comparePassword(password, user.hashed_password))) {
            return res.status(401).json({ message: 'Incorrect username or password' });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'Account deactivated' });
        }

        if (!user.employee_id) {
            return res.status(403).json({ message: 'This account is not linked to an employee profile' });
        }

        const { accessToken, refreshToken } = createToken(user);

        // Create Active Session
        await ActiveSession.create({
            user_id: user._id,
            username: user.username,
            ip_address: req.ip || req.socket.remoteAddress,
            user_agent: req.headers['user-agent'],
            login_time: new Date(),
            last_activity: new Date(),
            token_signature: refreshToken.split('.')[2]
        });

        res.json({
            access_token: accessToken,
            token_type: 'bearer',
            employee: {
                id: user.employee_id._id,
                name: user.employee_id.personal_info.full_name,
                employee_id: user.employee_id.employee_id,
                designation: user.employee_id.employment_info.current_designation,
                department: user.employee_id.employment_info.current_department
            }
        });
    } catch (error) {
        logger.error('Portal login error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};

/**
 * Handle Punch IN/OUT
 */
exports.punch = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).populate('employee_id');

        if (!user || !user.employee_id) {
            return res.status(404).json({ message: 'Employee profile not found' });
        }

        const employee = user.employee_id;

        // Determine 'Today' in Company Timezone (UTC+6)
        const getCompanyToday = () => {
            const now = new Date();
            const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
            const companyTime = new Date(utcTime + (3600000 * 6)); // +6 hours
            companyTime.setHours(0, 0, 0, 0);
            return companyTime;
        };

        const startOfDay = getCompanyToday();
        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        const punchCount = await AttendancePunch.countDocuments({
            employee_id: employee._id,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        });

        const punch_type = (punchCount % 2 === 0) ? 'IN' : 'OUT';

        const punch = await AttendancePunch.create({
            employee_id: employee._id,
            rfid_card_number: employee.rfid_card_number || 'WEB_PORTAL',
            punch_type,
            timestamp: new Date(),
            device_id: 'WEB_PORTAL',
            location: 'Web Portal'
        });

        // Update daily summary (Helper function logic inline or imported)
        await updateDailySummary(employee._id, punch.timestamp);

        res.json({
            success: true,
            punch_type,
            timestamp: punch.timestamp,
            message: punch_type === 'IN' ? 'Checked in successfully' : 'Checked out successfully'
        });
    } catch (error) {
        logger.error('Portal punch error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get Portal Home Data
 */
exports.getDashboard = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('employee_id');
        const employee = user.employee_id;

        // Company Timezone (+6) Today
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const startOfDay = new Date(utcTime + (3600000 * 6));
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        // Get today's summary
        const summary = await AttendanceSummary.findOne({
            employee_id: employee._id,
            date: startOfDay
        });

        // Get today's punches
        const punches = await AttendancePunch.find({
            employee_id: employee._id,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: 1 });

        // Get recent history (Last 7 days)
        const historyStart = new Date(startOfDay);
        historyStart.setDate(historyStart.getDate() - 7);
        historyStart.setHours(0, 0, 0, 0);

        const history = await AttendanceSummary.find({
            employee_id: employee._id,
            date: { $gte: historyStart, $lt: startOfDay }
        }).sort({ date: -1 });

        res.json({
            employee: {
                name: employee.personal_info.full_name,
                designation: employee.employment_info.current_designation,
                id: employee.employee_id
            },
            today: {
                summary,
                punches,
                is_checked_in: punches.length % 2 !== 0
            },
            history: history
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get Leave Balances
 */
exports.getBalances = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const employee_id = user.employee_id;
        const year = new Date().getFullYear();

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

        const balances = types.map(type => {
            const storedBalance = balanceRecord.balances.find(b => b.leave_type.toString() === type._id.toString());
            const total_quota = storedBalance ? storedBalance.total : type.default_days;
            const usageRecord = usage.find(u => u._id.toString() === type._id.toString()) || { used: 0, pending: 0 };

            return {
                leave_type: { _id: type._id, name: type.name, code: type.code },
                total_quota,
                used: usageRecord.used,
                pending: usageRecord.pending,
                available: total_quota - usageRecord.used - usageRecord.pending
            };
        });

        res.json(balances);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get Leave History
 */
exports.getLeaves = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const leaves = await LeaveRequest.find({ employee_id: user.employee_id })
            .populate('leave_type', 'name code')
            .sort({ createdAt: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Apply for Leave
 */
exports.applyLeave = async (req, res) => {
    try {
        const { leave_type_id, start_date, end_date, total_days, reason } = req.body;
        const files = req.files || [];
        const user = await User.findById(req.user._id).populate('employee_id');
        const employee = user.employee_id;
        const year = new Date(start_date).getFullYear();

        // 1. Basic Validity
        if (!leave_type_id || !start_date || !end_date || !total_days) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const type = await LeaveType.findById(leave_type_id);
        if (!type || !type.is_active) {
            return res.status(400).json({ message: 'Invalid leave type' });
        }

        // 2. Conflict Check (Overlap)
        const conflict = await LeaveRequest.findOne({
            employee_id: employee._id,
            status: { $in: ['Pending', 'Approved'] },
            $or: [
                { start_date: { $lte: new Date(end_date) }, end_date: { $gte: new Date(start_date) } }
            ]
        });

        if (conflict) {
            return res.status(400).json({ message: 'You already have a pending or approved leave request for these dates.' });
        }

        // 3. Quota Check (Real-time calculation)
        const usage = await LeaveRequest.aggregate([
            {
                $match: {
                    employee_id: employee._id,
                    leave_type: new mongoose.Types.ObjectId(leave_type_id),
                    status: { $in: ['Approved', 'Pending'] },
                    start_date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) }
                }
            },
            {
                $group: {
                    _id: null,
                    total_used: { $sum: '$total_days' }
                }
            }
        ]);

        const usedSoFar = usage.length > 0 ? usage[0].total_used : 0;
        const balanceRecord = await LeaveBalance.findOne({ employee_id: employee._id, year });
        const storedBalance = balanceRecord?.balances.find(b => b.leave_type.toString() === leave_type_id);
        const totalQuota = storedBalance ? storedBalance.total : type.default_days;
        const available = totalQuota - usedSoFar;

        if (total_days > available) {
            return res.status(400).json({ message: `Insufficient leave balance. Available: ${available} days.` });
        }

        // 4. Document Requirement Check
        if (type.requires_document && total_days >= type.document_threshold_days && files.length === 0) {
            return res.status(400).json({ message: `${type.name} requires a supporting document for ${type.document_threshold_days} or more days.` });
        }

        // 5. Process Attachments
        const attachments = files.map(f => ({
            original_name: f.originalname,
            filename: f.filename,
            path: f.path
        }));

        const leaveRequest = await LeaveRequest.create({
            employee_id: employee._id,
            leave_type: leave_type_id,
            start_date,
            end_date,
            total_days,
            reason,
            attachments,
            status: 'Pending',
            workflow_logs: [{
                action: 'Applied',
                performed_by: employee._id,
                performed_by_name: employee.personal_info.full_name,
                comment: 'Application submitted via ESS Portal'
            }]
        });

        res.status(201).json({ success: true, message: 'Leave application submitted', leaveRequest });
    } catch (error) {
        logger.error('Portal apply leave error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get Active Leave Types
 */
exports.getLeaveTypes = async (req, res) => {
    try {
        const types = await LeaveType.find({ is_active: true }).sort('name');
        res.json(types);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Internal Helper (Replicated from hrController to avoid circular deps or complex extracts if we want "another module")
const updateDailySummary = async (employee_id, date) => {
    try {
        // Find 'Today' boundary for the punch date in Company Timezone (+6)
        const d = new Date(date);
        const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
        const startOfDay = new Date(utcTime + (3600000 * 6));
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        const punches = await AttendancePunch.find({
            employee_id,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: 1 });

        if (punches.length === 0) return;

        const segments = [];
        let total_hours = 0;

        for (let i = 0; i < punches.length; i += 2) {
            const inPunch = punches[i];
            const outPunch = punches[i + 1];

            const segment = {
                punch_in: inPunch.timestamp,
                punch_out: outPunch ? outPunch.timestamp : null,
                duration: 0
            };

            if (outPunch) {
                segment.duration = (outPunch.timestamp - inPunch.timestamp) / (1000 * 60 * 60);
                total_hours += segment.duration;
            }
            segments.push(segment);
        }

        const firstPunch = punches[0];
        const lastPunch = punches[punches.length - 1];

        // Status Calculation based on Shift
        let status = 'Present';
        const employeeRecord = await HREmployee.findById(employee_id).populate('employment_info.shift_id');
        const shift = employeeRecord?.employment_info?.shift_id;

        if (shift && firstPunch.punch_type === 'IN') {
            const [sHour, sMin] = shift.start_time.split(':').map(Number);
            const graceMinutes = shift.grace_period_minutes || 0;
            const shiftStartTime = new Date(firstPunch.timestamp);
            shiftStartTime.setHours(sHour, sMin, 0, 0);
            const lateCutoff = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

            if (firstPunch.timestamp > lateCutoff) {
                status = 'Late';
            }
        }

        await AttendanceSummary.findOneAndUpdate(
            { employee_id, date: startOfDay },
            {
                punch_in: firstPunch.timestamp,
                punch_out: punches.length % 2 === 0 ? lastPunch.timestamp : null,
                total_hours: total_hours.toFixed(2),
                segments,
                status
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('Portal sync error:', error.message);
    }
};
