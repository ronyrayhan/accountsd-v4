import React, { useState, useEffect } from 'react';
import api from '../api/axios';

export const AccountModal = ({ onAccountCreated }) => {
    const [formData, setFormData] = useState({
        code: '', name: '', type: 'Asset', subtype: 'Bank',
        opening_balance_bdt: 0, opening_balance_usd: 0
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/accounts', formData);
            onAccountCreated();
            // Reset and close (bootstrap way or state way)
            setFormData({
                code: '', name: '', type: 'Asset', subtype: 'Bank',
                opening_balance_bdt: 0, opening_balance_usd: 0
            });
            document.querySelector('#accountModal .btn-close')?.click();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error creating account');
        }
    };

    return (
        <div className="modal fade" id="accountModal" tabIndex="-1">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">New Account</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div className="modal-body">
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

export const TransactionModal = ({ accounts, onTransactionCreated }) => {
    const [formData, setFormData] = useState({
        description: '', amount: '', currency: 'BDT', type: 'Debit',
        account_id: '', conversion_type: 'None', conversion_rate: '',
        reference: '', date: '', transfer_target_id: ''
    });
    const [file, setFile] = useState(null);

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
            alert(err.response?.data?.detail || 'Error creating transaction');
        }
    };

    return (
        <div className="modal fade" id="transactionModal" tabIndex="-1">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">New Transaction</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div className="modal-body">
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

export const ViewAttachmentModal = ({ item, onClose }) => {
    const [blobUrl, setBlobUrl] = useState(null);
    const [isPdf, setIsPdf] = useState(false);

    useEffect(() => {
        if (!item) return;
        const attachment = item.attachments?.[0];
        if (!attachment) return;

        const fetchFile = async () => {
            try {
                const response = await api.get(`/files/${attachment.filename}`, {
                    responseType: 'blob'
                });
                const contentType = response.headers['content-type'];
                const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
                setBlobUrl(url);
                setIsPdf(attachment.filename.toLowerCase().endsWith('.pdf'));
            } catch (err) {
                console.error('Error fetching file:', err);
            }
        };

        fetchFile();

        return () => {
            if (blobUrl) window.URL.revokeObjectURL(blobUrl);
        };
    }, [item]);

    if (!item) return null;
    const attachment = item.attachments?.[0];
    if (!attachment) return null;

    // Logic to unify Bill vs Transaction data display
    const isBill = !!item.company_name;
    const displayName = isBill ? item.company_name : (item.account?.name || 'Unknown');
    const displayCode = isBill ? `#${item.id}` : (item.account?.code || `#${item.id}`);
    const date = new Date(item.date || item.invoice_date || item.due_date);

    return (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 1055, backdropFilter: 'blur(8px)' }} tabIndex="-1">
            <div className="modal-dialog modal-xl modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg overflow-hidden" style={{ borderRadius: '24px' }}>
                    <div className="row g-0" style={{ minHeight: '80vh' }}>
                        {/* Left Side: Dynamic Details Pane */}
                        <div className="col-lg-4 bg-white p-5 border-end d-flex flex-column">
                            <div className="p-4 rounded-4" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <h4 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>Document Details</h4>

                                <div className="mb-4">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>System Ref</label>
                                    <div className="h5 fw-bold text-primary mb-0">{item.serial_number || item.trx_id || `#${item.id}`}</div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Account/Payee</label>
                                    <div className="fw-bold text-dark">{displayName}</div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Code</label>
                                    <div className="fw-bold text-dark">{displayCode}</div>
                                </div>

                                <div className="mb-4">
                                    <div className="row g-3">
                                        <div className="col-6">
                                            <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Date</label>
                                            <div className="fw-bold text-dark">{date.toLocaleDateString()}</div>
                                        </div>
                                        <div className="col-6">
                                            <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Time</label>
                                            <div className="fw-bold text-dark">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Description</label>
                                    <div className="text-muted small" style={{ lineHeight: '1.5' }}>{item.description}</div>
                                </div>

                                <div className="mt-5 pt-3 border-top">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Total Amount</label>
                                    <div className="h3 fw-bold text-dark mb-0">
                                        {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-primary fs-5">{item.currency}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto text-center">
                                <span className="badge bg-light text-muted border px-3 py-2 rounded-pill x-small">
                                    Secure Verification: {new Date().toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {/* Right Side: Attachment Preview Pane */}
                        <div className="col-lg-8 bg-light d-flex flex-column" style={{ backgroundColor: '#f1f5f9' }}>
                            <div className="modal-header border-0 bg-white px-4 py-3 shadow-sm d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-primary bg-opacity-10 p-2 rounded-circle text-primary d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                                        <i className="fa-solid fa-file-shield"></i>
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark small">Protected Attachment: {attachment.filename}</div>
                                        <div className="text-muted x-small">End-to-End Encrypted Preview</div>
                                    </div>
                                </div>
                                <button type="button" className="btn-close shadow-none" onClick={onClose}></button>
                            </div>

                            <div className="flex-fill d-flex justify-content-center align-items-center p-4">
                                {!blobUrl ? (
                                    <div className="text-center">
                                        <div className="spinner-border text-primary mb-2"></div>
                                        <div className="text-muted small fw-bold">Authorizing...</div>
                                    </div>
                                ) : isPdf ? (
                                    <div className="w-100 h-100 bg-white rounded-4 shadow-sm overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                                        <iframe src={blobUrl} className="w-100 h-100" style={{ border: 'none' }} title="Document Viewer"></iframe>
                                    </div>
                                ) : (
                                    <div className="p-2 bg-white rounded-4 shadow-sm border">
                                        <img src={blobUrl} alt="Attachment" className="img-fluid rounded-3" style={{ maxHeight: '65vh', maxWidth: '100%', objectFit: 'contain' }} />
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer border-0 bg-white px-4 py-3 gap-2 shadow-sm mt-auto">
                                {blobUrl && (
                                    <a href={blobUrl} download={attachment.filename} className="btn btn-primary px-4 py-2 fw-bold shadow-sm rounded-3">
                                        <i className="fa-solid fa-download me-2"></i> Download Securely
                                    </a>
                                )}
                                <button type="button" className="btn btn-outline-secondary px-4 py-2 fw-bold rounded-3" onClick={onClose}>Close Preview</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ImportTransactionsModal = ({ onImported }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/transactions/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'transaction_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download error detail:', err);
            alert('Error downloading template: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handlePreview = async (e) => {
        e.preventDefault();
        if (!file) return;

        setLoading(true);
        const data = new FormData();
        data.append('file', file);

        try {
            const res = await api.post('/transactions/preview', data);
            setPreviewData(res.data);
        } catch (err) {
            alert(err.response?.data?.detail || 'Error previewing data');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalSubmit = async () => {
        setLoading(true);
        const data = new FormData();
        data.append('file', file);

        try {
            await api.post('/transactions/import', data);
            alert('Import successful!');
            onImported();
            document.querySelector('#importModal .btn-close')?.click();
            resetModal();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error importing transactions');
        } finally {
            setLoading(false);
        }
    };

    const resetModal = () => {
        setFile(null);
        setPreviewData(null);
        setLoading(false);
    };

    return (
        <div className="modal fade" id="importModal" tabIndex="-1">
            <div className="modal-dialog modal-lg">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Bulk Import Transactions</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" onClick={resetModal}></button>
                    </div>
                    <div className="modal-body p-4">
                        {!previewData ? (
                            <>
                                <div className="alert alert-info py-3 border-0 bg-primary bg-opacity-10 text-primary mb-4">
                                    <i className="fa-solid fa-circle-info me-2"></i>
                                    Download our official Excel template to ensure data compatibility.
                                </div>

                                <div className="mb-4">
                                    <button className="btn btn-outline-primary w-100 py-3 d-flex align-items-center justify-content-center gap-2" onClick={handleDownloadTemplate}>
                                        <i className="fa-solid fa-file-excel fs-5"></i>
                                        Download template.xlsx
                                    </button>
                                </div>

                                <form onSubmit={handlePreview}>
                                    <div className="mb-4">
                                        <label className="form-label text-muted small fw-bold text-uppercase ls-1">Select Excel File</label>
                                        <input type="file" className="form-control py-2" onChange={e => setFile(e.target.files[0])} accept=".xlsx" required />
                                    </div>

                                    <button type="submit" className="btn btn-primary w-100 py-3" disabled={loading}>
                                        {loading ? (
                                            <><span className="spinner-border spinner-border-sm me-2"></span>Analyzing File...</>
                                        ) : (
                                            <><i className="fa-solid fa-magnifying-glass me-2"></i>Preview Import Impact</>
                                        )}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div>
                                <h6 className="fw-bold mb-3 text-uppercase small text-muted">Import Impact Summary</h6>
                                <div className="table-responsive rounded-3 border mb-4">
                                    <table className="table table-sm align-middle mb-0">
                                        <thead className="bg-light">
                                            <tr>
                                                <th className="ps-3 py-2">Account</th>
                                                <th className="py-2 text-center">Entries</th>
                                                <th className="py-2 text-end">Current (BDT/USD)</th>
                                                <th className="py-2 text-end">Net Change</th>
                                                <th className="pe-3 py-2 text-end text-primary">Target Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.map(item => (
                                                <tr key={item.code}>
                                                    <td className="ps-3 py-3">
                                                        <div className="fw-bold">{item.name}</div>
                                                        <div className="small text-muted">{item.code}</div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="badge bg-secondary bg-opacity-10 text-dark border">{item.count}</span>
                                                    </td>
                                                    <td className="text-end small">
                                                        <div>{item.currentBdt.toLocaleString()} BDT</div>
                                                        <div>${item.currentUsd.toLocaleString()} USD</div>
                                                    </td>
                                                    <td className={`text-end small fw-bold ${item.netBdt < 0 || item.netUsd < 0 ? 'text-danger' : 'text-success'}`}>
                                                        <div>{item.netBdt > 0 ? '+' : ''}{item.netBdt.toLocaleString()}</div>
                                                        <div>{item.netUsd > 0 ? '+' : ''}${item.netUsd.toLocaleString()}</div>
                                                    </td>
                                                    <td className="pe-3 text-end fw-bold text-primary">
                                                        <div>{item.projectedBdt.toLocaleString()} BDT</div>
                                                        <div>${item.projectedUsd.toLocaleString()} USD</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="d-flex gap-3">
                                    <button className="btn btn-outline-dark flex-grow-1 py-3" onClick={() => setPreviewData(null)} disabled={loading}>
                                        Cancel & Reselect
                                    </button>
                                    <button className="btn btn-primary flex-grow-1 py-3" onClick={handleFinalSubmit} disabled={loading}>
                                        {loading ? (
                                            <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</>
                                        ) : (
                                            <><i className="fa-solid fa-check-double me-2"></i>Confirm & Write to Database</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
