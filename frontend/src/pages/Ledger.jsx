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

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredTransactions = useMemo(() => {
        return [...transactions].sort((a, b) => {
            let valA, valB;

            switch (sortConfig.key) {
                case 'sn':
                    valA = a.serial_number || 0;
                    valB = b.serial_number || 0;
                    break;
                case 'account':
                    valA = a.account?.name || '';
                    valB = b.account?.name || '';
                    break;
                case 'amount':
                    valA = parseFloat(a.amount) || 0;
                    valB = parseFloat(b.amount) || 0;
                    break;
                default: // date
                    valA = new Date(a.date).getTime();
                    valB = new Date(b.date).getTime();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [transactions, sortConfig]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleResetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            accountId: '',
            currency: '',
            type: '',
            search: ''
        });
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

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <i className="fa-solid fa-sort text-muted ms-1 small opacity-50"></i>;
        return sortConfig.direction === 'asc'
            ? <i className="fa-solid fa-sort-up text-primary ms-1 small"></i>
            : <i className="fa-solid fa-sort-down text-primary ms-1 small"></i>;
    };

    const getTotals = useMemo(() => {
        return sortedAndFilteredTransactions.reduce((acc, transaction) => {
            if (transaction.type === 'Debit') {
                acc.debit += parseFloat(transaction.amount) || 0;
            } else if (transaction.type === 'Credit') {
                acc.credit += parseFloat(transaction.amount) || 0;
            }
            return acc;
        }, { debit: 0, credit: 0 });
    }, [sortedAndFilteredTransactions]);

    if (loading) return (
        <Layout title="Transaction Ledger">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        </Layout>
    );

    return (
        <Layout
            title="Transaction Ledger"
            actions={
                <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-outline-success d-flex align-items-center gap-2" onClick={handleExport}>
                        <i className="fa-solid fa-file-excel"></i>
                        Export Report
                    </button>
                    {user?.capabilities?.canAccounting && (
                        <button className="btn btn-outline-primary d-flex align-items-center gap-2" data-bs-toggle="modal" data-bs-target="#importModal">
                            <i className="fa-solid fa-file-import"></i>
                            Import
                        </button>
                    )}
                </div>
            }
        >
            {/* Filter Section */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Filters</h6>
                    <button 
                        className="btn btn-sm btn-link text-decoration-none"
                        onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                    >
                        <i className={`fa-solid fa-chevron-${isFilterExpanded ? 'up' : 'down'} me-1`}></i>
                        {isFilterExpanded ? 'Hide' : 'Show'} Filters
                    </button>
                </div>
                
                {isFilterExpanded && (
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label small fw-medium">Start Date</label>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="startDate"
                                    value={filters.startDate}
                                    onChange={handleFilterChange}
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small fw-medium">End Date</label>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="endDate"
                                    value={filters.endDate}
                                    onChange={handleFilterChange}
                                    min={filters.startDate}
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small fw-medium">Account</label>
                                <select
                                    className="form-select form-select-sm"
                                    name="accountId"
                                    value={filters.accountId}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">All Accounts</option>
                                    {accounts.map(account => (
                                        <option key={account.id} value={account.id}>
                                            {account.name} ({account.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small fw-medium">Currency</label>
                                <select
                                    className="form-select form-select-sm"
                                    name="currency"
                                    value={filters.currency}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">All Currencies</option>
                                    <option value="USD">USD</option>
                                    <option value="BDT">BDT</option>
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small fw-medium">Type</label>
                                <select
                                    className="form-select form-select-sm"
                                    name="type"
                                    value={filters.type}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">All Types</option>
                                    <option value="Credit">Credit</option>
                                    <option value="Debit">Debit</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-medium">Search</label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Search by description or TRX ID..."
                                    name="search"
                                    value={filters.search}
                                    onChange={handleFilterChange}
                                />
                            </div>
                            <div className="col-md-3 d-flex align-items-end">
                                <div className="d-flex gap-2 w-100">
                                    <button className="btn btn-primary btn-sm flex-grow-1" onClick={fetchTransactions}>
                                        <i className="fa-solid fa-filter me-1"></i>
                                        Apply Filters
                                    </button>
                                    <button className="btn btn-outline-secondary btn-sm" onClick={handleResetFilters}>
                                        <i className="fa-solid fa-rotate-left"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            
            {/* Transactions Table */}
            <div className="card shadow-sm border-0 overflow-hidden">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table align-middle m-0">
                            <thead className="table-light">
                                <tr>
                                    <th className="ps-4 cursor-pointer" style={{ width: '90px' }} onClick={() => handleSort('sn')}>
                                        S.N {getSortIcon('sn')}
                                    </th>
                                    <th style={{ width: '100px' }}>TRX ID</th>
                                    <th className="cursor-pointer" style={{ width: '180px' }} onClick={() => handleSort('date')}>
                                        Date & Time {getSortIcon('date')}
                                    </th>
                                    <th>Description</th>
                                    <th className="cursor-pointer" onClick={() => handleSort('account')}>
                                        Account {getSortIcon('account')}
                                    </th>
                                    <th className="text-end cursor-pointer" onClick={() => handleSort('amount')}>
                                        Debit {getSortIcon('amount')}
                                    </th>
                                    <th className="text-end">Credit</th>
                                    <th className="text-center">Currency</th>
                                    <th className="pe-4 text-center">Doc</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAndFilteredTransactions.map((t, index) => (
                                    <tr key={t.id}>
                                        <td className="ps-4">
                                            <span className="text-muted fw-bold" style={{ fontSize: '0.75rem' }}>
                                                {t.serial_number || index + 1}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge bg-primary-light text-primary border px-2 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>
                                                {t.trx_id || 'N/A'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="fw-bold text-bright" style={{ fontSize: '0.85rem' }}>
                                                {new Date(t.date).toLocaleDateString()}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                <i className="fa-regular fa-clock me-1"></i>
                                                {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className={`rounded-circle d-flex align-items-center justify-content-center ${t.type === 'Credit' ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`} 
                                                     style={{ width: '24px', height: '24px', flexShrink: 0 }}>
                                                    <i className={`fa-solid ${t.type === 'Credit' ? 'fa-plus' : 'fa-minus'} small`} style={{ fontSize: '0.6rem' }}></i>
                                                </div>
                                                <div className="fw-medium text-bright">{t.description}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="small fw-medium">{t.account?.name || 'Unknown'}</div>
                                            <div className="text-muted small" style={{ fontSize: '0.65rem' }}>{t.account?.code}</div>
                                        </td>
                                        <td className="text-end">
                                            {t.type === 'Debit' ? (
                                                <span className="text-danger fw-bold">
                                                    {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="text-end">
                                            {t.type === 'Credit' ? (
                                                <span className="text-success fw-bold">
                                                    {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="text-center">
                                            <span className={`badge rounded-pill px-3 py-1 fw-bold ${t.currency === 'USD' ? 'bg-success text-white' : 'bg-primary text-white'}`} 
                                                  style={{ fontSize: '0.75rem', minWidth: '50px', display: 'inline-block' }}>
                                                {t.currency}
                                            </span>
                                        </td>
                                        <td className="pe-4 text-center">
                                            {t.attachments && t.attachments.length > 0 ? (
                                                <button
                                                    className="btn btn-sm btn-primary rounded-circle shadow-sm"
                                                    onClick={() => setViewingAttachment(t)}
                                                    title={`${t.attachments.length} attachment(s)`}
                                                >
                                                    <i className="fa-solid fa-paperclip" style={{ fontSize: '0.7rem' }}></i>
                                                </button>
                                            ) : (
                                                <span className="text-muted">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {sortedAndFilteredTransactions.length === 0 && !loading && (
                <div className="text-center py-5 mt-4 card border-0 shadow-sm">
                    <i className="fa-solid fa-search fs-1 mb-3 text-muted opacity-20"></i>
                    <h5 className="text-muted mb-2">No transactions found</h5>
                    <p className="text-muted">Try adjusting your filters or import some transactions.</p>
                </div>
            )}

            <ImportTransactionsModal onImported={fetchTransactions} />
            <ViewAttachmentModal item={viewingAttachment} onClose={() => setViewingAttachment(null)} />
        </Layout>
    );
};

export default Ledger;