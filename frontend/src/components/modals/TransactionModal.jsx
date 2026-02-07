import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

export const TransactionModal = ({ accounts, onTransactionCreated }) => {
    const [formData, setFormData] = useState({
        description: '', amount: '', currency: 'BDT', type: 'Debit',
        account_id: '', conversion_type: 'None', conversion_rate: '',
        reference: '', date: '', transfer_target_id: ''
    });
    const [file, setFile] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (accounts.length > 0 && !formData.account_id) {
            setFormData(prev => ({ ...prev, account_id: accounts[0].id }));
        }
    }, [accounts]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = new FormData();
        Object.keys(formData).forEach(key => {
            if (formData[key] !== '') data.append(key, formData[key]);
        });
        if (file) data.append('file', file);

        try {
            setError(null);
            await api.post('/transactions', data);
            onTransactionCreated();
            setFormData({
                description: '', amount: '', currency: 'BDT', type: 'Debit',
                account_id: accounts[0]?.id || '', conversion_type: 'None', conversion_rate: '',
                reference: '', date: '', transfer_target_id: ''
            });
            setFile(null);
            document.querySelector('#transactionModal .btn-close')?.click();
        } catch (err) {
            const validationErrors = err.response?.data?.errors;
            if (validationErrors && Array.isArray(validationErrors)) {
                setError(validationErrors.map(e => e.msg).join(', '));
            } else {
                setError(err.response?.data?.detail || 'Error creating transaction');
            }
        }
    };

    return (
        <div className="modal fade" id="transactionModal" tabIndex="-1">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">New Transaction</h5>
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
                            <div className="mb-3 text-center">
                                <div className="btn-group w-100">
                                    <button type="button" className={`btn ${formData.type === 'Debit' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setFormData({ ...formData, type: 'Debit' })}>Debit</button>
                                    <button type="button" className={`btn ${formData.type === 'Credit' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setFormData({ ...formData, type: 'Credit' })}>Credit</button>
                                    <button type="button" className={`btn ${formData.type === 'Transfer' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFormData({ ...formData, type: 'Transfer' })}>Transfer</button>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Account</label>
                                <select className="form-select" value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })} required>
                                    {accounts.map(a => <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>)}
                                </select>
                            </div>

                            {formData.type === 'Transfer' && (
                                <div className="mb-3">
                                    <label className="form-label">To Account</label>
                                    <select className="form-select" value={formData.transfer_target_id} onChange={e => setFormData({ ...formData, transfer_target_id: e.target.value })} required>
                                        <option value="">Select Target...</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="row g-2 mb-3">
                                <div className="col-6">
                                    <label className="form-label">Amount</label>
                                    <input type="number" step="0.01" className="form-control" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Currency</label>
                                    <select className="form-select" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}>
                                        <option value="BDT">BDT</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                            </div>

                            {formData.currency === 'USD' && (
                                <div className="mb-3">
                                    <label className="form-label">Conversion Mode</label>
                                    <select className="form-select" value={formData.conversion_type} onChange={e => setFormData({ ...formData, conversion_type: e.target.value })}>
                                        <option value="None">No Conversion (Use USD Balance)</option>
                                        <option value="Auto">Auto Convert to BDT (Use Default Rate)</option>
                                        <option value="Manual">Manual Convert to BDT (Set Specific Rate)</option>
                                    </select>
                                </div>
                            )}

                            {formData.conversion_type === 'Manual' && (
                                <div className="mb-3">
                                    <label className="form-label">Exchange Rate (1 USD = X BDT)</label>
                                    <input type="number" step="0.01" className="form-control" value={formData.conversion_rate} onChange={e => setFormData({ ...formData, conversion_rate: e.target.value })} />
                                </div>
                            )}

                            <div className="mb-3">
                                <label className="form-label">Description</label>
                                <input type="text" className="form-control" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Attachment</label>
                                <input type="file" className="form-control" onChange={e => setFile(e.target.files[0])} accept="image/*,application/pdf" />
                                <div className="form-text">Accepted formats: Images (JPG, PNG) and PDF.</div>
                            </div>

                            <button type="submit" className="btn btn-dark w-100">Save Transaction</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
