const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

// Public
router.post('/login', portalController.login);

// Protected
router.get('/dashboard', authenticate, portalController.getDashboard);
router.post('/punch', authenticate, portalController.punch);

// Leaves
router.get('/leaves', authenticate, portalController.getLeaves);
router.get('/balances', authenticate, portalController.getBalances);
router.post('/apply', authenticate, upload.array('attachments', 5), portalController.applyLeave);
router.get('/leave-types', authenticate, portalController.getLeaveTypes);

module.exports = router;
