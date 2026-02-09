import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../api/axios';

const ApplyForTeam = () => {
    const [subordinates, setSubordinates] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        subordinate_id: '',
        leave_type_id: '',
        start_date: '',
        end_date: '',
        total_days: 1,
        reason: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [subRes, typeRes] = await Promise.all([
                    api.get('/portal/manager/subordinates'),
                    api.get('/portal/leave-types')
                ]);
                setSubordinates(subRes.data);
                setLeaveTypes(typeRes.data);
            } catch (err) {
                console.error('Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/portal/manager/apply-for', formData);
            alert('Leave application submitted and approved successfully!');
            setFormData({
                subordinate_id: '',
                leave_type_id: '',
                start_date: '',
                end_date: '',
                total_days: 1,
                reason: ''
            });
        } catch (err) {
            alert(err.response?.data?.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <Layout title="Approver Center | Apply for Team">
            <div className="row justify-content-center">
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm rounded-4 p-4 p-lg-5">
                        <div className="mb-4">
                            <h4 className="fw-bold mb-1">Apply for Team</h4>
                            <p className="text-muted small">Submit a leave request on behalf of your subordinate. This will be automatically recorded as approved.</p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="row g-4">
                                <div className="col-md-6">
                                    <label className="form-label x-small fw-bold text-uppercase text-muted">Select Employee</label>
                                    <select
                                        className="form-select bg-light border-0 rounded-4 p-3 shadow-none"
                                        name="subordinate_id"
                                        value={formData.subordinate_id}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Choose subordinate...</option>
                                        {subordinates.map(s => (
                                            <option key={s._id} value={s._id}>{s.personal_info?.full_name} ({s.employee_id})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label x-small fw-bold text-uppercase text-muted">Leave Type</label>
                                    <select
                                        className="form-select bg-light border-0 rounded-4 p-3 shadow-none"
                                        name="leave_type_id"
                                        value={formData.leave_type_id}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select type...</option>
                                        {leaveTypes.map(t => (
                                            <option key={t._id} value={t._id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label x-small fw-bold text-uppercase text-muted">Start Date</label>
                                    <input
                                        type="date"
                                        className="form-control bg-light border-0 rounded-4 p-3 shadow-none"
                                        name="start_date"
                                        value={formData.start_date}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label x-small fw-bold text-uppercase text-muted">End Date</label>
                                    <input
                                        type="date"
                                        className="form-control bg-light border-0 rounded-4 p-3 shadow-none"
                                        name="end_date"
                                        value={formData.end_date}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label x-small fw-bold text-uppercase text-muted">Total Days</label>
                                    <input
                                        type="number"
                                        className="form-control bg-light border-0 rounded-4 p-3 shadow-none"
                                        name="total_days"
                                        value={formData.total_days}
                                        onChange={handleChange}
                                        min="0.5"
                                        step="0.5"
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <label className="form-label x-small fw-bold text-uppercase text-muted">Reason / Notes</label>
                                    <textarea
                                        className="form-control bg-light border-0 rounded-4 p-3 shadow-none"
                                        rows="3"
                                        name="reason"
                                        value={formData.reason}
                                        onChange={handleChange}
                                        placeholder="Brief explanation for the leave..."
                                        required
                                    ></textarea>
                                </div>
                                <div className="col-12 mt-4">
                                    <button
                                        type="submit"
                                        className="btn btn-primary rounded-pill px-5 py-3 fw-bold shadow-sm w-100"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Submitting...' : 'Apply & Approve Leave'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ApplyForTeam;
