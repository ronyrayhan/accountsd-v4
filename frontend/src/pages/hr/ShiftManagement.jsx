import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';

const ShiftManagement = () => {
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingShift, setEditingShift] = useState(null);

    const [form, setForm] = useState({
        name: '',
        start_time: '09:00',
        end_time: '18:00',
        grace_period_minutes: 15,
        is_active: true
    });

    useEffect(() => {
        fetchShifts();
    }, []);

    const fetchShifts = async () => {
        try {
            const res = await api.get('/hr/shifts');
            setShifts(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching shifts:', err);
            setLoading(false);
        }
    };

    const handleEdit = (shift) => {
        setEditingShift(shift);
        setForm({
            id: shift._id,
            name: shift.name,
            start_time: shift.start_time,
            end_time: shift.end_time,
            grace_period_minutes: shift.grace_period_minutes,
            is_active: shift.is_active
        });

        const modalEl = document.getElementById('shiftModal');
        if (window.bootstrap && modalEl) {
            const modal = new window.bootstrap.Modal(modalEl);
            modal.show();
        }
    };

    const handleNew = () => {
        setEditingShift(null);
        setForm({
            name: '',
            start_time: '09:00',
            end_time: '18:00',
            grace_period_minutes: 15,
            is_active: true
        });

        const modalEl = document.getElementById('shiftModal');
        if (window.bootstrap && modalEl) {
            const modal = new window.bootstrap.Modal(modalEl);
            modal.show();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hr/shifts', form);
            fetchShifts();
            const modalEl = document.getElementById('shiftModal');
            if (window.bootstrap && modalEl) {
                const modal = window.bootstrap.Modal.getInstance(modalEl);
                modal.hide();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save shift');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this shift?')) return;
        try {
            await api.delete(`/hr/shifts/${id}`);
            fetchShifts();
        } catch (err) {
            alert('Failed to delete shift');
        }
    };

    return (
        <Layout
            title="Shift Management"
            actions={
                <button className="btn rounded-pill px-4 fw-bold" style={{ backgroundColor: '#1B4332', color: 'white' }} onClick={handleNew}>
                    <i className="fa-solid fa-plus me-2"></i> Create New Shift
                </button>
            }
        >
            <div className="row g-4">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-success"></div>
                    </div>
                ) : shifts.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                        <i className="fa-solid fa-clock fs-1 opacity-25 mb-3 d-block"></i>
                        No shifts configured yet.
                    </div>
                ) : (
                    shifts.map(shift => (
                        <div key={shift._id} className="col-md-6 col-lg-4">
                            <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                                <div className="card-body p-4">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="fw-bold mb-0" style={{ color: '#1B4332' }}>{shift.name}</h5>
                                        <div className={`badge rounded-pill ${shift.is_active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                                            {shift.is_active ? 'Active' : 'Inactive'}
                                        </div>
                                    </div>

                                    <div className="bg-light rounded-4 p-3 mb-4 d-flex justify-content-between">
                                        <div className="text-center px-2">
                                            <div className="x-small text-muted text-uppercase fw-bold mb-1">Start Time</div>
                                            <div className="fw-bold" style={{ color: '#1B4332' }}>{shift.start_time}</div>
                                        </div>
                                        <div className="border-end"></div>
                                        <div className="text-center px-2">
                                            <div className="x-small text-muted text-uppercase fw-bold mb-1">End Time</div>
                                            <div className="fw-bold" style={{ color: '#d00000' }}>{shift.end_time}</div>
                                        </div>
                                    </div>

                                    <div className="small text-muted mb-4">
                                        <i className="fa-solid fa-stopwatch me-2 opacity-50"></i>
                                        Grace Period: <strong>{shift.grace_period_minutes} mins</strong>
                                    </div>

                                    <div className="d-flex gap-2">
                                        <button className="btn btn-light w-100 rounded-pill fw-bold" onClick={() => handleEdit(shift)}>
                                            <i className="fa-solid fa-pen-to-square me-2"></i> Edit
                                        </button>
                                        <button className="btn btn-outline-danger rounded-pill fw-bold" onClick={() => handleDelete(shift._id)}>
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            <div className="modal fade" id="shiftModal" tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered">
                    <form className="modal-content border-0 shadow-lg rounded-4" onSubmit={handleSubmit}>
                        <div className="modal-header border-0 p-4 pb-0">
                            <h5 className="fw-bold m-0">{editingShift ? 'Edit Shift' : 'New Shift'}</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body p-4">
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="form-label small fw-bold text-muted">Shift Name</label>
                                    <input
                                        type="text"
                                        className="form-control rounded-3"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        required
                                        placeholder="e.g. Morning Shift"
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label small fw-bold text-muted">Start Time</label>
                                    <input
                                        type="time"
                                        className="form-control rounded-3"
                                        value={form.start_time}
                                        onChange={e => setForm({ ...form, start_time: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label small fw-bold text-muted">End Time</label>
                                    <input
                                        type="time"
                                        className="form-control rounded-3"
                                        value={form.end_time}
                                        onChange={e => setForm({ ...form, end_time: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label small fw-bold text-muted">Grace Period (Mins)</label>
                                    <input
                                        type="number"
                                        className="form-control rounded-3"
                                        value={form.grace_period_minutes}
                                        onChange={e => setForm({ ...form, grace_period_minutes: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="col-md-6 d-flex align-items-end">
                                    <div className="form-check form-switch mb-2">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            checked={form.is_active}
                                            onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                        />
                                        <label className="form-check-label small fw-bold">Active Shift</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer border-0 p-4 pt-0">
                            <button type="submit" className="btn rounded-pill fw-bold px-5" style={{ backgroundColor: '#1B4332', color: 'white' }}>
                                Save Shift
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default ShiftManagement;
