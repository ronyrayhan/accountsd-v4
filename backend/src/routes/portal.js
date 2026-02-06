const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');
const { authenticate, checkOnboarding } = require('../middleware/auth');
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
router.get('/dashboard', authenticate, checkOnboarding, portalController.getDashboard);
router.post('/punch', authenticate, checkOnboarding, portalController.punch);

// Leaves
router.get('/leaves', authenticate, checkOnboarding, portalController.getLeaves);
router.get('/balances', authenticate, checkOnboarding, portalController.getBalances);
router.post('/apply', authenticate, checkOnboarding, upload.array('attachments', 5), portalController.applyLeave);
router.get('/leave-types', authenticate, checkOnboarding, portalController.getLeaveTypes);

// Profile
router.get('/profile', authenticate, checkOnboarding, portalController.getProfile);

// Onboarding
router.get('/onboarding/status', authenticate, portalController.getOnboardingData);
router.post('/onboarding/update', authenticate, portalController.updateProgress);
router.post('/onboarding/upload', authenticate, upload.single('file'), portalController.uploadOnboardingDocument);
router.post('/onboarding/submit-form', authenticate, upload.any(), portalController.submitDynamicForm);

// Manager Routes (Approver Center)
router.get('/manager/subordinates', authenticate, portalController.getManageableSubordinates);
router.get('/manager/subordinate-balance/:id', authenticate, portalController.getSubordinateBalance);
router.get('/manager/leaves', authenticate, portalController.getSubordinateLeaves);
router.post('/manager/authorize', authenticate, portalController.authorizeLeave);
router.post('/manager/apply-for', authenticate, portalController.applyForSubordinate);

module.exports = router;
