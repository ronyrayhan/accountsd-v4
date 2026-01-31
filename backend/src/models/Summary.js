const mongoose = require('mongoose');

const DailySummarySchema = new mongoose.Schema({
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    opening_bdt: { type: Number, default: 0 },
    credit_bdt: { type: Number, default: 0 },
    debit_bdt: { type: Number, default: 0 },
    closing_bdt: { type: Number, default: 0 },
    opening_usd: { type: Number, default: 0 },
    credit_usd: { type: Number, default: 0 },
    debit_usd: { type: Number, default: 0 },
    closing_usd: { type: Number, default: 0 }
}, { timestamps: true });

DailySummarySchema.index({ account_id: 1, date: 1 }, { unique: true });

const MonthlySummarySchema = new mongoose.Schema({
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    month: { type: String, required: true }, // YYYY-MM
    opening_bdt: { type: Number, default: 0 },
    credit_bdt: { type: Number, default: 0 },
    debit_bdt: { type: Number, default: 0 },
    closing_bdt: { type: Number, default: 0 },
    opening_usd: { type: Number, default: 0 },
    credit_usd: { type: Number, default: 0 },
    debit_usd: { type: Number, default: 0 },
    closing_usd: { type: Number, default: 0 }
}, { timestamps: true });

MonthlySummarySchema.index({ account_id: 1, month: 1 }, { unique: true });

// Add id virtuals helper (consistent with index.js)
[DailySummarySchema, MonthlySummarySchema].forEach(schema => {
    schema.virtual('id').get(function () {
        return this._id.toHexString();
    });
    schema.set('toJSON', { virtuals: true });
    schema.set('toObject', { virtuals: true });
});

const DailySummary = mongoose.model('DailySummary', DailySummarySchema);
const MonthlySummary = mongoose.model('MonthlySummary', MonthlySummarySchema);

module.exports = {
    DailySummary,
    MonthlySummary
};
