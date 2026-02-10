const { Department, Designation, Position } = require('../models/hrModels');
const { logger } = require('../utils/logger');

// Departments
exports.getDepartments = async (req, res) => {
    try {
        const departments = await Department.find().sort('name');
        res.json(departments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createDepartment = async (req, res) => {
    try {
        const { name, id_prefix } = req.body;
        const dept = await Department.create({ name, id_prefix: id_prefix || name.substring(0, 2).toUpperCase() });
        res.status(201).json(dept);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Designations
exports.getDesignations = async (req, res) => {
    try {
        const designations = await Designation.find().sort('name');
        res.json(designations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createDesignation = async (req, res) => {
    try {
        const designation = await Designation.create(req.body);
        res.status(201).json(designation);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Positions
exports.getPositions = async (req, res) => {
    try {
        const positions = await Position.find().sort('name');
        res.json(positions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.createPosition = async (req, res) => {
    try {
        const position = await Position.create(req.body);
        res.status(201).json(position);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Expense Categories
exports.getExpenseCategories = async (req, res) => {
    try {
        const categories = await require('../models').ExpenseCategory.find({ is_active: true }).sort('name');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createExpenseCategory = async (req, res) => {
    try {
        const { name, type, description } = req.body;
        const category = await require('../models').ExpenseCategory.create({ name, type, description });
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteExpenseCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await require('../models').ExpenseCategory.findByIdAndUpdate(id, { is_active: false });
        res.json({ message: 'Category deactivated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
