import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import { ViewAttachmentModal } from '../components/Modals';

const Billing = () => {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [viewingAttachment, setViewingAttachment] = useState(null);

    const [newBill, setNewBill] = useState({
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        description: '',
        company_name: '',
        amount: '',
        currency: 'BDT'
    });
    const [file, setFile] = useState(null);

    const fetchBills = async () => {
        try {
            const res = await api.get('/bills');
            setBills(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBills();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setProcessing(true);
        const formData = new FormData();
        Object.keys(newBill).forEach(key => formData.append(key, newBill[key]));
        if (file) formData.append('file', file);

        try {
            await api.post('/bills', formData);
            setShowModal(false);
            setNewBill({
                invoice_date: new Date().toISOString().split('T')[0],
                due_date: '',
                description: '',
                company_name: '',
                amount: '',
                currency: 'BDT'
            });
            setFile(null);
            fetchBills();
        } catch (err) {
            alert('Failed to save bill');
        } finally {
            setProcessing(false);
        }
    };

    const updateStatus = async (id, status) => {
        try {
            await api.patch(`/bills/${id}/status`, { status });
            fetchBills();
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const deleteBill = async (id) => {
        if (!window.confirm('Are you sure you want to delete this bill?')) return;
        try {
            await api.delete(`/bills/${id}`);
            fetchBills();
        } catch (err) {
            alert('Failed to delete bill');
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Paid': return 'bg-success';
            case 'Partial': return 'bg-warning text-dark';
            default: return 'bg-danger';
        }
    };

    if (loading) return (
        <Layout title="Billing & Accounts Payable">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        </Layout>
    );

    return (
        <Layout title="Billing & Invoices">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="fw-bold text-main mb-1">Accounts Payable</h4>
                    <p className="text-muted small mb-0">Manage incoming invoices and upcoming payment deadlines.</p>
                </div>
                <button className="btn btn-primary px-4 fw-bold shadow-sm" onClick={() => setShowModal(true)}>
                    <i className="fa-solid fa-plus me-2"></i> Register New Bill
                </button>
            </div>

            <div className="row g-4 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm p-4 text-center">
                        <div className="text-muted small fw-bold text-uppercase mb-2">Total Unpaid</div>
                        <div className="h3 fw-bold text-danger mb-0">
                            {bills.filter(b => b.status === 'Unpaid').reduce((acc, b) => acc + Number(b.amount), 0).toLocaleString()}
                            <span className="fs-6 ms-1 fw-normal">BDT</span>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm p-4 text-center">
                        <div className="text-muted small fw-bold text-uppercase mb-2">Upcoming This Week</div>
                        <div className="h3 fw-bold text-primary mb-0">
                            {bills.filter(b => b.status !== 'Paid').length} Bills
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm p-4 text-center">
                        <div className="text-muted small fw-bold text-uppercase mb-2">Total Paid</div>
                        <div className="h3 fw-bold text-success mb-0">
                            {bills.filter(b => b.status === 'Paid').reduce((acc, b) => acc + Number(b.amount), 0).toLocaleString()}
                            <span className="fs-6 ms-1 fw-normal">BDT</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">Invoice Info</th>
                                    <th>Payable To</th>
                                    <th>Amount</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bills.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-5 text-muted">No invoices found. Click "Register New Bill" to add one.</td>
                                    </tr>
                                ) : bills.map((bill) => (
                                    <tr key={bill.id}>
                                        <td className="ps-4">
                                            <div className="fw-bold">{bill.description}</div>
                                            <div className="text-muted small">Inv: {new Date(bill.invoice_date).toLocaleDateString()}</div>
                                        </td>
                                        <td>
                                            <div className="fw-bold">{bill.company_name}</div>
                                        </td>
                                        <td>
                                            <div className="fw-bold">{Number(bill.amount).toLocaleString()} {bill.currency}</div>
                                        </td>
                                        <td>
                                            <div className={`fw-bold ${new Date(bill.due_date) < new Date() && bill.status !== 'Paid' ? 'text-danger' : ''}`}>
                                                {new Date(bill.due_date).toLocaleDateString()}
                                                {new Date(bill.due_date) < new Date() && bill.status !== 'Paid' &&
                                                    <span className="ms-2 badge bg-danger-subtle text-danger border-danger border x-small">OVERDUE</span>
                                                }
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${getStatusBadge(bill.status)}`}>{bill.status}</span>
                                        </td>
                                        <td className="text-end pe-4">
                                            <div className="dropdown">
                                                <button className="btn btn-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                                    Manage
                                                </button>
                                                <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
                                                    <li><button className="dropdown-item" onClick={() => updateStatus(bill.id, 'Paid')}>Mark as Paid</button></li>
                                                    <li><button className="dropdown-item" onClick={() => updateStatus(bill.id, 'Partial')}>Mark as Partial</button></li>
                                                    <li><button className="dropdown-item" onClick={() => updateStatus(bill.id, 'Unpaid')}>Mark as Unpaid</button></li>
                                                    <li><hr className="dropdown-divider" /></li>
                                                    {bill.attachments?.[0] && (
                                                        <li><button className="dropdown-item fw-bold text-primary" onClick={() => setViewingAttachment(bill)}>View Invoice Doc</button></li>
                                                    )}
                                                    <li><button className="dropdown-item text-danger" onClick={() => deleteBill(bill.id)}>Delete Bill</button></li>
                                                </ul>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ViewAttachmentModal item={viewingAttachment} onClose={() => setViewingAttachment(null)} />

            {/* Modal */}
            {showModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-0 pb-0">
                                <h5 className="fw-bold">Register New Invoice</h5>
                                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                            <form onSubmit={handleCreate}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Company / Payee</label>
                                        <input type="text" className="form-control" required value={newBill.company_name} onChange={e => setNewBill({ ...newBill, company_name: e.target.value })} placeholder="e.g. Electric Corp" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Description</label>
                                        <input type="text" className="form-control" required value={newBill.description} onChange={e => setNewBill({ ...newBill, description: e.target.value })} placeholder="e.g. Monthly Electricity Bill" />
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">Amount</label>
                                            <input type="number" className="form-control" required value={newBill.amount} onChange={e => setNewBill({ ...newBill, amount: e.target.value })} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">Currency</label>
                                            <select className="form-select" value={newBill.currency} onChange={e => setNewBill({ ...newBill, currency: e.target.value })}>
                                                <option value="BDT">BDT</option>
                                                <option value="USD">USD</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">Invoice Date</label>
                                            <input type="date" className="form-control" value={newBill.invoice_date} onChange={e => setNewBill({ ...newBill, invoice_date: e.target.value })} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">Due Date</label>
                                            <input type="date" className="form-control" required value={newBill.due_date} onChange={e => setNewBill({ ...newBill, due_date: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="mb-0">
                                        <label className="form-label small fw-bold">Attachment (Optional)</label>
                                        <input type="file" className="form-control" onChange={e => setFile(e.target.files[0])} />
                                    </div>
                                </div>
                                <div className="modal-footer border-0 pt-0">
                                    <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary px-4 fw-bold" disabled={processing}>
                                        {processing ? 'Saving...' : 'Register Bill'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Billing;
