const { Employee, Attendance, Leave } = require('../models');
const { logEvent } = require('../utils/logger');

// ATTENDANCE
exports.getAttendance = async (req, res) => {
    try {
        const { date, month, employee_id } = req.query;
        let query = {};

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        } else if (month) {
            const start = new Date(month + '-01');
            const end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            query.date = { $gte: start, $lte: end };
        }

        if (employee_id) query.employee_id = employee_id;

        const attendance = await Attendance.find(query).populate('employee_id').sort({ date: -1 });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

exports.saveAttendance = async (req, res) => {
    try {
        const { employee_id, date, check_in, check_out, status, remarks } = req.body;

        const attendance = await Attendance.findOneAndUpdate(
            { employee_id, date: new Date(date).setHours(0, 0, 0, 0) },
            { check_in, check_out, status, remarks },
            { upsert: true, new: true }
        );

        res.json(attendance);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

exports.bulkAttendance = async (req, res) => {
    try {
        const { records } = req.body; // Array of {employee_id, date, status...}
        const results = [];
        for (const record of records) {
            const up = await Attendance.findOneAndUpdate(
                { employee_id: record.employee_id, date: new Date(record.date).setHours(0, 0, 0, 0) },
                record,
                { upsert: true, new: true }
            );
            results.push(up);
        }
        res.json(results);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

// LEAVES
exports.getLeaves = async (req, res) => {
    try {
        const { employee_id, status } = req.query;
        let query = {};
        if (employee_id) query.employee_id = employee_id;
        if (status) query.status = status;

        const leaves = await Leave.find(query).populate('employee_id').sort({ start_date: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

exports.createLeave = async (req, res) => {
    try {
        const leave = await Leave.create(req.body);
        const emp = await Employee.findById(req.body.employee_id);
        await logEvent(req.user.username, 'Leave Request', `New leave request from ${emp ? emp.name : 'Unknown'}`, 'entry');
        res.status(201).json(leave);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;
        const leave = await Leave.findByIdAndUpdate(id, { status, approved_by: req.user.username }, { new: true }).populate('employee_id');

        await logEvent(req.user.username, 'Leave Update', `Set leave status for ${leave.employee_id.name} to ${status}`, 'admin');
        res.json(leave);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};
