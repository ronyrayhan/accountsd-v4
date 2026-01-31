import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import { ImportTransactionsModal, ViewAttachmentModal } from '../components/Modals';
import { useAuth } from '../context/AuthContext';

const Ledger = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingAttachment, setViewingAttachment] = useState(null);
    const [viewMode, setViewMode] = useState('classic'); // 'classic' or 'modern'
    const [selectedMonth, setSelectedMonth] = useState(null); // For modern view filtering

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        accountId: '',
        currency: '',
        type: '',
        search: ''
    });

    // Sorting state
    const [sortConfig, setSortConfig] = useState({
        key: 'date',
        direction: 'desc'
    });

    const [isFilterExpanded, setIsFilterExpanded] = useState(false);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.accountId && filters.accountId !== "") params.append('accountId', filters.accountId);
            if (filters.currency) params.append('currency', filters.currency);
            if (filters.type) params.append('type', filters.type);
            if (filters.search) params.append('search', filters.search);

            const res = await api.get(`/transactions?${params.toString()}&limit=-1`);
            setTransactions(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [filters]);

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

    const sortedAndFilteredTransactions = useMemo(() => {
        let data = [...transactions];
        if (selectedMonth && viewMode === 'modern') {
            data = data.filter(t => new Date(t.date).toISOString().substring(0, 7) === selectedMonth);
        }

        return data.sort((a, b) => {
            let valA, valB;
            switch (sortConfig.key) {
                case 'sn': valA = a.serial_number || 0; valB = b.serial_number || 0; break;
                case 'account': valA = a.account?.name || ''; valB = b.account?.name || ''; break;
                case 'amount': valA = parseFloat(a.amount) || 0; valB = parseFloat(b.amount) || 0; break;
                default: valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime();
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [transactions, sortConfig, selectedMonth, viewMode]);

    const stats = useMemo(() => {
        return sortedAndFilteredTransactions.reduce((acc, t) => {
            const amt = parseFloat(t.amount) || 0;
            if (t.type === 'Debit') acc.debit += amt;
            else if (t.type === 'Credit') acc.credit += amt;
            return acc;
        }, { debit: 0, credit: 0 });
    }, [sortedAndFilteredTransactions]);

    const monthlySummaries = useMemo(() => {
        const months = {};
        transactions.forEach(t => {
            const m = new Date(t.date).toISOString().substring(0, 7);
            if (!months[m]) months[m] = { credit: 0, debit: 0, name: new Date(t.date).toLocaleString('default', { month: 'short', year: 'numeric' }) };
            const amt = parseFloat(t.amount) || 0;
            if (t.type === 'Credit') months[m].credit += amt;
            else months[m].debit += amt;
        });
        return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
    }, [transactions]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleResetFilters = () => {
        setFilters({ startDate: '', endDate: '', accountId: '', currency: '', type: '', search: '' });
        setSelectedMonth(null);
    };

    const handleExport = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.accountId) params.append('accountId', filters.accountId);
            if (filters.currency) params.append('currency', filters.currency);
            if (filters.type) params.append('type', filters.type);

            const res = await api.get(`/transactions/export?${params.toString()}`, {
                responseType: 'blob'
            });

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `Ledger_Export_${timestamp}.xlsx`;

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed. Please try again.');
        }
    };

    // Set default month for modern view
    useEffect(() => {
        if (viewMode === 'modern' && !selectedMonth && monthlySummaries.length > 0) {
            setSelectedMonth(monthlySummaries[0][0]);
        }
    }, [viewMode, monthlySummaries]);

    if (loading) return (
        <Layout title="Ledger">
            <div className="d-flex justify-content-center align-items-center vh-100"><div className="spinner-border text-primary"></div></div>
        </Layout>
    );

    return (
        <Layout
            title="Registry & Ledger"
            actions={
                <div className="d-flex gap-2 align-items-center">
                    <div className="btn-group p-1 bg-light rounded-3 me-2" style={{ height: '38px' }}>
                        <button className={`btn btn-sm px-3 rounded-2 ${viewMode === 'classic' ? 'btn-white shadow-sm' : 'btn-transparent text-muted'}`} onClick={() => setViewMode('classic')}>
                            <i className="fa-solid fa-table-list me-2"></i>Classic
                        </button>
                        <button className={`btn btn-sm px-3 rounded-2 ${viewMode === 'modern' ? 'btn-white shadow-sm' : 'btn-transparent text-muted'}`} onClick={() => setViewMode('modern')}>
                            <i className="fa-solid fa-grip me-2"></i>Modern
                        </button>
                    </div>
                    {user?.capabilities?.canAccounting && (
                        <button className="btn btn-primary d-flex align-items-center gap-2" data-bs-toggle="modal" data-bs-target="#importModal">
                            <i className="fa-solid fa-cloud-arrow-up"></i>Import
                        </button>
                    )}
                </div>
            }
        >
            {viewMode === 'classic' ? (
                <>
                    {/* Classic View: Filters & Table */}
                    <div className="card shadow-sm border-0 mb-4 rounded-4 overflow-hidden">
                        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-bottom-light">
                            <h6 className="mb-0 fw-bold">Active Filters</h6>
                            <button className="btn btn-sm btn-light rounded-pill px-3" onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                                <i className={`fa-solid fa-sliders me-2`}></i>{isFilterExpanded ? 'Quick Hide' : 'Customize View'}
                            </button>
                        </div>
                        {isFilterExpanded && (
                            <div className="card-body p-4 bg-light-subtle">
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Timeline</label>
                                        <div className="input-group input-group-sm">
                                            <input type="date" className="form-control" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
                                            <span className="input-group-text bg-white border-start-0 border-end-0">to</span>
                                            <input type="date" className="form-control" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Account</label>
                                        <select className="form-select form-select-sm" name="accountId" value={filters.accountId} onChange={handleFilterChange}>
                                            <option value="">All Entities</option>
                                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Currency</label>
                                        <select className="form-select form-select-sm" name="currency" value={filters.currency} onChange={handleFilterChange}>
                                            <option value="">Universal</option>
                                            <option value="USD">USD ($)</option>
                                            <option value="BDT">BDT (৳)</option>
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Keyword Search</label>
                                        <div className="d-flex gap-2">
                                            <input type="text" className="form-control form-control-sm" placeholder="ID or Description..." name="search" value={filters.search} onChange={handleFilterChange} />
                                            <button className="btn btn-dark btn-sm px-4" onClick={fetchTransactions}>Apply</button>
                                            <button className="btn btn-outline-secondary btn-sm" onClick={handleResetFilters}><i className="fa-solid fa-rotate-left"></i></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
                        <div className="table-responsive">
                            <table className="table align-middle m-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="ps-4 py-3">ID</th>
                                        <th className="py-3">Timestamp</th>
                                        <th className="py-3">Description</th>
                                        <th className="py-3">Account</th>
                                        <th className="text-end py-3">Cash Out (-)</th>
                                        <th className="text-end py-3">Cash In (+)</th>
                                        <th className="text-center py-3">Units</th>
                                        <th className="pe-4 py-3 text-center">Act</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedAndFilteredTransactions.map((t, idx) => (
                                        <tr key={t.id} className="border-bottom-light">
                                            <td className="ps-4">
                                                <span className="badge bg-light text-dark font-monospace">{t.trx_id || `TXN-${t.serial_number}`}</span>
                                            </td>
                                            <td>
                                                <div className="small fw-bold">{new Date(t.date).toLocaleDateString()}</div>
                                                <div className="text-muted" style={{ fontSize: '0.7rem' }}>{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td><div className="fw-medium text-dark">{t.description}</div></td>
                                            <td><div className="small text-muted">{t.account?.name}</div></td>
                                            <td className="text-end text-danger fw-bold">{t.type === 'Debit' ? t.amount.toLocaleString() : '-'}</td>
                                            <td className="text-end text-success fw-bold">{t.type === 'Credit' ? t.amount.toLocaleString() : '-'}</td>
                                            <td className="text-center"><span className={`badge rounded-pill ${t.currency === 'USD' ? 'bg-success' : 'bg-primary'}`}>{t.currency}</span></td>
                                            <td className="pe-4 text-center">
                                                {t.attachments?.length > 0 && (
                                                    <button className="btn btn-link btn-sm text-primary p-0" onClick={() => setViewingAttachment(t)}><i className="fa-solid fa-paperclip"></i></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                /* Modern View: Split Dashboard */
                <div className="row g-4 modern-ledger-container">
                    {/* Left Sidebar: Monthly Balances */}
                    <div className="col-md-4">
                        <div className="card border-0 shadow-lg rounded-4 h-100 overflow-hidden bg-dark-deep text-white">
                            <div className="p-4 border-bottom border-secondary border-opacity-25">
                                <div className="d-flex align-items-center mb-4">
                                    <div className="bg-primary rounded-circle p-2 me-3"><i className="fa-solid fa-chart-line text-white"></i></div>
                                    <h5 className="mb-0 fw-bold">Monthly Balances</h5>
                                </div>
                                <select className="form-select bg-dark border-secondary text-white rounded-3 mb-2" defaultValue="2024">
                                    <option value="2024">Fiscal Year 2024</option>
                                    <option value="2023">Fiscal Year 2023</option>
                                </select>
                            </div>
                            <div className="p-2 flex-grow-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                                {monthlySummaries.map(([key, data]) => (
                                    <div
                                        key={key}
                                        className={`p-3 rounded-4 mb-2 cursor-pointer transition-all ${selectedMonth === key ? 'bg-primary shadow-lg' : 'hover-bg-dark'}`}
                                        onClick={() => setSelectedMonth(selectedMonth === key ? null : key)}
                                    >
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span className={`fw-bold ${selectedMonth === key ? 'text-white' : 'text-light'}`}>{data.name}</span>
                                            <span className="badge bg-white bg-opacity-10 text-white-50 small">View Feed</span>
                                        </div>
                                        <div className="row g-0 small opacity-75">
                                            <div className="col-6 border-end border-secondary border-opacity-25 ps-1">
                                                <div className="text-uppercase x-small ls-1">Project Volume</div>
                                                <div className="fw-bold fs-7">৳ {data.credit.toLocaleString()}</div>
                                            </div>
                                            <div className="col-6 ps-3">
                                                <div className="text-uppercase x-small ls-1">Revenue Share</div>
                                                <div className="fw-bold fs-7">৳ {data.debit.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Content: Stats & Feed */}
                    <div className="col-md-8">
                        {/* Summary Header */}
                        <div className="d-flex justify-content-between align-items-end mb-4">
                            <div>
                                <h2 className="fw-bold mb-1">{selectedMonth ? monthlySummaries.find(m => m[0] === selectedMonth)?.[1].name : 'Overall Registry'}</h2>
                                <span className="text-muted"><i className="fa-solid fa-filter me-2"></i>{sortedAndFilteredTransactions.length} Record(s) Selected</span>
                            </div>
                            <button className="btn btn-outline-dark btn-sm rounded-pill px-3" onClick={handleExport}>
                                <i className="fa-solid fa-download me-2"></i>Download Statement
                            </button>
                        </div>

                        {/* Top Stats Cards */}
                        <div className="row g-3 mb-4">
                            <div className="col-md-4">
                                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border-start border-success border-4">
                                    <div className="text-muted small fw-bold mb-1">TOTAL CREDITS</div>
                                    <div className="h4 fw-bold text-success mb-0">৳ {stats.credit.toLocaleString()}</div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border-start border-danger border-4">
                                    <div className="text-muted small fw-bold mb-1">TOTAL DEBITS</div>
                                    <div className="h4 fw-bold text-danger mb-0">৳ {stats.debit.toLocaleString()}</div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border-start border-primary border-4">
                                    <div className="text-muted small fw-bold mb-1">NET MOVEMENT</div>
                                    <div className={`h4 fw-bold mb-0 ${stats.credit - stats.debit >= 0 ? 'text-primary' : 'text-warning'}`}>
                                        ৳ {(stats.credit - stats.debit).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Feed List */}
                        <div className="transaction-feed">
                            {sortedAndFilteredTransactions.map((t, idx) => (
                                <div key={t.id} className="card border-0 shadow-sm rounded-4 mb-3 bg-white hover-up overflow-hidden transition-all">
                                    <div className="card-body p-3 d-flex align-items-center">
                                        <div className="me-3 p-3 bg-light rounded-4 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                                            <i className={`fa-solid ${t.type === 'Credit' ? 'fa-arrow-down-long text-success' : 'fa-arrow-up-long text-danger'} fs-4`}></i>
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className="d-flex justify-content-between">
                                                <h6 className="mb-0 fw-bold">{t.description}</h6>
                                                <h6 className={`mb-0 fw-bolder ${t.type === 'Credit' ? 'text-success' : 'text-danger'}`}>
                                                    {t.type === 'Credit' ? '+' : '-'} {t.currency === 'USD' ? '$' : '৳'} {t.amount.toLocaleString()}
                                                </h6>
                                            </div>
                                            <div className="d-flex align-items-center mt-1">
                                                <span className="text-muted small me-3 font-monospace">{t.trx_id || `TXN-${t.serial_number}`}</span>
                                                <span className="small text-muted me-3">
                                                    <i className="fa-regular fa-calendar-check me-1"></i> {new Date(t.date).toLocaleDateString()}
                                                </span>
                                                <span className={`badge rounded-pill px-2 ${t.type === 'Credit' ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`} style={{ fontSize: '0.65rem' }}>
                                                    {t.type === 'Credit' ? 'Deposited' : 'Withdrawal'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="ms-3 ps-3 border-start">
                                            {t.attachments?.length > 0 ? (
                                                <button className="btn btn-light rounded-circle p-2" onClick={() => setViewingAttachment(t)}>
                                                    <i className="fa-solid fa-paperclip text-primary"></i>
                                                </button>
                                            ) : (
                                                <div className="p-2 opacity-10"><i className="fa-solid fa-ban"></i></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <ImportTransactionsModal onImported={fetchTransactions} />
            <ViewAttachmentModal item={viewingAttachment} onClose={() => setViewingAttachment(null)} />
        </Layout>
    );
};


export default Ledger;