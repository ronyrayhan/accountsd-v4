const { GlobalSetting } = require('../models');
const { logEvent } = require('../utils/logger');

const getSetting = async (req, res) => {
    try {
        const setting = await GlobalSetting.findOne({ key: req.params.key });
        res.json({ key: req.params.key, value: setting ? setting.value : null });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const setSetting = async (req, res) => {
    try {
        const { key, value } = req.body;
        let setting = await GlobalSetting.findOne({ key });
        if (setting) {
            setting.value = String(value);
            await setting.save();
        } else {
            setting = await GlobalSetting.create({ key, value: String(value) });
        }
        await logEvent(req.user.username, 'Update Setting', `Changed ${key} to ${value}`, 'setting');
        res.json(setting);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getAllSettings = async (req, res) => {
    try {
        const settings = await GlobalSetting.find({});
        const result = {};
        settings.forEach(s => result[s.key] = s.value);
        res.json(result);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

module.exports = {
    getSetting,
    setSetting,
    getAllSettings
};

