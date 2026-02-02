const { Shift } = require('../models/hrModels');
const { logger } = require('../utils/logger');

/**
 * Get all shifts
 */
exports.getShifts = async (req, res) => {
    try {
        const shifts = await Shift.find().sort({ name: 1 });
        res.json(shifts);
    } catch (error) {
        logger.error('Get shifts error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create or Update Shift
 */
exports.saveShift = async (req, res) => {
    try {
        const { id, name, start_time, end_time, grace_period_minutes, is_active } = req.body;

        if (!name || !start_time || !end_time) {
            return res.status(400).json({ message: 'Name, Start Time and End Time are required' });
        }

        let shift;
        if (id) {
            shift = await Shift.findByIdAndUpdate(
                id,
                { name, start_time, end_time, grace_period_minutes, is_active },
                { new: true, runValidators: true }
            );
        } else {
            shift = await Shift.create({
                name,
                start_time,
                end_time,
                grace_period_minutes,
                is_active
            });
        }

        res.json(shift);
    } catch (error) {
        logger.error('Save shift error', { error: error.message });
        res.status(400).json({ message: error.message });
    }
};

/**
 * Delete Shift
 */
exports.deleteShift = async (req, res) => {
    try {
        const { id } = req.params;
        await Shift.findByIdAndDelete(id);
        res.json({ success: true, message: 'Shift deleted' });
    } catch (error) {
        logger.error('Delete shift error', { error: error.message });
        res.status(500).json({ message: error.message });
    }
};
