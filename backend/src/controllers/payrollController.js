const { HREmployee, Increment, PayrollRecord, CareerHistory } = require('../models');  // CHANGED: Added CareerHistory
const { logEvent } = require('../utils/logger');

// Employee Read-Only View (Mapped from HR)
exports.getEmployees = async (req, res) => {
    try {
        // Fetch from HR Module
        const employees = await HREmployee.find({ 'employment_info.status': { $ne: 'Terminated' } })
            .select('employee_id personal_info.full_name employment_info.current_department employment_info.current_designation employment_info.joining_date employment_info.employment_type compensation.current_salary employment_info.status')
            .sort({ employee_id: 1 });

        // Map to legacy format expected by Payroll Frontend
        const mapped = employees.map(e => ({
            id: e._id,
            emp_id: e.employee_id,
            name: e.personal_info.full_name,
            department: e.employment_info.current_department,
            designation: e.employment_info.current_designation,
            joining_date: e.employment_info.joining_date,
            employment_type: e.employment_info.employment_type,
            base_salary: e.compensation?.current_salary || 0,
            status: e.employment_info.status
        }));

        res.json(mapped);
    } catch (error) {
        console.error('getEmployees Error:', error);
        res.status(500).json({ detail: error.message });
    }
};

// DEPRECATED: Employees should be managed in HR
exports.createEmployee = async (req, res) => {
    res.status(400).json({ detail: "Please add new employees through the HR Module." });
};

exports.updateEmployee = async (req, res) => {
    res.status(400).json({ detail: "Please update employee details through the HR Module." });
};

// Increment CRUD
exports.getIncrements = async (req, res) => {
    try {
        const increments = await Increment.find().populate('employee_id').sort({ effective_date: -1 });
        // Map populate to expected Employee format if needed, but Mongoose usually handles subdocs.
        // The frontend expects `Employee.name`. HREmployee has `personal_info.full_name`.
        // We might need to adjust the frontend or map here. For now, let's map it here to be safe.
        const mapped = increments.map(inc => {
            const obj = inc.toObject();
            if (obj.employee_id) {
                obj.Employee = {
                    id: obj.employee_id._id,
                    name: obj.employee_id.personal_info?.full_name,
                    emp_id: obj.employee_id.employee_id
                };
            }
            return obj;
        });
        res.json(mapped);
    } catch (error) {
        console.error('getIncrements Error:', error);
        res.status(500).json({ detail: error.message });
    }
};

exports.createIncrement = async (req, res) => {
    try {
        const increment = await Increment.create(req.body);
        const emp = await HREmployee.findById(req.body.employee_id);

        if (emp) {
            // Calculate REAL current salary by adding existing increments to base
            const allIncs = await Increment.find({ employee_id: emp._id });
            const totalIncsBeforeNewOne = allIncs.reduce((s, i) => s + (Number(i.amount) || 0), 0);
            const baseSalaryFixed = Number(emp.compensation?.current_salary || 0);

            // Record in Career History for HR visibility
            await CareerHistory.create({
                employee_id: emp._id,
                change_type: 'Increment',
                effective_date: req.body.effective_date,
                previous_values: {
                    designation: emp.employment_info?.current_designation,
                    department: emp.employment_info?.current_department,
                    salary: baseSalaryFixed + totalIncsBeforeNewOne
                },
                new_values: {
                    designation: emp.employment_info?.current_designation,
                    department: emp.employment_info?.current_department,
                    salary: baseSalaryFixed + totalIncsBeforeNewOne + (Number(req.body.amount) || 0)
                },
                reason: req.body.remarks || 'Salary Correction (Payroll Module)',
                approved_by: req.user.username || 'System'
            });
        }

        await logEvent(req.user.username, 'New Increment', `Added salary increment for ${emp ? emp.personal_info.full_name : 'Unknown Employee'}`, 'admin');
        res.status(201).json(increment);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

exports.updateIncrement = async (req, res) => {
    try {
        const { id } = req.params;
        const increment = await Increment.findByIdAndUpdate(id, req.body, { new: true });
        if (!increment) return res.status(404).json({ detail: 'Increment not found' });
        res.json(increment);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

exports.deleteIncrement = async (req, res) => {
    try {
        const { id } = req.params;
        const increment = await Increment.findByIdAndDelete(id);
        if (!increment) return res.status(404).json({ detail: 'Increment not found' });
        res.json({ detail: 'Increment deleted successfully' });
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

// Payroll Logic
exports.calculateSalary = async (req, res) => {
    try {
        const { employee_id, month } = req.query; // month in YYYY-MM format

        // Ownership Check (IDOR Mitigation)
        const userRole = req.user.role?.toLowerCase();
        const isSelf = req.user.employee_id?.toString() === employee_id.toString();
        const isAdminOrHR = ['admin', 'hr'].includes(userRole);

        if (!isSelf && !isAdminOrHR) {
            return res.status(403).json({ detail: 'Unauthorized to view this salary calculation' });
        }

        const employee = await HREmployee.findById(employee_id);
        if (!employee) return res.status(404).json({ detail: 'Employee not found' });

        const firstDay = new Date(month + '-01');
        const lastDay = new Date(firstDay);
        lastDay.setMonth(lastDay.getMonth() + 1);
        lastDay.setDate(0);

        // Increments effective BEFORE this month
        const pastIncs = await Increment.find({
            employee_id,
            effective_date: { $lt: firstDay }
        });

        // Increments effective DURING this month
        const currentIncs = await Increment.find({
            employee_id,
            effective_date: {
                $gte: firstDay,
                $lte: lastDay
            }
        });

        const totalPast = pastIncs.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
        const totalCurrent = currentIncs.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);

        const baseSalary = Number(employee.compensation?.current_salary || 0);

        // HACK: Historically in this app, base_salary was dynamic. 
        // If HR defines "current_salary" as the final current base, we shouldn't add past increments again if they are already baked in.
        // However, for consistency with the legacy logic which separated Base + Increments, we will assume HR Salary is the STARTING Base.
        // OR: simpler - treat HR salary as the "Current Basic".
        // Let's assume HR 'current_salary' is the RAW Base.

        const calculatedBasic = baseSalary + totalPast;

        res.json({
            employee_id,
            month,
            base_salary: calculatedBasic,
            total_increments: totalCurrent,
            gross_salary: calculatedBasic + totalCurrent
        });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

exports.getPayrollRecords = async (req, res) => {
    try {
        const { month } = req.query;
        const query = month ? { month } : {};
        const records = await PayrollRecord.find(query).populate('employee_id').sort({ month: -1 });
        const mapped = records.map(r => {
            const obj = r.toObject();
            if (obj.employee_id) {
                obj.Employee = {
                    name: obj.employee_id.personal_info?.full_name,
                    emp_id: obj.employee_id.employee_id,
                    department: obj.employee_id.employment_info?.current_department
                };
            }
            return obj;
        });
        res.json(mapped);
    } catch (error) {
        console.error('getPayrollRecords Error:', error);
        res.status(500).json({ detail: error.message });
    }
};

exports.savePayrollRecord = async (req, res) => {
    try {
        const data = { ...req.body };
        const numericFields = ['paid_days', 'working_days', 'base_salary_snapshot', 'total_increments_snapshot',
            'transport_allowance', 'other_allowance', 'bonus', 'advance_salary',
            'gross_salary', 'net_salary'];

        numericFields.forEach(field => {
            if (data[field] !== undefined) {
                data[field] = Number(data[field]);
            }
        });

        const record = await PayrollRecord.create(data);
        const emp = await HREmployee.findById(data.employee_id);
        await logEvent(req.user.username, 'Save Payroll', `Saved payroll record for ${emp ? emp.personal_info.full_name : 'Unknown'} for month ${data.month}`, 'admin');
        res.status(201).json(record);
    } catch (error) {
        console.error('Save Payroll Error:', error);
        res.status(400).json({
            detail: error.message
        });
    }
};

exports.deletePayrollRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await PayrollRecord.findByIdAndDelete(id);
        if (!record) return res.status(404).json({ detail: 'Payroll record not found' });
        res.json({ detail: 'Payroll record deleted successfully' });
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

exports.updatePayrollRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await PayrollRecord.findByIdAndUpdate(id, req.body, { new: true });
        if (!record) return res.status(404).json({ detail: 'Payroll record not found' });
        res.json(record);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

