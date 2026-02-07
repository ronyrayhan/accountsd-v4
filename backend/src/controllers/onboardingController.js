const { OnboardingContent, OnboardingProgress, User, HREmployee } = require('../models');
const { logEvent } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// --- Content Management (HR/Admin) ---

const getContent = async (req, res) => {
    try {
        const content = await OnboardingContent.find().sort({ order: 1 });
        const normalizedContent = content.map(item => {
            if (item.file_path) item.file_path = item.file_path.replace(/\\/g, '/');
            return item;
        });
        res.json(normalizedContent);
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
};

const createContent = async (req, res) => {
    try {
        const { type, title, description, url, custom_html, is_mandatory, order, form_fields } = req.body;
        const file_path = req.file ? req.file.path : null;

        let parsedFields = form_fields;
        if (typeof form_fields === 'string') {
            try { parsedFields = JSON.parse(form_fields); } catch (e) { parsedFields = []; }
        }

        let parsedSoftwareUrls = req.body.software_urls;
        if (typeof parsedSoftwareUrls === 'string') {
            try { parsedSoftwareUrls = JSON.parse(parsedSoftwareUrls); } catch (e) { parsedSoftwareUrls = []; }
        }

        let parsedTrainingResources = req.body.training_resources;
        if (typeof parsedTrainingResources === 'string') {
            try { parsedTrainingResources = JSON.parse(parsedTrainingResources); } catch (e) { parsedTrainingResources = []; }
        }

        const content = await OnboardingContent.create({
            type, title, description, url, custom_html, file_path, is_mandatory, order,
            form_fields: parsedFields,
            software_urls: parsedSoftwareUrls,
            training_resources: parsedTrainingResources
        });

        await logEvent(req.user.username, 'Onboarding', `Created onboarding material: ${title}`, 'admin');
        res.status(201).json(content);
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
};

const updateContent = async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (req.file) {
            updateData.file_path = req.file.path.replace(/\\/g, '/');

            // Delete old file if exists
            const oldContent = await OnboardingContent.findById(req.params.id);
            if (oldContent?.file_path && fs.existsSync(oldContent.file_path)) {
                try { fs.unlinkSync(oldContent.file_path); } catch (e) { }
            }
        }

        if (updateData.form_fields && typeof updateData.form_fields === 'string') {
            try { updateData.form_fields = JSON.parse(updateData.form_fields); } catch (e) { }
        }

        if (updateData.software_urls && typeof updateData.software_urls === 'string') {
            try { updateData.software_urls = JSON.parse(updateData.software_urls); } catch (e) { }
        }

        if (updateData.training_resources && typeof updateData.training_resources === 'string') {
            try { updateData.training_resources = JSON.parse(updateData.training_resources); } catch (e) { }
        }

        const content = await OnboardingContent.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!content) return res.status(404).json({ detail: 'Content not found' });

        await logEvent(req.user.username, 'Onboarding', `Updated onboarding material: ${content.title}`, 'admin');
        res.json(content);
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
};

const deleteContent = async (req, res) => {
    try {
        const content = await OnboardingContent.findById(req.params.id);
        if (!content) return res.status(404).json({ detail: 'Content not found' });

        if (content.file_path && fs.existsSync(content.file_path)) {
            fs.unlinkSync(content.file_path);
        }

        await OnboardingContent.findByIdAndDelete(req.params.id);
        await logEvent(req.user.username, 'Onboarding', `Deleted onboarding material: ${content.title}`, 'admin');
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
};

// --- Employee Progress (HR/Admin) ---

const getAllProgress = async (req, res) => {
    try {
        const progress = await OnboardingProgress.find()
            .populate('user_id', 'username onboarding_status')
            .populate('content_id', 'title type');
        res.json(progress);
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
};

const getEmployeeOnboarding = async (req, res) => {
    try {
        const { id } = req.params; // Student/Employee ID

        // Ownership Check (IDOR Mitigation)
        const userRole = req.user.role?.toLowerCase();
        const isSelf = req.user.employee_id?.toString() === id.toString();
        const isAdminOrHR = ['admin', 'hr'].includes(userRole);

        if (!isSelf && !isAdminOrHR) {
            return res.status(403).json({ detail: 'Unauthorized to view this onboarding progress' });
        }

        const user = await User.findOne({ employee_id: id });
        if (!user) return res.status(404).json({ detail: 'User not found for this employee' });

        const progress = await OnboardingProgress.find({ user_id: user._id })
            .populate('content_id');

        res.json(progress);
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
};

const resetEmployeeOnboarding = async (req, res) => {
    try {
        const { employee_id } = req.params; // This is the HREmployee _id

        const user = await User.findOne({ employee_id });
        if (user) {
            // 1. Delete all progress records
            await OnboardingProgress.deleteMany({ user_id: user._id });

            // 2. Reset status on User model
            user.onboarding_status = 'Pending';
            await user.save();
        }

        // 3. Sync with HREmployee record if exists
        const employee = await HREmployee.findById(employee_id);
        if (employee) {
            employee.onboarding_status = 'Pending';
            await employee.save();
        }

        await logEvent(req.user.username, 'Onboarding', `Reset onboarding for employee ID: ${employee_id}`, 'admin');

        res.json({ success: true, message: 'Onboarding reset successfully' });
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
};

module.exports = {
    getContent,
    createContent,
    updateContent,
    deleteContent,
    getAllProgress,
    getEmployeeOnboarding,
    resetEmployeeOnboarding
};
