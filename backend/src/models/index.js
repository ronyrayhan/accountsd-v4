const mongoose = require('mongoose');
const { DailySummary, MonthlySummary } = require('./Summary');

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    hashed_password: { type: String, required: true },
    role: { type: String, enum: ['Admin', 'Accountant', 'Viewer', 'HR', 'ESS'], default: 'Viewer' },
    is_active: { type: Boolean, default: true },
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HREmployee' } // Link to HR Profile
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.hashed_password;
            return ret;
        },
        virtuals: true
    }
});

const GlobalSettingSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    value: { type: String }
});

const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', CounterSchema);

const AccountSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true },
    name: { type: String, unique: true, required: true },
    type: { type: String, required: true },
    subtype: { type: String, required: true },
    opening_balance_bdt: { type: Number, default: 0 },
    current_balance_bdt: { type: Number, default: 0 },
    opening_balance_usd: { type: Number, default: 0 },
    current_balance_usd: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

// Transaction Schema: Stores every financial movement.
const TransactionSchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    description: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BDT' }, // 'BDT' or 'USD'
    type: { type: String, required: true }, // 'Debit' (Outgoing) or 'Credit' (Incoming)
    conversion_type: { type: String, default: 'None' }, // 'None', 'Manual', 'Auto'
    conversion_rate: { type: Number }, // Exchange rate used
    converted_amount_bdt: { type: Number }, // Equivalent BDT value if USD
    reference: { type: String },
    source_type: { type: String }, // 'Transfer', 'Exchange', 'Bill', etc.
    transfer_id: { type: String }, // Links two sides of a transfer
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    serial_number: { type: Number, unique: true }, // Simple integer ID (1, 2, 3...)
    trx_id: { type: String, unique: true } // Formatted ID (TRX001, TRX002...)
}, { timestamps: true });

/**
 * Pre-save Hook for Transactions:
 * Automatically generates a sequential 'serial_number' and a formatted 'trx_id'.
 * 
 * Logic:
 * 1. Checks if the transaction is new.
 * 2. Finds and increments the global 'transaction_serial' counter.
 * 3. Assigns the new number to 'serial_number'.
 * 4. Formats it as 'TRX001', 'TRX002', etc. for 'trx_id'.
 */
TransactionSchema.pre('save', async function () {
    if (this.isNew) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: 'transaction_serial' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this.serial_number = counter.seq;
        this.trx_id = `TRX${String(counter.seq).padStart(3, '0')}`;
    }
});

const AttachmentSchema = new mongoose.Schema({
    file_path: { type: String },
    filename: { type: String },
    transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    bill_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' }
});

const TransactionHistorySchema = new mongoose.Schema({
    transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    changed_at: { type: Date, default: Date.now },
    changed_by: { type: String },
    field_name: { type: String },
    old_value: { type: String },
    new_value: { type: String }
});

const AccountHistorySchema = new mongoose.Schema({
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    changed_at: { type: Date, default: Date.now },
    changed_by: { type: String },
    reason: { type: String },
    old_balance_bdt: { type: Number },
    new_balance_bdt: { type: Number },
    old_balance_usd: { type: Number },
    new_balance_usd: { type: Number }
});

const RolePermissionSchema = new mongoose.Schema({
    role: { type: String, enum: ['Admin', 'Accountant', 'Viewer', 'HR', 'ESS'], required: true },
    module: { type: String, required: true },
    can_access: { type: Boolean, default: false }
});
RolePermissionSchema.index({ role: 1, module: 1 }, { unique: true });

const AccountPermissionSchema = new mongoose.Schema({
    role: { type: String, enum: ['Admin', 'Accountant', 'Viewer', 'HR', 'ESS'], required: true },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    can_access: { type: Boolean, default: true }
});
AccountPermissionSchema.index({ role: 1, account_id: 1 }, { unique: true });

const IndividualModulePermissionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    module: { type: String, required: true },
    can_access: { type: Boolean, default: false }
});
IndividualModulePermissionSchema.index({ user_id: 1, module: 1 }, { unique: true });

const IndividualAccountPermissionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    can_access: { type: Boolean, default: true }
});
IndividualAccountPermissionSchema.index({ user_id: 1, account_id: 1 }, { unique: true });

const BillSchema = new mongoose.Schema({
    invoice_date: { type: Date, default: Date.now },
    due_date: { type: Date, required: true },
    description: { type: String, required: true },
    company_name: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BDT' },
    status: { type: String, enum: ['Unpaid', 'Paid', 'Partial'], default: 'Unpaid' }
}, { timestamps: true });

BillSchema.virtual('attachments', {
    ref: 'Attachment',
    localField: '_id',
    foreignField: 'bill_id'
});

TransactionSchema.virtual('attachments', {
    ref: 'Attachment',
    localField: '_id',
    foreignField: 'transaction_id'
});

const EmployeeSchema = new mongoose.Schema({
    emp_id: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    department: { type: String },
    designation: { type: String },
    joining_date: { type: Date, required: true },
    employment_type: { type: String, enum: ['Full-time', 'Contract', 'Intern'], default: 'Full-time' },
    base_salary: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'On Hold', 'Exit'], default: 'Active' },
    email: { type: String },
    phone: { type: String }
}, { timestamps: true });

EmployeeSchema.virtual('increments', {
    ref: 'Increment',
    localField: '_id',
    foreignField: 'employee_id'
});

const AttendanceSchema = new mongoose.Schema({
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    check_in: { type: String }, // HH:mm
    check_out: { type: String },
    status: { type: String, enum: ['Present', 'Late', 'Absent', 'Half-Day'], default: 'Present' },
    remarks: { type: String }
}, { timestamps: true });
AttendanceSchema.index({ employee_id: 1, date: 1 }, { unique: true });

const LeaveSchema = new mongoose.Schema({
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    leave_type: { type: String, enum: ['Casual', 'Sick', 'Annual', 'Unpaid'], required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    total_days: { type: Number },
    reason: { type: String },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approved_by: { type: String }
}, { timestamps: true });

const AssetSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, default: 'Electronics' },
    serial_number: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ['Available', 'In Use', 'Repair', 'Retired'], default: 'Available' },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    purchase_date: { type: Date },
    purchase_value: { type: Number },
    purchased_from: { type: String },
    invoice_image: { type: String }, // Path to uploaded file
    specs: { type: String },
    room_number: { type: String }, // For office location tracking
    is_fixed: { type: Boolean, default: false } // true for room-fixed, false for employee-carry
}, { timestamps: true });

AssetSchema.virtual('history', {
    ref: 'AssetHistory',
    localField: '_id',
    foreignField: 'asset_id'
});

const AssetCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String }
}, { timestamps: true });

const AssetHistorySchema = new mongoose.Schema({
    asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }, // null if asset is deleted
    asset_name: { type: String }, // Store name for when asset is deleted
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // null if unassigned
    action: { type: String, enum: ['Assigned', 'Unassigned', 'Retired', 'Returned', 'Transferred', 'Modified', 'Deleted', 'Relocated'], required: true },
    performed_by: { type: String },
    date: { type: Date, default: Date.now },
    notes: { type: String }
}, { timestamps: true });

const IncrementSchema = new mongoose.Schema({
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    amount: { type: Number, required: true },
    effective_date: { type: Date, required: true },
    reason: { type: String }
}, { timestamps: true });

const PayrollRecordSchema = new mongoose.Schema({
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true }, // YYYY-MM
    paid_days: { type: Number, default: 30 },
    working_days: { type: Number, default: 30 },
    base_salary_snapshot: { type: Number },
    total_increments_snapshot: { type: Number },
    transport_allowance: { type: Number, default: 0 },
    other_allowance: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    advance_salary: { type: Number, default: 0 },
    gross_salary: { type: Number },
    net_salary: { type: Number },
    is_locked: { type: Boolean, default: false }
}, { timestamps: true });

const SystemLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    user: { type: String, required: true },
    action: { type: String, required: true },
    detail: { type: String },
    type: { type: String, enum: ['entry', 'edit', 'delete', 'auth', 'admin', 'setting'], default: 'entry' }
});

const ActiveSessionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    ip_address: { type: String },
    user_agent: { type: String },
    login_time: { type: Date, default: Date.now },
    last_activity: { type: Date, default: Date.now },
    token_signature: { type: String } // Optional: Store part of the JWT or a session ID to validate specific tokens
}, { timestamps: true });

// Global Options for all schemas to include id virtual
const schemaOptions = {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true
};

// Add virtuals and set options for each schema
[UserSchema, GlobalSettingSchema, AccountSchema, TransactionSchema, AttachmentSchema,
    TransactionHistorySchema, AccountHistorySchema, RolePermissionSchema, AccountPermissionSchema,
    IndividualModulePermissionSchema, IndividualAccountPermissionSchema,
    BillSchema, EmployeeSchema, SystemLogSchema, CounterSchema,
    AttendanceSchema, LeaveSchema, AssetSchema, ActiveSessionSchema, IncrementSchema, PayrollRecordSchema].forEach(schema => {
        schema.virtual('id').get(function () {
            return this._id.toHexString();
        });
        schema.set('toJSON', schemaOptions.toJSON);
        schema.set('toObject', schemaOptions.toObject);
    });

const User = mongoose.model('User', UserSchema);
const GlobalSetting = mongoose.model('GlobalSetting', GlobalSettingSchema);
const Account = mongoose.model('Account', AccountSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Attachment = mongoose.model('Attachment', AttachmentSchema);
const TransactionHistory = mongoose.model('TransactionHistory', TransactionHistorySchema);
const AccountHistory = mongoose.model('AccountHistory', AccountHistorySchema);
const RolePermission = mongoose.model('RolePermission', RolePermissionSchema);
const AccountPermission = mongoose.model('AccountPermission', AccountPermissionSchema);
const IndividualModulePermission = mongoose.model('IndividualModulePermission', IndividualModulePermissionSchema);
const IndividualAccountPermission = mongoose.model('IndividualAccountPermission', IndividualAccountPermissionSchema);
const Bill = mongoose.model('Bill', BillSchema);
const Employee = mongoose.model('Employee', EmployeeSchema);
const Increment = mongoose.model('Increment', IncrementSchema);
const PayrollRecord = mongoose.model('PayrollRecord', PayrollRecordSchema);
const SystemLog = mongoose.model('SystemLog', SystemLogSchema);
const ActiveSession = mongoose.model('ActiveSession', ActiveSessionSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);
const Leave = mongoose.model('Leave', LeaveSchema);
const Asset = mongoose.model('Asset', AssetSchema);
const AssetCategory = mongoose.model('AssetCategory', AssetCategorySchema);
const AssetHistory = mongoose.model('AssetHistory', AssetHistorySchema);

module.exports = {
    User,
    GlobalSetting,
    Account,
    Transaction,
    Attachment,
    TransactionHistory,
    AccountHistory,
    RolePermission,
    AccountPermission,
    IndividualModulePermission,
    IndividualAccountPermission,
    Bill,
    Employee,
    Increment,
    PayrollRecord,
    SystemLog,
    Counter,
    DailySummary,
    MonthlySummary,
    Attendance,
    Leave,
    Asset,
    AssetCategory,
    AssetHistory,
    ActiveSession
};
