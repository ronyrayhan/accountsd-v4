import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';

const LeaveSettings = () => {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingType, setEditingType] = useState(null);

    const [form, setForm] = useState({
        name: '',
        code: '',
        description: '',
        color: '#3b82f6',
        default_days: 0,
        is_carry_forward: false,
        requires_document: false,
        document_threshold_days: 0,
        gender_eligibility: 'All',
        is_active: true
    });

    useEffect(() => {
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        try {
            const res = await api.get('/hr/leave-types');
            setTypes(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleEdit = (type) => {
        setEditingType(type);
        setForm(type);
        setModalOpen(true); // Ideally use Bootstrap logic here or state

        // Quick hack to trigger Bootstrap modal if available
        const modalEl = document.getElementById('leaveTypeModal');
        if (window.bootstrap && modalEl) {
            const modal = new window.bootstrap.Modal(modalEl);
            modal.show();
        }
    };

    const handleNew = () => {
        setEditingType(null);
        setForm({
            name: '',
            code: '',
            description: '',
            color: '#3b82f6',
            default_days: 0,
            is_carry_forward: false,
            requires_document: false,
            document_threshold_days: 0,
            gender_eligibility: 'All',
            is_active: true
        });
        const modalEl = document.getElementById('leaveTypeModal');
        if (window.bootstrap && modalEl) {
            const modal = new window.bootstrap.Modal(modalEl);
            modal.show();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hr/leave-types', form);
            fetchTypes();
            // Hide modal
            const modalEl = document.getElementById('leaveTypeModal');
            if (window.bootstrap && modalEl) {
                const modal = window.bootstrap.Modal.getInstance(modalEl);
                modal.hide();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save');
        }
    };

    return (
        <Layout title="Leave Policies & Types"
            actions={
                <button className="btn btn-primary rounded-pill px-4" onClick={handleNew}>
                    <i className="fa-solid fa-plus me-2"></i> Create Policy
                </button>
            }
        >
            <div className="row g-4">
                {types.map(type => (
                    <div key={type._id} className="col-md-6 col-lg-4">
                        <div className="card border-0 shadow-sm rounded-4 h-100 position-relative overflow-hidden">
                            <div className="position-absolute top-0 start-0 w-100" style={{ height: '6px', backgroundColor: type.color }}></div>
                            <div className="card-body p-4">
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                    <div>
                                        <div className="badge bg-light text-muted border mb-2 font-monospace">{type.code}</div>
                                        <h5 className="fw-bold mb-1">{type.name}</h5>
                                        <div className="small text-muted">{type.description}</div>
                                    </div>
                                    <div className="form-check form-switch">
                                        <input className="form-check-input" type="checkbox" checked={type.is_active} readOnly />
                                    </div>
                                </div>
                                <div className="d-flex gap-2 flex-wrap mb-4">
                                    <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle">
                                        <i className="fa-solid fa-clock me-1"></i> {type.default_days} Days / Year
                                    </span>
                                    {type.requires_document && (
                                        <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                            <i className="fa-solid fa-paperclip me-1"></i> Doc Required
                                        </span>
                                    )}
                                    {type.is_carry_forward && (
                                        <span className="badge rounded-pill bg-info-subtle text-info-emphasis border border-info-subtle">
                                            <i className="fa-solid fa-forward me-1"></i> Carry Forward
                                        </span>
                                    )}
                                </div>
                                <button className="btn btn-light w-100 rounded-pill fw-bold" onClick={() => handleEdit(type)}>
                                    <i className="fa-solid fa-gear me-2"></i> Configure
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            <div className="modal fade" id="leaveTypeModal" tabIndex="-1">
                <div className="modal-dialog modal-lg modal-dialog-centered">
                    <form className="modal-content border-0 shadow-lg rounded-4" onSubmit={handleSubmit}>
                        <div className="modal-header border-0 p-4 pb-0">
                            <h5 className="fw-bold m-0">{editingType ? 'Edit Policy' : 'New Leave Policy'}</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body p-4">
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label small fw-bold">Policy Name</label>
                                    <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Sick Leave" />
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label small fw-bold">Code</label>
                                    <input type="text" className="form-control font-monospace" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} required placeholder="SL" />
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label small fw-bold">Color</label>
                                    <input type="color" className="form-control form-control-color w-100" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
                                </div>
                                <div className="col-12">
                                    <label className="form-label small fw-bold">Description</label>
                                    <input type="text" className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description for employees" />
                                </div>

                                <div className="col-12"><hr className="my-2 opacity-10" /></div>

                                <div className="col-md-4">
                                    <label className="form-label small fw-bold">Annual Quota (Days)</label>
                                    <input type="number" className="form-control" value={form.default_days} onChange={e => setForm({ ...form, default_days: Number(e.target.value) })} required />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold">Document Required?</label>
                                    <select className="form-select" value={form.requires_document} onChange={e => setForm({ ...form, requires_document: e.target.value === 'true' })}>
                                        <option value="false">No</option>
                                        <option value="true">Yes</option>
                                    </select>
                                </div>
                                {form.requires_document && (
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold">Threshold (Days)</label>
                                        <input type="number" className="form-control" value={form.document_threshold_days} onChange={e => setForm({ ...form, document_threshold_days: Number(e.target.value) })} placeholder="0 = Always" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer border-0 p-4 pt-0">
                            <button type="submit" className="btn btn-primary px-5 rounded-pill fw-bold">Save Policy</button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default LeaveSettings;
