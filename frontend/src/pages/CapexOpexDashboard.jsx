import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const CapexOpexDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    // Fix Date Handling: Use local date for default filters instead of UTC
    const getLocalDate = (date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    const [filters, setFilters] = useState({
        startDate: getLocalDate(new Date(new Date().getFullYear(), 0, 1)),
        endDate: getLocalDate(new Date())
    });
    const [viewCurrency, setViewCurrency] = useState('BDT'); // 'BDT' or 'USD'

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams(filters);
            const res = await api.get(`/reports/capex-opex?${params.toString()}`);
            setStats(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading && !stats) return (
        <Layout title="CapEx & OpEx Dashboard">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        </Layout>
    );

    // Prepare Chart Data
    const chartLabels = stats?.trend?.map(t => `${t._id.month}/${t._id.year}`) || [];
    const uniqueLabels = [...new Set(chartLabels)];

    const capexData = uniqueLabels.map(label => {
        const item = stats?.trend?.find(t => `${t._id.month}/${t._id.year}` === label && t._id.type === 'CapEx');
        return viewCurrency === 'USD' ? (item ? item.total_usd : 0) : (item ? item.total : 0);
    });

    const opexData = uniqueLabels.map(label => {
        const item = stats?.trend?.find(t => `${t._id.month}/${t._id.year}` === label && t._id.type === 'OpEx');
        return viewCurrency === 'USD' ? (item ? item.total_usd : 0) : (item ? item.total : 0);
    });

    const chartData = {
        labels: uniqueLabels,
        datasets: [
            {
                label: 'CapEx',
                data: capexData,
                backgroundColor: 'rgba(53, 162, 235, 0.7)',
            },
            {
                label: 'OpEx',
                data: opexData,
                backgroundColor: 'rgba(255, 99, 132, 0.7)',
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Monthly CapEx vs OpEx' },
        },
    };

    const getSummaryTotal = (type) => {
        const item = stats?.totals?.find(t => t._id === type);
        if (!item) return 0;
        return viewCurrency === 'USD' ? (item.total_usd || 0) : item.total;
    };

    return (
        <Layout title="CapEx & OpEx Dashboard">
            {/* Filters */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <label className="form-label small fw-bold">Start Date</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.startDate}
                                onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label small fw-bold">End Date</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.endDate}
                                onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small fw-bold">Currency View</label>
                            <div className="btn-group w-100" role="group">
                                <button
                                    type="button"
                                    className={`btn ${viewCurrency === 'BDT' ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setViewCurrency('BDT')}
                                >
                                    BDT
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${viewCurrency === 'USD' ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setViewCurrency('USD')}
                                >
                                    USD
                                </button>
                            </div>
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-primary w-100" onClick={fetchStats}>
                                <i className="fa-solid fa-filter me-1"></i> Update
                            </button>
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-success w-100" onClick={async () => {
                                try {
                                    const params = new URLSearchParams(filters);
                                    const response = await api.get(`/reports/capex-opex/export?${params}`, { responseType: 'blob' });
                                    const url = window.URL.createObjectURL(new Blob([response.data]));
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `CapEx_OpEx_Report_${filters.startDate}_to_${filters.endDate}.xlsx`);
                                    document.body.appendChild(link);
                                    link.click();
                                    link.remove();
                                } catch (err) {
                                    console.error('Export failed:', err);
                                    alert('Failed to export report');
                                }
                            }}>
                                <i className="fa-solid fa-file-excel me-1"></i> Export
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="row g-4 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100 bg-primary bg-opacity-10">
                        <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="text-primary fw-bold text-uppercase mb-0">Total CapEx</h6>
                                <i className="fa-solid fa-building text-primary opacity-50 fs-4"></i>
                            </div>
                            <h3 className="fw-bold text-dark mb-0">
                                {getSummaryTotal('CapEx').toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="fs-6 text-muted">{viewCurrency}</span>
                            </h3>
                            <div className="small text-muted mt-2">Capital Expenditures</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100 bg-danger bg-opacity-10">
                        <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="text-danger fw-bold text-uppercase mb-0">Total OpEx</h6>
                                <i className="fa-solid fa-fire text-danger opacity-50 fs-4"></i>
                            </div>
                            <h3 className="fw-bold text-dark mb-0">
                                {getSummaryTotal('OpEx').toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="fs-6 text-muted">{viewCurrency}</span>
                            </h3>
                            <div className="small text-muted mt-2">Operational Expenditures</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100 bg-secondary bg-opacity-10">
                        <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="text-secondary fw-bold text-uppercase mb-0">Uncategorized</h6>
                                <i className="fa-solid fa-circle-question text-secondary opacity-50 fs-4"></i>
                            </div>
                            <h3 className="fw-bold text-dark mb-0">
                                {getSummaryTotal('Uncategorized').toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="fs-6 text-muted">{viewCurrency}</span>
                            </h3>
                            <div className="small text-muted mt-2">Missing Expense Type</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4 mb-4">
                {/* Chart Area */}
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body p-4">
                            <div style={{ height: '400px' }}>
                                <Bar options={chartOptions} data={chartData} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-white py-3">
                            <h6 className="mb-0 fw-bold">Top Expense Categories</h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="bg-light sticky-top">
                                        <tr>
                                            <th className="ps-3">Category</th>
                                            <th className="text-end pe-3">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats?.categories?.slice(0, 10).map((cat, idx) => (
                                            <tr key={idx}>
                                                <td className="ps-3">
                                                    <div className="fw-bold text-dark">{cat._id.category || 'Uncategorized'}</div>
                                                    <div className="x-small text-muted">{cat._id.type}</div>
                                                </td>
                                                <td className="text-end pe-3">
                                                    <div className="fw-bold">
                                                        {(viewCurrency === 'USD' ? (cat.total_usd || 0) : cat.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        <span className="x-small text-muted ms-1">{viewCurrency}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!stats?.categories || stats.categories.length === 0) && (
                                            <tr>
                                                <td colSpan="2" className="text-center py-4 text-muted small">No category data</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="card border-0 shadow-sm">
                <div className="card-header bg-white py-3">
                    <h6 className="mb-0 fw-bold">Recent Transactions (Accrual Date)</h6>
                </div>
                <div className="table-responsive">
                    <table className="table align-middle mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4">Date</th>
                                <th>Ref</th>
                                <th>Description</th>
                                <th>Account</th>
                                <th>Type / Category</th>
                                <th className="text-end pe-4">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats?.list?.map(txn => (
                                <tr key={txn._id}>
                                    <td className="ps-4">
                                        <div className="fw-bold">{new Date(txn.invoice_date || txn.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                        {txn.invoice_date && <div className="x-small text-muted">Inv. Date</div>}
                                    </td>
                                    <td><span className="badge bg-light text-dark border">{txn.trx_id || txn.serial_number}</span></td>
                                    <td>{txn.description}</td>
                                    <td>{txn.account?.name}</td>
                                    <td>
                                        <div className="d-flex flex-column align-items-start gap-1">
                                            {txn.expense_type === 'CapEx' && <span className="badge bg-primary">CapEx</span>}
                                            {txn.expense_type === 'OpEx' && <span className="badge bg-danger">OpEx</span>}
                                            {!txn.expense_type && <span className="badge bg-secondary">Uncategorized</span>}

                                            {txn.expense_category && (
                                                <span className="badge bg-light text-dark border">{txn.expense_category}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-end pe-4">
                                        {viewCurrency === 'BDT' ? (
                                            <>
                                                <div className="fw-bold">
                                                    {(txn.converted_amount_bdt || txn.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT
                                                </div>
                                                {txn.currency !== 'BDT' && (
                                                    <div className="x-small text-muted">Original: {Number(txn.amount).toLocaleString()} {txn.currency}</div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <div className={`fw-bold ${txn.currency === 'USD' ? 'text-dark' : 'text-muted'}`}>
                                                    {txn.currency === 'USD' ? Number(txn.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} USD
                                                </div>
                                                {txn.currency === 'USD' && (
                                                    <div className="x-small text-muted">
                                                        ~ {(txn.converted_amount_bdt || 0).toLocaleString()} BDT
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {(!stats?.list || stats.list.length === 0) && (
                                <tr>
                                    <td colSpan="6" className="text-center py-4 text-muted">No data found in this period</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default CapexOpexDashboard;
