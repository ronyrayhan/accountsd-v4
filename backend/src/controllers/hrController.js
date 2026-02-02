const {
    HREmployee,
    CareerHistory,
    AttendancePunch,
    AttendanceSummary,
    LeaveRequest,
    LeaveBalance,
    ExitRecord
} = require('../models/hrModels');
const { Counter } = require('../models');
const { logger } = require('../utils/logger');

// ==================== EMPLOYEE MANAGEMENT ====================

/**
 * Get all employees with filtering
 */
exports.getEmployees = async (req, res) => {
    try {
        const { department, status, employment_type, search } = req.query;
        let query = {};

        if (department) query['employment_info.current_department'] = department;
        if (status) query['employment_info.status'] = status;
        if (employment_type) query['employment_info.employment_type'] = employment_type;
        if (search) {
            query.$or = [
                { 'personal_info.full_name': { $regex: search, $options: 'i' } },
                { employee_id: { $regex: search, $options: 'i' } },
                { rfid_card_number: { $regex: search, $options: 'i' } }
            ];
        }

        const employees = await HREmployee.find(query)
            .populate('employment_info.reporting_manager_id', 'personal_info.full_name employee_id')
            .populate('employment_info.shift_id', 'name start_time end_time')
            .sort({ 'employment_info.joining_date': -1 });

        res.json(employees);
    } catch (error) {
        logger.error('Get employees error', { error: error.message });
        res.status(500).json({ detail: error.message });
    }
};

/**
 * Get single employee by ID
 */
exports.getEmployee = async (req, res) => {
    try {
        const employee = await HREmployee.findById(req.params.id)
            .populate('employment_info.reporting_manager_id', 'personal_info.full_name employee_id')
            .populate('employment_info.shift_id');

        if (!employee) {
            return res.status(404).json({ detail: 'Employee not found' });
        }

        res.json(employee);
    } catch (error) {
        logger.error('Get employee error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create new employee
 */
exports.createEmployee = async (req, res) => {
    try {
        // Auto-generate employee_id
        const counter = await Counter.findByIdAndUpdate(
            { _id: 'employee_serial' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        const employee_id = `EMP${String(counter.seq).padStart(3, '0')}`;

        const employeeData = {
            ...req.body,
            employee_id
        };

        const employee = await HREmployee.create(employeeData);

        // Create initial leave balance for current year
        const currentYear = new Date().getFullYear();
        await LeaveBalance.create({
            employee_id: employee._id,
            year: currentYear
        });

        logger.info('Employee created', {
            employee_id,
            name: employee.personal_info.full_name,
            created_by: req.user.username
        });

        res.status(201).json(employee);
    } catch (error) {
        logger.error('Create employee error', { error: error.message, stack: error.stack, data: req.body });
        res.status(400).json({ message: error.message });
    }
};

/**
 * Update employee
 */
exports.updateEmployee = async (req, res) => {
    try {
        const employee = await HREmployee.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!employee) {
            return res.status(404).json({ detail: 'Employee not found' });
        }

        logger.info('Employee updated', {
            employee_id: employee.employee_id,
            updated_by: req.user.username
        });

        res.json(employee);
    } catch (error) {
        logger.error('Update employee error', { error: error.message });
        res.status(400).json({ message: error.message });
    }
};

// ==================== CAREER HISTORY ====================

/**
 * Get employee career history
 */
exports.getCareerHistory = async (req, res) => {
    try {
        const history = await CareerHistory.find({ employee_id: req.params.id })
            .sort({ effective_date: -1 });

        res.json(history);
    } catch (error) {
        logger.error('Get career history error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};

/**
 * Record promotion/transfer/increment
 */
exports.recordCareerChange = async (req, res) => {
    try {
        const { employee_id, change_type, effective_date, new_values, reason } = req.body;

        if (!new_values) {
            return res.status(400).json({ message: 'New values (designation, department, salary) are required' });
        }

        const employee = await HREmployee.findById(employee_id);
        if (!employee) {
            return res.status(404).json({ detail: 'Employee not found' });
        }

        // Record previous values
        const previous_values = {
            designation: employee.employment_info.current_designation,
            department: employee.employment_info.current_department,
            salary: employee.compensation.current_salary
        };

        // Create career history record
        const history = await CareerHistory.create({
            employee_id,
            change_type,
            effective_date,
            previous_values,
            new_values,
            reason,
            approved_by: req.user.username
        });

        // Update employee record
        if (new_values.designation) {
            employee.employment_info.current_designation = new_values.designation;
        }
        if (new_values.department) {
            employee.employment_info.current_department = new_values.department;
        }
        if (new_values.salary) {
            employee.compensation.current_salary = new_values.salary;
        }

        await employee.save();

        logger.info('Career change recorded', {
            employee_id: employee.employee_id,
            change_type,
            approved_by: req.user.username
        });

        res.status(201).json(history);
    } catch (error) {
        logger.error('Record career change error', { error: error.message });
        res.status(400).json({ message: error.message });
    }
};

// ==================== RFID ATTENDANCE ====================

/**
 * SECURE ENDPOINT FOR ESP32 RFID PUNCH
 * This endpoint receives punch data from ESP32 devices
 */
exports.rfidPunch = async (req, res) => {
    try {
        const { rfid_card_number, device_id, timestamp } = req.body;

        if (!rfid_card_number) {
            return res.status(400).json({
                success: false,
                message: 'RFID card number required'
            });
        }

        // Find employee by RFID card
        const employee = await HREmployee.findOne({ rfid_card_number });

        if (!employee) {
            logger.warn('Unknown RFID card', { rfid_card_number, device_id });
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check if employee is active
        if (employee.employment_info.status !== 'Active') {
            return res.status(403).json({
                success: false,
                message: 'Employee is not active'
            });
        }

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

        // Create punch record
        const punch = await AttendancePunch.create({
            employee_id: employee._id,
            rfid_card_number,
            punch_type,
            timestamp: timestamp || new Date(),
            device_id,
            location: device_id // Can be enhanced with actual location
        });

        // Update daily summary
        await updateDailySummary(employee._id, new Date(punch.timestamp));

        logger.info('RFID punch recorded', {
            employee_id: employee.employee_id,
            name: employee.personal_info.full_name,
            punch_type,
            device_id
        });

        res.json({
            success: true,
            employee_name: employee.personal_info.full_name,
            employee_id: employee.employee_id,
            punch_type,
            timestamp: punch.timestamp,
            message: punch_type === 'IN'
                ? `Good morning, ${employee.personal_info.full_name}! Punch In recorded.`
                : `Goodbye, ${employee.personal_info.full_name}! Punch Out recorded.`
        });
    } catch (error) {
        logger.error('RFID punch error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

/**
 * Helper function to update daily attendance summary
 */
const updateDailySummary = async (employee_id, date) => {
    try {
        const d = new Date(date);
        const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
        const startOfDay = new Date(utcTime + (3600000 * 6));
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        // Get all punches for the day
        const punches = await AttendancePunch.find({
            employee_id,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: 1 });

        if (punches.length === 0) return;

        const segments = [];
        let total_hours = 0;

        // Group punches into sequential segments (0-1, 2-3, 4-5...)
        for (let i = 0; i < punches.length; i += 2) {
            const inPunch = punches[i];
            const outPunch = punches[i + 1]; // Might be undefined if currently on shift

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
        const employee = await HREmployee.findById(employee_id).populate('employment_info.shift_id');
        const shift = employee?.employment_info?.shift_id;

        if (shift && firstPunch.punch_type === 'IN') {
            const [sHour, sMin] = shift.start_time.split(':').map(Number);
            const graceMinutes = shift.grace_period_minutes || 0;

            // Shift start on the same biological day as the punch
            const shiftStartTime = new Date(firstPunch.timestamp);
            shiftStartTime.setHours(sHour, sMin, 0, 0);

            // Arrival after grace period
            const lateCutoff = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

            if (firstPunch.timestamp > lateCutoff) {
                status = 'Late';
            }
        }

        // Upsert summary
        await AttendanceSummary.findOneAndUpdate(
            { employee_id, date: startOfDay },
            {
                punch_in: firstPunch.timestamp,
                punch_out: lastPunch.timestamp,
                total_hours: total_hours.toFixed(2),
                segments,
                status
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        logger.error('Update daily summary error', { error: error.message });
    }
};

/**
 * Get attendance records
 */
exports.getAttendance = async (req, res) => {
    try {
        const { employee_id, start_date, end_date, status } = req.query;
        let query = {};

        if (employee_id) query.employee_id = employee_id;
        if (status) query.status = status;
        if (start_date && end_date) {
            // Parse YYYY-MM-DD into Local Date objects to avoid timezone mismatch
            const [y, m, d] = start_date.split('-').map(Number);
            const start = new Date(y, m - 1, d, 0, 0, 0, 0);

            const [ey, em, ed] = end_date.split('-').map(Number);
            const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);

            query.date = {
                $gte: start,
                $lte: end
            };
        }

        const attendance = await AttendanceSummary.find(query)
            .populate('employee_id', 'employee_id personal_info.full_name employment_info.current_department')
            .sort({ date: -1 });

        res.json(attendance);
    } catch (error) {
        logger.error('Get attendance error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};

// ==================== LEAVE MANAGEMENT ====================

/**
 * Get leave requests
 */
exports.getLeaves = async (req, res) => {
    try {
        const { employee_id, status } = req.query;
        let query = {};

        if (employee_id) query.employee_id = employee_id;
        if (status) query.status = status;

        const leaves = await LeaveRequest.find(query)
            .populate('employee_id', 'employee_id personal_info.full_name employment_info.current_department')
            .sort({ start_date: -1 });

        res.json(leaves);
    } catch (error) {
        logger.error('Get leaves error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};

/**
 * Apply for leave
 */
exports.applyLeave = async (req, res) => {
    try {
        const leave = await LeaveRequest.create(req.body);

        logger.info('Leave applied', {
            employee_id: req.body.employee_id,
            leave_type: req.body.leave_type,
            days: req.body.total_days
        });

        res.status(201).json(leave);
    } catch (error) {
        logger.error('Apply leave error', { error: error.message });
        res.status(400).json({ message: error.message });
    }
};

/**
 * Approve/Reject leave
 */
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { status, rejection_reason } = req.body;

        const updateData = {
            status,
            approved_by: req.user.username,
            approved_at: new Date()
        };

        if (status === 'Rejected' && rejection_reason) {
            updateData.rejection_reason = rejection_reason;
        }

        const leave = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('employee_id');

        if (!leave) {
            return res.status(404).json({ detail: 'Leave request not found' });
        }

        // Update leave balance if approved
        if (status === 'Approved') {
            await updateLeaveBalance(leave);
        }

        logger.info('Leave status updated', {
            leave_id: leave._id,
            status,
            approved_by: req.user.username
        });

        res.json(leave);
    } catch (error) {
        logger.error('Update leave status error', { error: error.message });
        res.status(400).json({ message: error.message });
    }
};

/**
 * Helper to update leave balance
 */
const updateLeaveBalance = async (leave) => {
    try {
        const year = new Date(leave.start_date).getFullYear();
        const balance = await LeaveBalance.findOne({
            employee_id: leave.employee_id,
            year
        });

        if (!balance) return;

        const field = `${leave.leave_type.toLowerCase()}_taken`;
        const balanceField = `${leave.leave_type.toLowerCase()}_balance`;

        balance[field] = (balance[field] || 0) + leave.total_days;
        balance[balanceField] = balance[`${leave.leave_type.toLowerCase()}_total`] - balance[field];

        await balance.save();
    } catch (error) {
        logger.error('Update leave balance error', { error: error.message });
    }
};

/**
 * Get leave balance
 */
exports.getLeaveBalance = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const year = req.query.year || new Date().getFullYear();

        let balance = await LeaveBalance.findOne({ employee_id, year });

        // Create if doesn't exist
        if (!balance) {
            balance = await LeaveBalance.create({ employee_id, year });
        }

        res.json(balance);
    } catch (error) {
        logger.error('Get leave balance error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};

// ==================== HR DASHBOARD ====================

/**
 * Get HR dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
    try {
        // Determine Today in Company Timezone (UTC+6)
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const today = new Date(utcTime + (3600000 * 6)); // +6 hours
        today.setHours(0, 0, 0, 0);

        // Upcoming Anniversaries (Next 30 days)
        const nextMonth = new Date(today);
        nextMonth.setDate(today.getDate() + 30);

        // MongoDB doesn't have a simple "day of year" match for anniversaries across years easily without aggregation
        // We'll fetch active employees and filter in JS for simplicity unless dataset is huge
        const employees = await HREmployee.find({ 'employment_info.status': 'Active' })
            .select('personal_info.full_name employment_info.joining_date employment_info.current_department');

        const anniversaries = employees.filter(emp => {
            if (!emp.employment_info?.joining_date) return false;
            const joinDate = new Date(emp.employment_info.joining_date);
            const currentYearAnniversary = new Date(today.getFullYear(), joinDate.getMonth(), joinDate.getDate());

            // If anniversary for this year already passed, check next year (unlikely for 30 day window but good practice)
            // Actually for "upcoming", we just want those between today and nextMonth

            // Simplified: check if month/day is within range
            // Let's just normalize to current year for comparison
            const anniversaryThisYear = new Date(today.getFullYear(), joinDate.getMonth(), joinDate.getDate());

            return anniversaryThisYear >= today && anniversaryThisYear <= nextMonth;
        }).map(emp => {
            const joinDate = new Date(emp.employment_info.joining_date);
            const years = today.getFullYear() - joinDate.getFullYear();
            return {
                _id: emp._id,
                name: emp.personal_info.full_name,
                years,
                date: joinDate
            };
        }).sort((a, b) => a.date - b.date).slice(0, 5);

        // Department Headcount
        const departmentCounts = {};
        employees.forEach(emp => {
            const dept = emp.employment_info?.current_department || 'Unassigned';
            departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
        });

        const departments = Object.entries(departmentCounts).map(([name, count]) => ({
            name,
            count,
            percentage: Math.round((count / employees.length) * 100)
        })).sort((a, b) => b.count - a.count);

        const stats = {
            total_employees: employees.length,
            on_probation: await HREmployee.countDocuments({ 'employment_info.status': 'Probation' }),
            present_today: await AttendanceSummary.countDocuments({
                date: today,
                status: { $in: ['Present', 'Late'] }
            }),
            absent_today: await AttendanceSummary.countDocuments({
                date: today,
                status: 'Absent'
            }),
            pending_leaves: await LeaveRequest.countDocuments({ status: 'Pending' }),
            anniversaries,
            departments
        };

        res.json(stats);
    } catch (error) {
        logger.error('Get dashboard stats error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};
