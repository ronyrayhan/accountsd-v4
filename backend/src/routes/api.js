const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Controllers
const accountController = require('../controllers/accountController');
const transactionController = require('../controllers/transactionController');
const authController = require('../controllers/authController');
const reportController = require('../controllers/reportController');
const settingController = require('../controllers/settingController');
const summaryController = require('../controllers/summaryController');
const onboardingController = require('../controllers/onboardingController');

// Multer config for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Please Select correct file type'));
        }
    }
});

const uploadExcel = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/xml',
            'text/csv',
            'application/octet-stream'
        ];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedMimes.includes(file.mimetype) || ['.xlsx', '.xls', '.csv'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Please select an Excel file (.xlsx or .xls)'));
        }
    }
});

// AUTH
router.post('/login', [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
], authController.login);
router.post('/refresh-token', authController.refreshAccessToken);
router.get('/auth/me', authenticate, authController.getMe);

// ACCOUNTS
router.get('/accounts', authenticate, accountController.getAccounts);
router.post('/accounts', authenticate, authorize('Accounting'), accountController.createAccount);
router.put('/accounts/:id', authenticate, authorize('Admin'), accountController.updateAccount);
router.delete('/accounts/:id', authenticate, authorize('Admin'), accountController.deleteAccount);
router.post('/accounts/:id/balance', authenticate, authorize('Admin'), accountController.updateBalance);
router.post('/accounts/recalculate', authenticate, authorize('Accounting'), accountController.recalculateBalances);
router.get('/accounts/:id/history', authenticate, authorize(['Accounting', 'Admin']), accountController.getAccountHistory);

// TRANSACTIONS
router.get('/transactions', authenticate, authorize('Ledger'), transactionController.getTransactions);
router.post('/transactions', authenticate, authorize('Accounting'), upload.single('file'), [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('account_id').isMongoId().withMessage('Invalid Account ID'),
    body('type').isIn(['Debit', 'Credit', 'Transfer']).withMessage('Invalid transaction type'),
    body('currency').isIn(['BDT', 'USD']).withMessage('Invalid currency'),
    body('date').optional().isISO8601().withMessage('Invalid date format'),
    validate
], transactionController.createTransaction);
router.put('/transactions/:id', authenticate, authorize('Accounting'), transactionController.updateTransaction);
router.delete('/transactions/:id', authenticate, authorize('Admin'), transactionController.deleteTransaction);
router.get('/transactions/:id/history', authenticate, authorize(['Accounting', 'Ledger', 'Admin']), transactionController.getTransactionHistory);
router.get('/transactions/template', authenticate, transactionController.downloadTemplate);
router.get('/transactions/export', authenticate, authorize('Ledger'), transactionController.exportLedger);
router.post('/transactions/preview', authenticate, authorize('Accounting'), uploadExcel.single('file'), transactionController.previewTransactions);
router.get('/transactions/account/:id', authenticate, authorize('Statements'), transactionController.getAccountStatement);
router.get('/transactions/account/:id/download', authenticate, authorize('Statements'), transactionController.downloadAccountStatement);
router.post('/transactions/import', authenticate, authorize('Accounting'), uploadExcel.single('file'), transactionController.importTransactions);

// SETTINGS
router.get('/settings', authenticate, authorize('Settings'), settingController.getAllSettings);
router.get('/settings/:key', authenticate, authorize(['Settings', 'Admin']), settingController.getSetting);
router.post('/settings', authenticate, authorize('Admin'), settingController.setSetting);

// REPORTS & STATS
router.get('/reports/trial-balance', authenticate, authorize('Reports'), reportController.getTrialBalance);
router.get('/reports/custom', authenticate, authorize('Reports'), reportController.getCustomSummary);
router.get('/reports/prediction', authenticate, authorize('Reports'), reportController.getPrediction);
router.get('/reports/capex-opex', authenticate, authorize(['Reports', 'Dashboard', 'Admin']), reportController.getCapexOpexStats);
router.get('/reports/capex-opex/export', authenticate, authorize(['Reports', 'Dashboard', 'Admin']), reportController.exportCapexOpex);
router.get('/stats/accounts', authenticate, authorize(['Dashboard', 'Reports', 'Admin']), reportController.getStats);
router.get('/logs', authenticate, authorize('Admin'), reportController.getSystemLogs);

// ADMIN & USER MGMT
router.get('/admin/users', authenticate, authorize(['Admin', 'Users']), authController.listUsers);
router.get('/admin/users/employee/:employee_id', authenticate, authorize(['Admin', 'HR']), authController.getUserByEmployeeId);
router.post('/admin/users', authenticate, authorize(['Admin', 'HR']), [
    body('username').trim().notEmpty().withMessage('Username is required').isLength({ min: 3 }),
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter'),
    body('role').isIn(['Admin', 'HR', 'Accountant', 'Viewer', 'Payroll', 'Billing', 'Users', 'ESS']).withMessage('Invalid role'),
    validate
], authController.createUser);
router.post('/admin/users/:id/status', authenticate, authorize('Admin'), authController.toggleUserStatus);
router.get('/admin/sessions', authenticate, authorize('Admin'), authController.getActiveSessions);
router.delete('/admin/sessions/:id', authenticate, authorize('Admin'), authController.terminateSession);

// PERMISSIONS
router.get('/admin/permissions', authenticate, authorize('Admin'), authController.getPermissions);
router.post('/admin/permissions', authenticate, authorize('Admin'), authController.updatePermissions);

// ACCOUNT PERMISSIONS
router.get('/admin/account-permissions', authenticate, authorize('Admin'), authController.getAccountPermissions);
router.post('/admin/account-permissions', authenticate, authorize('Admin'), authController.updateAccountPermissions);

// INDIVIDUAL PERMISSIONS
router.get('/admin/individual-permissions', authenticate, authorize('Admin'), authController.getIndividualPermissions);
router.post('/admin/individual-permissions', authenticate, authorize('Admin'), authController.updateIndividualPermission);

// BILLING (ADDON)
const billingController = require('../controllers/billingController');
router.get('/bills', authenticate, authorize('Billing'), billingController.getBills);
router.post('/bills', authenticate, authorize('Billing'), upload.single('file'), billingController.createBill);
router.patch('/bills/:id/status', authenticate, authorize('Billing'), billingController.updateBillStatus);
router.post('/bills/:id/pay', authenticate, authorize('Billing'), billingController.payBill);
router.delete('/bills/:id', authenticate, authorize('Billing'), billingController.deleteBill);

// PAYROLL (ADDON)
const payrollController = require('../controllers/payrollController');
router.get('/payroll/employees', authenticate, authorize('Payroll'), payrollController.getEmployees);
router.post('/payroll/employees', authenticate, authorize('Payroll'), payrollController.createEmployee);
router.put('/payroll/employees/:id', authenticate, authorize('Payroll'), payrollController.updateEmployee);

router.get('/payroll/increments', authenticate, authorize('Payroll'), payrollController.getIncrements);
router.post('/payroll/increments', authenticate, authorize('Payroll'), payrollController.createIncrement);
router.put('/payroll/increments/:id', authenticate, authorize('Payroll'), payrollController.updateIncrement);
router.delete('/payroll/increments/:id', authenticate, authorize('Payroll'), payrollController.deleteIncrement);

router.get('/payroll/calculate', authenticate, authorize('Payroll'), payrollController.calculateSalary);
router.get('/payroll/records', authenticate, authorize('Payroll'), payrollController.getPayrollRecords);
router.post('/payroll/records', authenticate, authorize('Payroll'), payrollController.savePayrollRecord);
router.put('/payroll/records/:id', authenticate, authorize('Payroll'), payrollController.updatePayrollRecord);
router.delete('/payroll/records/:id', authenticate, authorize('Payroll'), payrollController.deletePayrollRecord);

// ASSET TRACKING
const assetController = require('../controllers/assetController');
router.get('/assets', authenticate, authorize('Admin'), assetController.getAssets);
router.get('/assets/history', authenticate, authorize('Admin'), assetController.getAllHistory);
router.get('/assets/categories', authenticate, authorize('Admin'), assetController.getCategories);
router.post('/assets/categories', authenticate, authorize('Admin'), assetController.createCategory);
router.delete('/assets/categories/:id', authenticate, authorize('Admin'), assetController.deleteCategory);
router.post('/assets', authenticate, authorize('Admin'), upload.single('invoice'), assetController.createAsset);
router.put('/assets/:id', authenticate, authorize('Admin'), upload.single('invoice'), assetController.updateAsset);
router.post('/assets/:id/assign', authenticate, authorize('Admin'), assetController.assignAsset);
router.post('/assets/:id/return', authenticate, authorize('Admin'), assetController.returnAsset);
router.delete('/assets/:id', authenticate, authorize('Admin'), assetController.deleteAsset);

// HR MANAGEMENT - New comprehensive HR module
const hrController = require('../controllers/hrController');
const masterController = require('../controllers/masterController');
const { authenticateDevice } = require('../middleware/deviceAuth');

// Master Data
router.get('/hr/departments', authenticate, masterController.getDepartments);
router.post('/hr/departments', authenticate, authorize(['HR', 'Admin']), masterController.createDepartment);

router.get('/hr/designations', authenticate, masterController.getDesignations);
router.post('/hr/designations', authenticate, authorize(['HR', 'Admin']), masterController.createDesignation);

router.get('/hr/positions', authenticate, masterController.getPositions);
router.post('/hr/positions', authenticate, authorize(['HR', 'Admin']), masterController.createPosition);

// Expense Categories
router.get('/expense-categories', authenticate, masterController.getExpenseCategories);
router.post('/expense-categories', authenticate, authorize(['Accounting', 'Admin']), masterController.createExpenseCategory);
router.delete('/expense-categories/:id', authenticate, authorize(['Accounting', 'Admin']), masterController.deleteExpenseCategory);

// RFID Attendance
router.post('/hr/attendance/rfid-punch', authenticateDevice, hrController.rfidPunch);

// Global Leave Settings (Leave Types)
// MUST BE ABOVE /hr/employees/:id TO AVOID MASKING
const leaveController = require('../controllers/leaveController');
const shiftController = require('../controllers/shiftController'); // NEW

router.get('/hr/leave-types', authenticate, leaveController.getLeaveTypes);
router.post('/hr/leave-types', authenticate, authorize(['HR', 'Admin']), leaveController.saveLeaveType);

// Shift Management
router.get('/hr/shifts', authenticate, authorize(['HR', 'Admin']), shiftController.getShifts);
router.post('/hr/shifts', authenticate, authorize(['HR', 'Admin']), shiftController.saveShift);
router.delete('/hr/shifts/:id', authenticate, authorize(['HR', 'Admin']), shiftController.deleteShift);

// Employee Management
router.get('/hr/employees', authenticate, authorize(['HR', 'Admin']), hrController.getEmployees);
router.get('/hr/employees/:id', authenticate, authorize(['HR', 'Admin']), hrController.getEmployee);
router.post('/hr/employees', authenticate, authorize(['HR', 'Admin']), hrController.createEmployee);
router.put('/hr/employees/:id', authenticate, authorize(['HR', 'Admin']), hrController.updateEmployee);

// Career History
router.get('/hr/employees/:id/history', authenticate, authorize(['HR', 'Admin']), hrController.getCareerHistory);
router.post('/hr/career-change', authenticate, authorize(['HR', 'Admin']), hrController.recordCareerChange);

// Attendance Management
router.get('/hr/attendance', authenticate, authorize(['HR', 'Admin']), hrController.getAttendance);
router.post('/hr/attendance/override', authenticate, authorize(['HR', 'Admin']), hrController.overrideAttendance);

// Leave Requests
const attendanceController = require('../controllers/attendanceController');

router.get('/hr/leaves/all-balances', authenticate, authorize(['HR', 'Admin']), leaveController.getAllBalances);
router.post('/hr/leaves/resync-all', authenticate, authorize(['HR', 'Admin']), leaveController.resyncAllBalances);
router.get('/hr/leaves/me/:employee_id', authenticate, leaveController.getMyLeaves);
router.get('/hr/leaves/balances/:employee_id', authenticate, leaveController.getMyBalances);
router.post('/hr/leaves/allocate', authenticate, authorize(['HR', 'Admin']), leaveController.allocateLeaves); // NEW
router.post('/hr/leaves/apply', authenticate, upload.array('attachments'), leaveController.applyForLeave);
router.post('/hr/leaves/:id/process', authenticate, authorize(['HR', 'Admin', 'Manager']), leaveController.processLeave);

// Legacy/Admin View (Can reuse hrController.getLeaves for now or migrate later)
router.get('/hr/leaves', authenticate, authorize(['HR', 'Admin']), hrController.getLeaves);

// HR Dashboard
router.get('/hr/dashboard/stats', authenticate, authorize(['HR', 'Admin', 'Dashboard']), hrController.getDashboardStats);

// ONBOARDING (HR/Admin)
router.get('/onboarding/content', authenticate, onboardingController.getContent);
router.post('/onboarding/content', authenticate, authorize(['HR', 'Admin']), upload.any(), onboardingController.createContent);
router.put('/onboarding/content/:id', authenticate, authorize(['HR', 'Admin']), upload.any(), onboardingController.updateContent);
router.delete('/onboarding/content/:id', authenticate, authorize(['HR', 'Admin']), onboardingController.deleteContent);
router.get('/onboarding/progress', authenticate, authorize(['HR', 'Admin']), onboardingController.getAllProgress);
router.get('/onboarding/progress/:id', authenticate, authorize(['HR', 'Admin']), onboardingController.getEmployeeOnboarding);
router.post('/onboarding/reset/:employee_id', authenticate, authorize(['HR', 'Admin']), onboardingController.resetEmployeeOnboarding);

// SUMMARIES (ADDON)
router.get('/summaries/daily', authenticate, authorize(['Summaries', 'Admin']), summaryController.getDailySummaries);
router.get('/summaries/monthly', authenticate, authorize(['Summaries', 'Admin']), summaryController.getMonthlySummaries);
router.get('/summaries/export', authenticate, authorize(['Summaries', 'Admin']), summaryController.exportSummaries);
router.post('/summaries/sync', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const { accountId, date } = req.body;
        await summaryController.syncSummaries(accountId, date || new Date());
        res.json({ message: 'Sync successful' });
    } catch (err) {
        require('../utils/logger').logger.error('Sync Error', { err: err.message });
        res.status(500).json({ detail: 'Error during summary synchronization' });
    }
});

// SECURE FILE SERVING
router.get('/files/:filename', authenticate, (req, res) => {
    const filename = path.basename(req.params.filename); // Prevent Directory Traversal
    const uploadDir = path.join(__dirname, '../../uploads');
    const safePath = path.join(uploadDir, filename);

    // Ensure the resolved path is actually inside the uploads directory
    if (!safePath.startsWith(uploadDir)) {
        return res.status(403).json({ detail: 'Access denied' });
    }

    // Check if file exists
    if (fs.existsSync(safePath)) {
        res.sendFile(safePath);
    } else {
        res.status(404).json({ detail: 'File not found' });
    }
});

module.exports = router;
