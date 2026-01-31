import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

const AccountSummaries = () => {
    const [dailyData, setDailyData] = useState([]);
    const [monthlyData, setMonthlyData] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [filters, setFilters] = useState({ accountId: '', startDate: '', endDate: '' });
    const [view, setView] = useState('daily'); // 'daily' or 'monthly'
    const [loading, setLoading] = useState(false);

    const currentData = view === 'daily' ? dailyData : monthlyData;

    // Calculate Dashboard Stats
    const stats = {
        totalCredit: currentData.reduce((acc, curr) => acc + (curr.credit_bdt || 0), 0),
        totalDebit: currentData.reduce((acc, curr) => acc + (curr.debit_bdt || 0), 0),
        netChange: currentData.reduce((acc, curr) => acc + (curr.closing_bdt - curr.opening_bdt), 0),
        totalUsd: currentData.reduce((acc, curr) => acc + (curr.closing_usd || 0), 0),
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const endpoint = view === 'daily' ? '/summaries/daily' : '/summaries/monthly';
            const params = new URLSearchParams();
            if (filters.accountId) params.append('accountId', filters.accountId);
            if (view === 'daily') {
                if (filters.startDate) params.append('startDate', filters.startDate);
                if (filters.endDate) params.append('endDate', filters.endDate);
            }

            const res = await api.get(`${endpoint}?${params.toString()}`);
            if (view === 'daily') setDailyData(res.data);
            else setMonthlyData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAccounts = async () => {
        try {
            const res = await api.get('/accounts');
            setAccounts(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    useEffect(() => {
        fetchData();
    }, [view, filters]);

    const handleExport = () => {
        window.open(`${api.defaults.baseURL}/summaries/export?type=${view}`, '_blank');
    };

    const handleSync = async () => {
        if (!confirm('Recalculate today\'s summary for all accounts?')) return;
        setLoading(true);
        try {
            await api.post('/summaries/sync', {});
            fetchData();
        } catch (err) {
            alert('Failed to sync: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout
            title="Finance snapshots"
            actions={
                <div className="d-flex gap-2">
                    <button className="btn btn-glass-dark btn-sm border-0" onClick={handleSync}>
                        <i className="fa-solid fa-sync me-2"></i>Sync Today
                    </button>
                    <button className="btn btn-primary btn-sm rounded-3 shadow-sm px-3" onClick={handleExport}>
                        <i className="fa-solid fa-file-excel me-2"></i>Export Report
                    </button>
                </div>
            }
        >
            {/* Stats Overview */}
            <div className="row g-4 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                        <div className="d-flex align-items-center mb-2">
                            <div className="stats-icon-box bg-success-light text-success me-3">
                                <i className="fa-solid fa-arrow-trend-up"></i>
                            </div>
                            <span className="text-muted small fw-bold text-uppercase ls-1">Total Credit</span>
                        </div>
                        <h3 className="fw-bold mb-0 text-dark">
                            <span className="small text-muted fw-normal">BDT</span> {stats.totalCredit.toLocaleString()}
                        </h3>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                        <div className="d-flex align-items-center mb-2">
                            <div className="stats-icon-box bg-danger-light text-danger me-3">
                                <i className="fa-solid fa-arrow-trend-down"></i>
                            </div>
                            <span className="text-muted small fw-bold text-uppercase ls-1">Total Debit</span>
                        </div>
                        <h3 className="fw-bold mb-0 text-dark">
                            <span className="small text-muted fw-normal">BDT</span> {stats.totalDebit.toLocaleString()}
                        </h3>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                        <div className="d-flex align-items-center mb-2">
                            <div className="stats-icon-box bg-primary-light text-primary me-3">
                                <i className="fa-solid fa-scale-balanced"></i>
                            </div>
                            <span className="text-muted small fw-bold text-uppercase ls-1">Net Movement</span>
                        </div>
                        <h3 className={`fw-bold mb-0 ${stats.netChange >= 0 ? 'text-success' : 'text-danger'}`}>
                            <span className="small text-muted fw-normal">BDT</span> {stats.netChange.toLocaleString()}
                        </h3>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                        <div className="d-flex align-items-center mb-2">
                            <div className="stats-icon-box bg-info-light text-info me-3">
                                <i className="fa-solid fa-dollar-sign"></i>
                            </div>
                            <span className="text-muted small fw-bold text-uppercase ls-1">Total USD Holding</span>
                        </div>
                        <h3 className="fw-bold mb-0 text-dark">
                            <span className="small text-muted fw-normal">$</span> {stats.totalUsd.toLocaleString()}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Filters Row */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white">
                <div className="card-body p-4">
                    <div className="row g-3 align-items-center">
                        <div className="col-md-3">
                            <div className="btn-group w-100 p-1 bg-light rounded-3">
                                <button
                                    className={`btn btn-sm rounded-2 ${view === 'daily' ? 'btn-white shadow-sm fw-bold' : 'btn-transparent text-muted'}`}
                                    onClick={() => setView('daily')}
                                >
                                    Daily Analytics
                                </button>
                                <button
                                    className={`btn btn-sm rounded-2 ${view === 'monthly' ? 'btn-white shadow-sm fw-bold' : 'btn-transparent text-muted'}`}
                                    onClick={() => setView('monthly')}
                                >
                                    Monthly Trends
                                </button>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <select className="form-select border-light-subtle rounded-3" value={filters.accountId} onChange={e => setFilters({ ...filters, accountId: e.target.value })}>
                                <option value="">Global Overview (All Accounts)</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        </div>
                        {view === 'daily' && (
                            <>
                                <div className="col-md-3">
                                    <input type="date" className="form-control border-light-subtle rounded-3" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
                                </div>
                                <div className="col-md-3">
                                    <input type="date" className="form-control border-light-subtle rounded-3" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Data Table Section */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                <div className="table-responsive">
                    <table className="table align-middle m-0">
                        <thead className="bg-light-subtle border-bottom">
                            <tr>
                                <th className="ps-4 text-muted small fw-bold text-uppercase py-3">Account Entity</th>
                                <th className="text-muted small fw-bold text-uppercase py-3">{view === 'daily' ? 'Timeline' : 'Period'}</th>
                                <th className="text-end text-muted small fw-bold text-uppercase py-3">Opening</th>
                                <th className="text-end text-muted small fw-bold text-uppercase py-3">Credit (+)</th>
                                <th className="text-end text-muted small fw-bold text-uppercase py-3">Debit (-)</th>
                                <th className="text-end text-muted small fw-bold text-uppercase py-3">Closing Snapshot</th>
                                <th className="text-end pe-4 text-muted small fw-bold text-uppercase py-3">USD Balance</th>
                            </tr>
                        </thead>
                        <tbody className="border-0">
                            {loading ? (
                                <tr><td colSpan="7" className="text-center py-5"><div className="spinner-border spinner-border-sm text-primary me-2"></div>Loading analytics...</td></tr>
                            ) : (
                                currentData.map((row, idx) => (
                                    <tr key={idx} className="border-bottom-light">
                                        <td className="ps-4 fw-bold text-dark">{row.account_id?.name || 'Unknown'}</td>
                                        <td>
                                            <span className="badge bg-light text-dark fw-medium rounded-pill px-3">
                                                {view === 'daily' ? row.date : row.month}
                                            </span>
                                        </td>
                                        <td className="text-end font-monospace">{row.opening_bdt?.toLocaleString()}</td>
                                        <td className="text-end text-success fw-bold">+{row.credit_bdt?.toLocaleString()}</td>
                                        <td className="text-end text-danger fw-bold">-{row.debit_bdt?.toLocaleString()}</td>
                                        <td className="text-end fw-extrabold text-primary">{row.closing_bdt?.toLocaleString()}</td>
                                        <td className="text-end pe-4">
                                            <span className="text-muted small">${row.closing_usd?.toLocaleString()}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {!currentData.length && !loading && (
                                <tr><td colSpan="7" className="text-center py-5 text-muted fst-italic">No snapshot data available for the selected criteria.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};


export default AccountSummaries;
