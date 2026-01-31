import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

const Settings = () => {
    const [rate, setRate] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings/usd_bdt_rate');
            setRate(res.data.value || '110');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/settings', { key: 'usd_bdt_rate', value: rate });
            alert('Settings updated successfully');
        } catch (err) {
            alert('Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <Layout title="System Settings">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        </Layout>
    );

    return (
        <Layout title="System Settings">
            <div className="row">
                <div className="col-md-6">
                    <div className="card border-0 shadow-sm p-4">
                        <h5 className="fw-bold mb-4">Currency Configuration</h5>
                        <form onSubmit={handleSave}>
                            <div className="mb-4">
                                <label className="form-label small fw-bold text-muted">DEFAULT USD TO BDT RATE</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0 text-muted">1 USD =</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-control border-start-0 ps-0 fw-bold"
                                        value={rate}
                                        onChange={e => setRate(e.target.value)}
                                        required
                                    />
                                    <span className="input-group-text bg-light border-start-0 text-muted">BDT</span>
                                </div>
                                <small className="text-muted mt-2 d-block">This rate is used as the default for all currency conversions throughout the system.</small>
                            </div>

                            <button className="btn btn-primary px-4 fw-bold" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Settings;
