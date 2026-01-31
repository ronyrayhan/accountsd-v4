const { Asset, Employee, AssetHistory, AssetCategory } = require('../models');
const { logEvent } = require('../utils/logger');

// Helper to clean data from FormData
const cleanAssetData = (data) => {
    const cleaned = { ...data };

    // Handle Boolean
    if (cleaned.is_fixed === 'true') cleaned.is_fixed = true;
    if (cleaned.is_fixed === 'false') cleaned.is_fixed = false;

    // Handle Empty Strings for numeric/date fields
    if (cleaned.purchase_value === '') cleaned.purchase_value = null;
    if (cleaned.purchase_date === '') cleaned.purchase_date = null;
    if (cleaned.serial_number === '') cleaned.serial_number = null; // Important for sparse index

    // Handle Object IDs
    if (cleaned.assigned_to === '') cleaned.assigned_to = null;

    // Convert numbers
    if (cleaned.purchase_value) cleaned.purchase_value = Number(cleaned.purchase_value);

    return cleaned;
};

exports.getAssets = async (req, res) => {
    try {
        const { status, category, assigned_to } = req.query;
        let query = {};
        if (status) query.status = status;
        if (category) query.category = category;
        if (assigned_to) query.assigned_to = assigned_to;

        const assets = await Asset.find(query)
            .populate('assigned_to')
            .populate({
                path: 'history',
                populate: { path: 'employee_id', select: 'name' },
                options: { sort: { date: -1 } }
            })
            .sort({ createdAt: -1 });

        res.json(assets);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

// CATEGORY MANAGEMENT
exports.getCategories = async (req, res) => {
    try {
        const cats = await AssetCategory.find().sort({ name: 1 });
        res.json(cats);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const cat = await AssetCategory.create(req.body);
        res.status(201).json(cat);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await AssetCategory.findByIdAndDelete(req.params.id);
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

exports.createAsset = async (req, res) => {
    try {
        const assetData = cleanAssetData(req.body);
        if (req.file) {
            assetData.invoice_image = `/uploads/${req.file.filename}`;
        }

        const asset = await Asset.create(assetData);
        await logEvent(req.user.username, 'New Asset', `Added office asset: ${asset.name}`, 'admin');
        res.status(201).json(asset);
    } catch (error) {
        console.error('Create Asset Error:', error);
        res.status(400).json({ detail: error.message });
    }
};

exports.updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const assetData = cleanAssetData(req.body);
        if (req.file) {
            assetData.invoice_image = `/uploads/${req.file.filename}`;
        }

        const asset = await Asset.findByIdAndUpdate(id, assetData, { new: true }).populate('assigned_to');
        if (!asset) return res.status(404).json({ detail: 'Asset not found' });

        await logEvent(req.user.username, 'Update Asset', `Updated asset details for ${asset.name}`, 'admin');
        res.json(asset);
    } catch (error) {
        console.error('Update Asset Error:', error);
        res.status(400).json({ detail: error.message });
    }
};

exports.assignAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { employee_id, room_number, notes } = req.body;

        const oldAsset = await Asset.findById(id);
        if (!oldAsset) return res.status(404).json({ detail: 'Asset not found' });

        const empId = employee_id === '' ? null : employee_id;
        const rmNum = room_number === '' ? null : room_number;

        let status = 'Available';
        let action = 'Returned';

        if (empId) {
            status = 'In Use';
            action = oldAsset.assigned_to ? 'Transferred' : 'Assigned';
        } else if (rmNum) {
            status = oldAsset.is_fixed ? 'In Use' : 'Available';
            action = 'Relocated';
        }

        const asset = await Asset.findByIdAndUpdate(
            id,
            {
                assigned_to: empId,
                status: status,
                room_number: rmNum || oldAsset.room_number
            },
            { new: true }
        ).populate('assigned_to');

        // Log History
        await AssetHistory.create({
            asset_id: id,
            asset_name: oldAsset.name,
            employee_id: empId,
            action: action,
            performed_by: req.user.username,
            notes: notes || (rmNum ? `Moved to ${rmNum}` : '')
        });

        const target = empId ? (asset.assigned_to ? asset.assigned_to.name : 'User') : (rmNum || 'Stock');
        await logEvent(req.user.username, 'Asset Movement', `Asset ${asset.name} moved to ${target} (${status})`, 'admin');

        res.json(asset);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};
exports.getAllHistory = async (req, res) => {
    try {
        const history = await AssetHistory.find()
            .populate('asset_id', 'name serial_number')
            .populate('employee_id', 'name')
            .sort({ date: -1 })
            .limit(200);
        res.json(history);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

exports.returnAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const asset = await Asset.findByIdAndUpdate(
            id,
            { assigned_to: null, status: 'Available' },
            { new: true }
        );

        if (!asset) return res.status(404).json({ detail: 'Asset not found' });

        await AssetHistory.create({
            asset_id: id,
            asset_name: asset.name,
            employee_id: null,
            action: 'Returned',
            performed_by: req.user.username,
            notes: notes || 'Returned to Stock'
        });

        await logEvent(req.user.username, 'Asset Return', `Asset ${asset.name} returned to stock`, 'admin');
        res.json(asset);
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};

exports.deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await Asset.findById(id);
        if (!asset) return res.status(404).json({ detail: 'Asset not found' });

        // Create a deletion record in history
        await AssetHistory.create({
            asset_id: null, // Nullify ID for deleted items
            asset_name: asset.name,
            action: 'Deleted',
            performed_by: req.user.username,
            notes: `Permanently removed from inventory. SN: ${asset.serial_number || 'N/A'}`
        });

        // Optional: Update old history to have the name so it stays readable
        await AssetHistory.updateMany({ asset_id: id }, { asset_name: asset.name, asset_id: null });

        await Asset.findByIdAndDelete(req.params.id);
        await logEvent(req.user.username, 'Delete Asset', `Permanently deleted asset: ${asset.name}`, 'admin');
        res.json({ detail: 'Asset deleted' });
    } catch (error) {
        res.status(400).json({ detail: error.message });
    }
};
