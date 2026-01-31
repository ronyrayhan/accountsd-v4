const { Employee, Increment, PayrollRecord } = require('../models');
const { logEvent } = require('../utils/logger');

// Employee CRUD
exports.getEmployees = async (req, res) => {
    try {
        const employees = await Employee.find().sort({ emp_id: 1 }).populate('increments');
        res.json(employees);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

exports.createEmployee = async (req, res) => {
    try {
        const employee = await Employee.create(req.body);
        await logEvent(req.user.username, 'New Employee', `Created employee: ${employee.name} (${employee.emp_id})`, 'admin');
        res.status(201).json(employee);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

exports.updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await Employee.findByIdAndUpdate(id, req.body, { new: true });
        if (!employee) return res.status(404).json({ detail: 'Employee not found' });
        await logEvent(req.user.username, 'Update Employee', `Updated employee details/status for ${employee.name}`, 'admin');
        res.json(employee);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

// Increment CRUD
exports.getIncrements = async (req, res) => {
    try {
        const increments = await Increment.find().populate('employee_id').sort({ effective_date: -1 });
        res.json(increments);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

exports.createIncrement = async (req, res) => {
    try {
        const increment = await Increment.create(req.body);
        const emp = await Employee.findById(req.body.employee_id);
        await logEvent(req.user.username, 'New Increment', `Added salary increment for ${emp ? emp.name : 'Unknown Employee'}`, 'admin');
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
        const employee = await Employee.findById(employee_id);
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

        const totalPast = pastIncs.reduce((sum, inc) => sum + Number(inc.amount), 0);
        const totalCurrent = currentIncs.reduce((sum, inc) => sum + Number(inc.amount), 0);

        const baseSalary = Number(employee.base_salary);
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
            obj.Employee = obj.employee_id;
            return obj;
        });
        res.json(mapped);
    } catch (error) {
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
        const emp = await Employee.findById(data.employee_id);
        await logEvent(req.user.username, 'Save Payroll', `Saved payroll record for ${emp ? emp.name : 'Unknown'} for month ${data.month}`, 'admin');
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
