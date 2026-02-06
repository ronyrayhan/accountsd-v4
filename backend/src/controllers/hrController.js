const {
    HREmployee,
    CareerHistory,
    AttendancePunch,
    AttendanceSummary,
    LeaveRequest,
    LeaveBalance,
    ExitRecord,
    Department
} = require('../models/hrModels');
const { Counter, User } = require('../models');
const { hashPassword } = require('../middleware/auth');
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

        // Include account info
        const user = await User.findOne({ employee_id: employee._id }, 'username');
        const responseData = employee.toObject();
        responseData.account_username = user ? user.username : '';

        res.json(responseData);
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
        const { account_username, account_password, ...employeeData } = req.body;

        // Auto-generate employee_id based on Department and serial
        const deptName = employeeData.employment_info?.current_department;
        const dept = await Department.findOne({ name: deptName });
        const prefix = dept ? dept.id_prefix : 'EMP';

        const counter = await Counter.findByIdAndUpdate(
            { _id: `emp_serial_${prefix}` },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        const employee_id = `${prefix}${1000 + counter.seq}`;

        const employee = await HREmployee.create({
            ...employeeData,
            employee_id
        });

        // Create initial leave balance for current year
        const currentYear = new Date().getFullYear();
        await LeaveBalance.create({
            employee_id: employee._id,
            year: currentYear
        });

        // Automatically create ESS User Account if credentials provided or based on rules
        let finalUsername = account_username;
        let finalPassword = account_password;

        if (!finalUsername && employee.personal_info.full_name) {
            // Rule: ESS ID is full name
            finalUsername = employee.personal_info.full_name;
        }

        if (!finalPassword && employee.personal_info.full_name && employeeData.employment_info?.joining_date) {
            // Rule: SD@FullNameYYYYMMDD#
            const dateStr = new Date(employeeData.employment_info.joining_date).toISOString().split('T')[0].replace(/-/g, '');
            finalPassword = `SD@${employee.personal_info.full_name}${dateStr}#`;
        }

        if (finalUsername && finalPassword) {
            const hashedPassword = await hashPassword(finalPassword);
            await User.create({
                username: finalUsername,
                hashed_password: hashedPassword,
                role: 'ESS',
                employee_id: employee._id,
                onboarding_status: 'Pending'
            });
            logger.info('ESS User account created automatically', { username: finalUsername, employee_id });
        }

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
        const { account_username, account_password, ...employeeData } = req.body;

        const employee = await HREmployee.findByIdAndUpdate(
            req.params.id,
            employeeData,
            { new: true, runValidators: true }
        );

        if (!employee) {
            return res.status(404).json({ detail: 'Employee not found' });
        }

        // Update or Create ESS User Account
        if (account_username || account_password) {
            const user = await User.findOne({ employee_id: employee._id });
            if (user) {
                // Only allow password update for now via this flow
                if (account_password) {
                    user.hashed_password = await hashPassword(account_password);
                    await user.save();
                    logger.info('ESS User password updated', { username: user.username });
                }
            } else if (account_username && account_password) {
                // Create if doesn't exist (e.g. for old records)
                const hashedPassword = await hashPassword(account_password);
                await User.create({
                    username: account_username,
                    hashed_password: hashedPassword,
                    role: 'ESS',
                    employee_id: employee._id,
                    onboarding_status: 'Pending'
                });
                logger.info('ESS User account created (backfill)', { username: account_username });
            }
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

        // Status Calculation and early/late tracking based on Shift
        let status = 'Present';
        let early_entry = 0;
        let late_entry = 0;
        let early_exit = 0;
        let late_exit = 0;
        let overtime_hours = 0;

        const employee = await HREmployee.findById(employee_id).populate('employment_info.shift_id');
        const shift = employee?.employment_info?.shift_id;

        if (shift && firstPunch.punch_type === 'IN') {
            // Parse shift start and end times
            const [startHour, startMin] = shift.start_time.split(':').map(Number);
            const [endHour, endMin] = shift.end_time.split(':').map(Number);
            const graceMinutes = shift.grace_period_minutes || 0;

            // Shift start on the same biological day as the punch
            const shiftStartTime = new Date(firstPunch.timestamp);
            shiftStartTime.setHours(startHour, startMin, 0, 0);

            // Create shift end time
            const shiftEndTime = new Date(firstPunch.timestamp);
            shiftEndTime.setHours(endHour, endMin, 0, 0);

            // Handle overnight shifts
            if (shiftEndTime < shiftStartTime) {
                shiftEndTime.setDate(shiftEndTime.getDate() + 1);
            }

            // Arrival after grace period
            const lateCutoff = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

            // Calculate Early Entry
            if (firstPunch.timestamp < shiftStartTime) {
                early_entry = Math.round((shiftStartTime - firstPunch.timestamp) / (1000 * 60));
            }

            // Calculate Late Entry
            if (firstPunch.timestamp > lateCutoff) {
                late_entry = Math.round((firstPunch.timestamp - lateCutoff) / (1000 * 60));
                status = 'Late';
            }

            // Calculate Early Exit and Late Exit (if punched out)
            if (lastPunch.punch_type === 'OUT') {
                if (lastPunch.timestamp < shiftEndTime) {
                    early_exit = Math.round((shiftEndTime - lastPunch.timestamp) / (1000 * 60));
                } else {
                    late_exit = Math.round((lastPunch.timestamp - shiftEndTime) / (1000 * 60));
                    overtime_hours = parseFloat((late_exit / 60).toFixed(2));
                }
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
                status,
                early_entry,
                late_entry,
                early_exit,
                late_exit,
                overtime_hours
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

        let dateRange = [];
        if (start_date && end_date) {
            const [y1, m1, d1] = start_date.split('-').map(Number);
            const start = new Date(y1, m1 - 1, d1, 0, 0, 0, 0);

            const [y2, m2, d2] = end_date.split('-').map(Number);
            const end = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);

            query.date = { $gte: start, $lte: end };

            // Generate list of dates in the range for "Absent" check
            let current = new Date(start);
            while (current <= end) {
                dateRange.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
        } else {
            // Default to today if no date provided
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateRange = [today];
            query.date = today;
        }

        // 1. Get existing summaries
        const summaries = await AttendanceSummary.find(query)
            .populate('employee_id', 'employee_id personal_info.full_name employment_info.current_department')
            .sort({ date: -1 });

        // 2. If filtering by a specific status that isn't 'Absent', just return summaries
        if (status && status !== 'Absent') {
            return res.json(summaries);
        }

        // 3. Get all active employees to check for absentees
        const empQuery = { 'employment_info.status': 'Active' };
        if (employee_id) empQuery._id = employee_id;
        const allEmployees = await HREmployee.find(empQuery, 'employee_id personal_info.full_name employment_info.current_department');

        // 3a. Get all approved leaves that overlap with the date range
        const overlappingLeaves = await LeaveRequest.find({
            status: 'Approved',
            employee_id: employee_id ? employee_id : { $exists: true }, // Filter by employee_id if provided
            start_date: { $lte: query.date.$lte || new Date() },
            end_date: { $gte: query.date.$gte || new Date() }
        }).populate('leave_type', 'name');

        // 4. Merge: For each date, ensure every employee has a record
        const finalAttendance = [...summaries];

        // Create a lookup map for existing records: "date_empId"
        const existingMap = new Set(summaries.map(s => {
            const d = new Date(s.date).toDateString();
            const eid = s.employee_id?._id?.toString() || s.employee_id?.toString();
            return `${d}_${eid}`;
        }));

        // Fill missing records as "Absent" or "On Leave"
        dateRange.forEach(date => {
            const dateStr = date.toDateString();
            allEmployees.forEach(emp => {
                const key = `${dateStr}_${emp._id.toString()}`;
                if (!existingMap.has(key)) {
                    // Check if this employee is on approved leave for this specific date
                    const leaveOnThisDay = overlappingLeaves.find(leave =>
                        leave.employee_id.toString() === emp._id.toString() &&
                        date >= new Date(new Date(leave.start_date).setHours(0, 0, 0, 0)) &&
                        date <= new Date(new Date(leave.end_date).setHours(23, 59, 59, 999))
                    );

                    finalAttendance.push({
                        _id: `absent_${dateStr}_${emp._id}`,
                        employee_id: emp,
                        date: date,
                        status: leaveOnThisDay ? 'On Leave' : 'Absent',
                        leave_type_name: leaveOnThisDay?.leave_type?.name || null,
                        punch_in: null,
                        punch_out: null,
                        total_hours: 0,
                        early_entry: 0,
                        late_entry: 0,
                        early_exit: 0,
                        late_exit: 0,
                        overtime_hours: 0,
                        segments: []
                    });
                }
            });
        });

        // Filter by status again (in case user explicitly asked for 'Absent' or 'On Leave')
        let result = finalAttendance;
        if (status === 'Absent') {
            result = finalAttendance.filter(a => a.status === 'Absent');
        } else if (status === 'On Leave') {
            result = finalAttendance.filter(a => a.status === 'On Leave');
        }

        res.json(result.sort((a, b) => new Date(b.date) - new Date(a.date)));
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

/**
 * Admin override/manual attendance entry
 */
exports.overrideAttendance = async (req, res) => {
    try {
        const { employee_id, date, punch_in, punch_out, notes } = req.body;

        if (!employee_id || !date || !punch_in || !punch_out) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const employee = await HREmployee.findById(employee_id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Calculate start/end of day consistently with updateDailySummary
        const d = new Date(date);
        const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
        const startOfDay = new Date(utcTime + (3600000 * 6));
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Delete existing punches for this specific day
        await AttendancePunch.deleteMany({
            employee_id,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        });

        // 2. Create new manual punches
        await AttendancePunch.create([
            {
                employee_id,
                rfid_card_number: employee.employment_info?.rfid_card_number || 'MANUAL',
                punch_type: 'IN',
                timestamp: new Date(punch_in),
                notes: notes || 'Admin Override'
            },
            {
                employee_id,
                rfid_card_number: employee.employment_info?.rfid_card_number || 'MANUAL',
                punch_type: 'OUT',
                timestamp: new Date(punch_out),
                notes: notes || 'Admin Override'
            }
        ]);

        // 3. Trigger summary update
        await updateDailySummary(employee_id, date);

        res.json({ message: 'Attendance overridden successfully' });
    } catch (error) {
        logger.error('Override attendance error', { error: error.message });
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
            on_leave_today: await LeaveRequest.countDocuments({
                status: 'Approved',
                start_date: { $lte: today },
                end_date: { $gte: today }
            }),
            // specific absent calculation: Total Active - (Present + On Leave)
            // Note: This is an approximation. Improve with shift logic if needed.
        };

        // Calculate absent dynamically
        stats.absent_today = Math.max(0, stats.total_employees - stats.present_today - stats.on_leave_today);
        stats.pending_leaves = await LeaveRequest.countDocuments({ status: 'Pending' });

        // Add back other props
        stats.anniversaries = anniversaries;
        stats.departments = departments;

        res.json(stats);
    } catch (error) {
        logger.error('Get dashboard stats error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};
