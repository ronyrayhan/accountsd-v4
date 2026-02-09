const mongoose = require('mongoose');

/**
 * Enhanced Employee Schema
 * Comprehensive employee profile with personal info, employment details, and compensation
 */
const EmployeeSchema = new mongoose.Schema({
    employee_id: {
        type: String,
        unique: true,
        required: true
    }, // Auto-generated: EMP001, EMP002, etc.

    rfid_card_number: {
        type: String,
        unique: true,
        sparse: true
    }, // For RFID attendance

    // Personal Information
    personal_info: {
        full_name: { type: String, required: true },

        date_of_birth: { type: Date },
        gender: { type: String, enum: ['Male', 'Female', 'Other'] },
        blood_group: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
        phone: { type: String },
        email: { type: String },
        emergency_contact: { type: String },
        present_address: { type: String },
        permanent_address: { type: String },
        national_id: { type: String },
        photo_url: { type: String }
    },

    // Employment Information
    employment_info: {
        joining_date: { type: Date, required: true },
        joining_position: { type: String, required: true },
        current_designation: { type: String, required: true },
        current_department: { type: String, required: true },
        employment_type: {
            type: String,
            enum: ['Permanent', 'Contract', 'Intern', 'Part-Time', 'Full-time', 'Part-time'],
            default: 'Permanent'
        },
        work_location: { type: String },
        reporting_manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HREmployee' },
        shift_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
        probation_end_date: { type: Date },
        status: {
            type: String,
            enum: ['Active', 'Probation', 'Resigned', 'Terminated', 'On Leave'],
            default: 'Active'
        }
    },

    // Compensation
    compensation: {
        current_salary: { type: Number, default: 0 },
        salary_structure: {
            basic: { type: Number, default: 0 },
            house_rent: { type: Number, default: 0 },
            medical: { type: Number, default: 0 },
            transport: { type: Number, default: 0 },
            other_allowances: { type: Number, default: 0 }
        },
        bank_account: { type: String },
        bank_name: { type: String },
        branch: { type: String }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for backward compatibility (Payroll/Asset modules expect .name)
EmployeeSchema.virtual('name').get(function () {
    return this.personal_info?.full_name;
});


// Virtual: Calculate tenure in years
EmployeeSchema.virtual('tenure_years').get(function () {
    if (!this.employment_info.joining_date) return 0;
    const now = new Date();
    const joining = new Date(this.employment_info.joining_date);
    return ((now - joining) / (1000 * 60 * 60 * 24 * 365)).toFixed(2);
});

// Virtual: Calculate years in current position
EmployeeSchema.virtual('years_in_position').get(function () {
    // This would need to check CareerHistory for last promotion
    return 0; // Placeholder
});

/**
 * Career History Schema
 * Tracks all promotions, transfers, and salary increments
 */
const CareerHistorySchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HREmployee',
        required: true
    },
    change_type: {
        type: String,
        enum: ['Promotion', 'Transfer', 'Increment', 'Demotion', 'Designation Change'],
        required: true
    },
    effective_date: { type: Date, required: true },

    previous_values: {
        designation: { type: String },
        department: { type: String },
        salary: { type: Number }
    },

    new_values: {
        designation: { type: String },
        department: { type: String },
        salary: { type: Number }
    },

    increment_percentage: { type: Number }, // For salary increments
    reason: { type: String },
    approved_by: { type: String },
    notes: { type: String }
}, { timestamps: true });

/**
 * Attendance Punch Schema
 * Individual punch records from RFID system
 */
const AttendancePunchSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HREmployee',
        required: true
    },
    rfid_card_number: { type: String, required: true },
    punch_type: {
        type: String,
        enum: ['IN', 'OUT'],
        required: true
    },
    timestamp: { type: Date, required: true, default: Date.now },
    device_id: { type: String }, // ESP32_001, ESP32_002, etc.
    location: { type: String },
    is_late: { type: Boolean, default: false },
    is_early_departure: { type: Boolean, default: false },
    notes: { type: String }
}, { timestamps: true });

// Index for fast queries
AttendancePunchSchema.index({ employee_id: 1, timestamp: -1 });
AttendancePunchSchema.index({ rfid_card_number: 1, timestamp: -1 });

/**
 * Attendance Summary Schema
 * Daily attendance summary calculated from punches
 */
const AttendanceSummarySchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HREmployee',
        required: true
    },
    date: { type: Date, required: true },
    punch_in: { type: Date },
    punch_out: { type: Date },
    total_hours: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Late', 'Half-Day', 'On-Leave', 'Holiday'],
        default: 'Absent'
    },
    overtime_hours: { type: Number, default: 0 },
    early_entry: { type: Number, default: 0 },  // Minutes arrived before shift start
    late_entry: { type: Number, default: 0 },   // Minutes arrived after shift start (beyond grace)
    early_exit: { type: Number, default: 0 },   // Minutes left before shift end
    late_exit: { type: Number, default: 0 },    // Minutes stayed after shift end
    segments: [{
        punch_in: { type: Date },
        punch_out: { type: Date },
        duration: { type: Number, default: 0 } // Duration in hours for this segment
    }],
    remarks: { type: String }
}, { timestamps: true });

// Unique constraint: one summary per employee per day
AttendanceSummarySchema.index({ employee_id: 1, date: 1 }, { unique: true });

/**
 * Leave Type Schema
 * Dynamic configuration for different leave types (e.g., Sick, Casual, WFH)
 */
const LeaveTypeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Sick Leave, Casual Leave
    code: { type: String, required: true, unique: true, uppercase: true }, // SL, CL
    description: { type: String },
    color: { type: String, default: '#3b82f6' }, // For UI badging

    // Quota & Rules
    default_days: { type: Number, required: true, default: 0 }, // Annual quota
    is_carry_forward: { type: Boolean, default: false },
    max_carry_forward_days: { type: Number, default: 0 },
    requires_document: { type: Boolean, default: false }, // If true, file upload is mandatory
    document_threshold_days: { type: Number, default: 0 }, // Require doc if duration > X days

    // Eligibility
    gender_eligibility: {
        type: String,
        enum: ['All', 'Male', 'Female', 'Other'],
        default: 'All'
    },
    is_unpaid: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

/**
 * Leave Request Schema
 * Enhanced leave management with dynamic types, documents, and audit trails
 */
const LeaveRequestSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HREmployee',
        required: true
    },
    leave_type: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LeaveType',
        required: true
    },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    total_days: { type: Number, required: true },
    reason: { type: String },

    // Attachments (Medical certs, etc.)
    attachments: [{
        original_name: { type: String },
        filename: { type: String }, // Stored filename
        path: { type: String },
        upload_date: { type: Date, default: Date.now }
    }],

    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending'
    },

    // Workflow & Audit
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'HREmployee' },
    approved_at: { type: Date },
    rejection_reason: { type: String },
    cancelled_at: { type: Date },
    cancelled_by: { type: mongoose.Schema.Types.ObjectId, ref: 'HREmployee' },

    workflow_logs: [{
        action: { type: String, enum: ['Applied', 'Approved', 'Rejected', 'Cancelled', 'Comment'] },
        performed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'HREmployee' }, // or 'Admin'
        performed_by_name: { type: String }, // Snapshot of name
        timestamp: { type: Date, default: Date.now },
        comment: { type: String }
    }]
}, { timestamps: true });

/**
 * Leave Balance Schema
 * Dynamic balance tracking based on valid LeaveTypes
 */
const LeaveBalanceSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HREmployee',
        required: true
    },
    year: { type: Number, required: true },

    // Balances array is more flexible than hardcoded fields
    balances: [{
        leave_type: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
        total: { type: Number, default: 0 }, // Assigned quota (default + manual adjustments)
        used: { type: Number, default: 0 },
        pending: { type: Number, default: 0 }, // Applied but not approved yet
        reserved: { type: Number, default: 0 } // Carry forwarded
    }]
}, { timestamps: true });

// Unique constraint: one balance record per employee per year
LeaveBalanceSchema.index({ employee_id: 1, year: 1 }, { unique: true });

/**
 * Exit Record Schema
 * Tracks employee resignations and exit process
 */
const ExitRecordSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HREmployee',
        required: true
    },
    resignation_date: { type: Date, required: true },
    last_working_day: { type: Date, required: true },
    notice_period_days: { type: Number },
    exit_type: {
        type: String,
        enum: ['Resignation', 'Termination', 'Retirement', 'Contract End'],
        required: true
    },
    exit_interview_notes: { type: String },
    clearance_status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Completed'],
        default: 'Pending'
    },
    final_settlement_amount: { type: Number },
    final_settlement_date: { type: Date },
    rehire_eligible: { type: Boolean, default: true },
    exit_reason: { type: String }
}, { timestamps: true });

/**
 * Shift Schema
 * Defines working hours for employees
 */
const ShiftSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    start_time: { type: String, required: true }, // HH:mm format
    end_time: { type: String, required: true },
    grace_period_minutes: { type: Number, default: 15 },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

// Create models
const HREmployee = mongoose.model('HREmployee', EmployeeSchema);
const CareerHistory = mongoose.model('CareerHistory', CareerHistorySchema);
const AttendancePunch = mongoose.model('AttendancePunch', AttendancePunchSchema);
const AttendanceSummary = mongoose.model('AttendanceSummary', AttendanceSummarySchema);
const LeaveType = mongoose.model('LeaveType', LeaveTypeSchema);
const LeaveRequest = mongoose.model('LeaveRequest', LeaveRequestSchema);
const LeaveBalance = mongoose.model('LeaveBalance', LeaveBalanceSchema);
const ExitRecord = mongoose.model('ExitRecord', ExitRecordSchema);
const Shift = mongoose.model('Shift', ShiftSchema);

/**
 * Master Config Models
 */
const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    id_prefix: { type: String, required: true, uppercase: true }
}, { timestamps: true });

const DesignationSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}, { timestamps: true });

const PositionSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}, { timestamps: true });

const Department = mongoose.model('Department', DepartmentSchema);
const Designation = mongoose.model('Designation', DesignationSchema);
const Position = mongoose.model('Position', PositionSchema);

module.exports = {
    HREmployee,
    CareerHistory,
    AttendancePunch,
    AttendanceSummary,
    LeaveType,
    LeaveRequest,
    LeaveBalance,
    ExitRecord,
    Shift,
    Department,
    Designation,
    Position
};
