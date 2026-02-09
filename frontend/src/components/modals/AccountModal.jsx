import React, { useState } from 'react';
import api from '../../api/axios';

export const AccountModal = ({ onAccountCreated }) => {
    const [formData, setFormData] = useState({
        code: '', name: '', type: 'Asset', subtype: 'Bank',
        opening_balance_bdt: 0, opening_balance_usd: 0
    });
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setError(null);
            await api.post('/accounts', formData);
            onAccountCreated();
            setFormData({
                code: '', name: '', type: 'Asset', subtype: 'Bank',
                opening_balance_bdt: 0, opening_balance_usd: 0
            });
            document.querySelector('#accountModal .btn-close')?.click();
        } catch (err) {
            setError(err.response?.data?.detail || err.response?.data?.errors?.[0]?.msg || 'Error creating account');
        }
    };

    return (
        <div className="modal fade" id="accountModal" tabIndex="-1">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">New Account</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" onClick={() => setError(null)}></button>
                    </div>
                    <div className="modal-body">
                        {error && (
                            <div className="alert alert-danger py-2 px-3 border-0 small fw-bold mb-3 d-flex align-items-center gap-2 text-wrap" style={{ wordBreak: 'break-word' }}>
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="form-label">Code</label>
                                <input type="text" className="form-control" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} required placeholder="1001" />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Name</label>
                                <input type="text" className="form-control" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Bank Account A" />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Type</label>
                                <select className="form-select" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                    <option value="Asset">Asset</option>
                                    <option value="Liability">Liability</option>
                                    <option value="Equity">Equity</option>
                                    <option value="Income">Income</option>
                                    <option value="Expense">Expense</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Subtype</label>
                                <select className="form-select" value={formData.subtype} onChange={e => setFormData({ ...formData, subtype: e.target.value })}>
                                    <option value="Bank">Bank</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Credit Card">Credit Card</option>
                                    <option value="Revenue">Revenue</option>
                                    <option value="Operating Expense">Operating Expense</option>
                                    <option value="Capital">Capital</option>
                                </select>
                            </div>
                            <div className="row">
                                <div className="col-6">
                                    <label className="form-label">Opening BDT</label>
                                    <input type="number" step="0.01" className="form-control" value={formData.opening_balance_bdt} onChange={e => setFormData({ ...formData, opening_balance_bdt: e.target.value })} />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Opening USD</label>
                                    <input type="number" step="0.01" className="form-control" value={formData.opening_balance_usd} onChange={e => setFormData({ ...formData, opening_balance_usd: e.target.value })} />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary w-100 mt-3">Create Account</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
