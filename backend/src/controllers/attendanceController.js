const { AttendancePunch, AttendanceSummary, HREmployee } = require('../models/hrModels');
const { logger } = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Get current punch status for an employee (Today)
 */
exports.getTodayStatus = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all punches for today
        const punches = await AttendancePunch.find({
            employee_id,
            timestamp: { $gte: today }
        }).sort('timestamp');

        const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;

        // Calculate total worked hours so far today
        let totalMinutes = 0;
        for (let i = 0; i < punches.length; i += 2) {
            const punchIn = punches[i];
            const punchOut = punches[i + 1];
            if (punchIn && punchOut) {
                totalMinutes += (punchOut.timestamp - punchIn.timestamp) / (1000 * 60);
            } else if (punchIn && !punchOut) {
                // If currently clocked in, calculate up to now
                totalMinutes += (new Date() - punchIn.timestamp) / (1000 * 60);
            }
        }

        res.json({
            isClockedIn: lastPunch ? lastPunch.punch_type === 'IN' : false,
            lastPunch,
            totalHoursToday: (totalMinutes / 60).toFixed(2),
            punches
        });
    } catch (error) {
        logger.error('Error getting today status', { error: error.message });
        res.status(500).json({ message: 'Failed to fetch status' });
    }
};

/**
 * Manual Punch (Clock In/Out)
 */
exports.manualPunch = async (req, res) => {
    try {
        const { employee_id, device_id = 'HR_PANEL' } = req.body;

        // Find employee to get RFID if needed (though web punch doesn't need it)
        const employee = await HREmployee.findById(employee_id);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Determine current status
        const lastPunch = await AttendancePunch.findOne({
            employee_id: employee._id,
            timestamp: { $gte: today }
        }).sort({ timestamp: -1 });

        const nextAction = (!lastPunch || lastPunch.punch_type === 'OUT') ? 'IN' : 'OUT';

        const punch = await AttendancePunch.create({
            employee_id: employee._id,
            rfid_card_number: employee.rfid_card_number || 'MANUAL',
            punch_type: nextAction,
            device_id,
            timestamp: new Date()
        });

        // Trigger summary recalculation (async)
        // Note: In production, this might be handled by a queue or a separate service
        calculateSummary(employee._id, today);

        res.json({
            success: true,
            action: nextAction,
            punch
        });

    } catch (error) {
        logger.error('Manual punch error', { error: error.message });
        res.status(500).json({ message: 'Punch failed' });
    }
};

/**
 * Recalculate Attendance Summary for a specific day
 * This is a helper function that mirrors the logic in the RFID integration
 */
async function calculateSummary(employee_id, date) {
    try {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const punches = await AttendancePunch.find({
            employee_id,
            timestamp: { $gte: date, $lt: nextDay }
        }).sort('timestamp');

        if (punches.length === 0) return;

        const check_in = punches[0].timestamp;
        const check_out = punches.length > 1 ? punches[punches.length - 1].timestamp : null;

        let total_work_minutes = 0;
        for (let i = 0; i < punches.length; i += 2) {
            const pin = punches[i];
            const pout = punches[i + 1];
            if (pin && pout) {
                total_work_minutes += (pout.timestamp - pin.timestamp) / (1000 * 60);
            }
        }

        const total_work_hours = (total_work_minutes / 60).toFixed(2);

        // Dynamic status based on shift
        let status = 'Present';
        const employeeRecord = await HREmployee.findById(employee_id).populate('employment_info.shift_id');
        const shift = employeeRecord?.employment_info?.shift_id;

        if (shift) {
            const [sHour, sMin] = shift.start_time.split(':').map(Number);
            const graceMinutes = shift.grace_period_minutes || 0;
            const shiftStartTime = new Date(check_in);
            shiftStartTime.setHours(sHour, sMin, 0, 0);
            const lateCutoff = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

            if (check_in > lateCutoff) {
                status = 'Late';
            }
        }

        await AttendanceSummary.findOneAndUpdate(
            { employee_id, date },
            {
                check_in,
                check_out,
                total_work_hours,
                status,
                is_manual: false
            },
            { upsert: true, new: true }
        );

    } catch (error) {
        console.error('Summary calculation background error:', error);
    }
}
