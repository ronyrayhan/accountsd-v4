import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

const Reports = () => {
    const [trialBalance, setTrialBalance] = useState({ bdt: { entries: [] }, usd: { entries: [] } });
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [tbRes, predRes] = await Promise.all([
                    api.get('/reports/trial-balance'),
                    api.get('/reports/prediction')
                ]);
                setTrialBalance(tbRes.data);
                setPrediction(predRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <Layout title="Financial Analytics">
        <div className="d-flex justify-content-center align-items-center vh-100">
            <div className="spinner-border text-primary" role="status"></div>
        </div>
    </Layout>;

    return (
        <Layout title="Analytics & Reports">
            <div className="row g-4">
                {/* Prediction Card */}
                <div className="col-12">
                    <div className="card border-0 p-4">
                        <div className="d-flex align-items-center gap-3 mb-4">
                            <div className="stats-icon-box shadow-sm">
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                            <div>
                                <h4 className="fw-bold m-0 text-bright">Cashflow Prediction</h4>
                                <p className="text-muted small m-0">Projection for the next {prediction?.days_ahead || 30} days based on SMA model</p>
                            </div>
                        </div>

                        <div className="row g-4">
                            <div className="col-md-6">
                                <div className="balance-card-inner border-0 bg-light">
                                    <div className="text-muted small mb-1 fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>Daily Average Spend</div>
                                    <div className="h2 fw-bold text-main mb-0">{(prediction?.daily_average || 0).toLocaleString()} <span className="fs-6 text-muted fw-normal">BDT</span></div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="balance-card-inner border-0 bg-primary bg-opacity-10">
                                    <div className="text-primary small mb-1 fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>Total Predicted Expense</div>
                                    <div className="h2 fw-bold text-primary mb-0">{(prediction?.total_predicted || 0).toLocaleString()} <span className="fs-6 text-primary text-opacity-50 fw-normal">BDT</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trial Balance BDT */}
                <div className="col-12">
                    <div className="card border-0 overflow-hidden">
                        <div className="px-4 pt-4 pb-2 d-flex justify-content-between align-items-center bg-white">
                            <h5 className="fw-bold m-0 text-bright">Trial Balance (BDT)</h5>
                            <span className={`badge ${trialBalance.bdt.is_balanced ? 'bg-success-light text-success' : 'bg-danger-light text-danger'} px-3`}>
                                {trialBalance.bdt.is_balanced ? 'Balanced' : 'Discrepancy Detected'}
                            </span>
                        </div>
                        <div className="table-responsive">
                            <table className="table align-middle m-0">
                                <thead>
                                    <tr>
                                        <th className="ps-4">Account Registry</th>
                                        <th>Classification</th>
                                        <th className="text-end">Debits</th>
                                        <th className="pe-4 text-end">Credits</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trialBalance.bdt.entries.map(e => (
                                        <tr key={e.code}>
                                            <td className="ps-4">
                                                <div className="fw-bold text-main">{e.account}</div>
                                                <div className="small text-muted" style={{ fontSize: '0.7rem' }}>{e.code}</div>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-muted border py-1" style={{ fontSize: '0.7rem' }}>{e.type}</span>
                                            </td>
                                            <td className="text-end fw-medium">{e.debit ? e.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</td>
                                            <td className="pe-4 text-end fw-medium">{e.credit ? e.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-light fw-bold text-bright border-top">
                                        <td colSpan="2" className="ps-4 py-3">Closing Totals</td>
                                        <td className="text-end py-3 text-primary">{(trialBalance?.bdt?.total_debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td className="pe-4 text-end py-3 text-primary">{(trialBalance?.bdt?.total_credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Reports;
