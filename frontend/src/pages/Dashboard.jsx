import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/axios';
import { AccountModal, TransactionModal } from '../components/Modals';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        bdt: { debit: {}, credit: {} },
        usd: { debit: {}, credit: {} }
    });
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [accRes, statsRes] = await Promise.all([
                api.get('/accounts'),
                api.get('/stats/accounts')
            ]);
            setAccounts(accRes.data || []);
            const statsData = statsRes.data || {};
            setStats({
                bdt: { debit: {}, credit: {}, ...(statsData.bdt || {}) },
                usd: { debit: {}, credit: {}, ...(statsData.usd || {}) }
            });
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const totalBdtAssets = accounts.reduce((acc, curr) => acc + Number(curr.current_balance_bdt || 0), 0);
    const totalUsdAssets = accounts.reduce((acc, curr) => acc + Number(curr.current_balance_usd || 0), 0);

    const bdtDebits = stats?.bdt?.debit || {};
    const bdtCredits = stats?.bdt?.credit || {};
    const usdDebits = stats?.usd?.debit || {};
    const usdCredits = stats?.usd?.credit || {};

    const totalBdtSpend = Object.values(bdtDebits).reduce((acc, curr) => acc + Number(curr || 0), 0);
    const totalBdtCreditsAll = Object.values(bdtCredits).reduce((acc, curr) => acc + Number(curr || 0), 0);
    const totalUsdSpend = Object.values(usdDebits).reduce((acc, curr) => acc + Number(curr || 0), 0);
    const totalUsdCreditsAll = Object.values(usdCredits).reduce((acc, curr) => acc + Number(curr || 0), 0);

    if (loading) return (
        <Layout title="Pulse Dashboard">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        </Layout>
    );

    return (
        <Layout
            title="Pulse Dashboard"
            actions={
                <div className="d-flex gap-3">
                    {user?.capabilities?.canAccounting && (
                        <>
                            <button className="btn btn-outline-secondary" onClick={async () => {
                                if (window.confirm('Recalculate all account balances from transaction history?')) {
                                    try {
                                        await api.post('/accounts/recalculate');
                                        fetchData();
                                        alert('Balances successfully synchronized with transactions!');
                                    } catch (err) { alert('Sync failed'); }
                                }
                            }}>
                                <i className="fa-solid fa-sync me-1"></i> Sync Balances
                            </button>
                            <button className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#transactionModal">
                                <i className="fa-solid fa-plus me-1"></i> New Entry
                            </button>
                            <button className="btn btn-outline-dark d-flex align-items-center" data-bs-toggle="modal" data-bs-target="#accountModal">
                                <i className="fa-solid fa-building-columns me-2 small"></i> New Account
                            </button>
                        </>
                    )}
                </div>
            }
        >
            <div className="row g-4 mb-5">
                <div className="col-md-6">
                    <div className="card p-4 border-0">
                        <div className="d-flex justify-content-between">
                            <div>
                                <h6 className="text-muted fw-bold text-uppercase mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>Total Remaining (BDT)</h6>
                                <h2 className="fw-bold text-bright mb-0" style={{ fontSize: '2.5rem' }}>{totalBdtAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                            </div>
                            <div className="stats-icon-box">
                                <i className="fa-solid fa-building-columns fs-5"></i>
                            </div>
                        </div>
                        <div className="mt-4 pt-3 border-top" style={{ borderColor: '#f1f5f9' }}></div>
                        <div className="d-flex justify-content-between align-items-end">
                            <div className="d-flex gap-4">
                                <div>
                                    <span className="text-muted small d-block mb-1">Total Credited</span>
                                    <div className="fw-bold text-success" style={{ fontSize: '1rem' }}>{totalBdtCreditsAll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                                <div>
                                    <span className="text-muted small d-block mb-1">Total Spend</span>
                                    <div className="fw-bold text-danger" style={{ fontSize: '1rem' }}>{totalBdtSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                            </div>
                            <div className="d-flex align-items-center gap-3">
                                <span className="badge bg-success-light text-success px-3 py-2 rounded-pill d-flex align-items-center">
                                    <i className="fa-solid fa-bolt me-1 small"></i> Assets
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-6">
                    <div className="card p-4 border-0">
                        <div className="d-flex justify-content-between">
                            <div>
                                <h6 className="text-muted fw-bold text-uppercase mb-2" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>Total Remaining (USD)</h6>
                                <h2 className="fw-bold text-bright mb-0" style={{ fontSize: '2.5rem' }}>${totalUsdAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                            </div>
                            <div className="stats-icon-box">
                                <i className="fa-solid fa-earth-americas fs-5"></i>
                            </div>
                        </div>
                        <div className="mt-4 pt-3 border-top" style={{ borderColor: '#f1f5f9' }}></div>
                        <div className="d-flex justify-content-between align-items-end">
                            <div className="d-flex gap-4">
                                <div>
                                    <span className="text-muted small d-block mb-1">Total Credited</span>
                                    <div className="fw-bold text-success" style={{ fontSize: '1rem' }}>${totalUsdCreditsAll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                                <div>
                                    <span className="text-muted small d-block mb-1">Total Spend</span>
                                    <div className="fw-bold text-danger" style={{ fontSize: '1rem' }}>${totalUsdSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                            </div>
                            <div className="d-flex align-items-center gap-3">
                                <span className="badge bg-success-light text-success px-3 py-2 rounded-pill d-flex align-items-center">
                                    <i className="fa-solid fa-bolt me-1 small"></i> Treasury
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="fw-bold m-0 text-bright">Account Portfolios</h4>
                <div className="text-muted small fw-medium">Real-time balances</div>
            </div>

            <div className="row g-4">
                {accounts.map(a => (
                    <div className="col-xl-4 col-md-6" key={a.id}>
                        <div className="card h-100 p-4 border-0">
                            <div className="d-flex justify-content-between align-items-start mb-4">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="account-icon-box shadow-sm">
                                        <i className="fa-solid fa-wallet small"></i>
                                    </div>
                                    <div>
                                        <div className="text-muted fw-bold" style={{ fontSize: '0.6rem', letterSpacing: '1px' }}>{a.code}</div>
                                        <h5 className="m-0 fw-bold text-bright">{a.name}</h5>
                                    </div>
                                </div>
                                <div className="d-flex flex-column align-items-end gap-2">
                                    <span className="badge bg-light text-muted border py-1 mb-0 small" style={{ fontSize: '0.7rem' }}>{a.subtype}</span>
                                    {user?.capabilities?.canStatements && (
                                        <Link to={`/statement/${a.id}`} className="btn btn-link p-0 text-primary small fw-bold" style={{ fontSize: '0.75rem', textDecoration: 'none' }}>
                                            <i className="fa-solid fa-file-invoice me-1"></i> Statement
                                        </Link>
                                    )}
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col-12 mb-1">
                                    <div className="balance-card-inner bg-light-subtle d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted small fw-bold">Remaining BDT</span>
                                        <span className={`fw-bold ${Number(a.current_balance_bdt) < 0 ? 'text-danger' : 'text-main'}`}>
                                            {Number(a.current_balance_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="balance-card-inner bg-light-subtle d-flex justify-content-between align-items-center py-2 px-3 mt-1">
                                        <span className="text-muted small fw-bold">Remaining USD</span>
                                        <span className={`fw-bold ${Number(a.current_balance_usd) < 0 ? 'text-danger' : 'text-primary'}`}>
                                            ${Number(a.current_balance_usd).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="balance-card-inner py-2 px-3 mb-1 bg-success-light bg-opacity-10 border-0">
                                        <div className="text-muted" style={{ fontSize: '0.65rem', fontWeight: 800 }}>BDT CREDIT</div>
                                        <div className="fw-bold text-success" style={{ fontSize: '0.95rem' }}>
                                            {(bdtCredits[a.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div className="balance-card-inner py-2 px-3 bg-danger-light bg-opacity-10 border-0">
                                        <div className="text-muted" style={{ fontSize: '0.65rem', fontWeight: 800 }}>BDT SPEND</div>
                                        <div className="fw-bold text-danger" style={{ fontSize: '0.95rem' }}>
                                            -{(bdtDebits[a.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="balance-card-inner py-2 px-3 mb-1 bg-success-light bg-opacity-10 border-0">
                                        <div className="text-muted" style={{ fontSize: '0.65rem', fontWeight: 800 }}>USD CREDIT</div>
                                        <div className="fw-bold text-success" style={{ fontSize: '0.95rem' }}>
                                            ${(usdCredits[a.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div className="balance-card-inner py-2 px-3 bg-danger-light bg-opacity-10 border-0">
                                        <div className="text-muted" style={{ fontSize: '0.65rem', fontWeight: 800 }}>USD SPEND</div>
                                        <div className="fw-bold text-danger" style={{ fontSize: '0.95rem' }}>
                                            -${(usdDebits[a.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <AccountModal onAccountCreated={fetchData} />
            <TransactionModal accounts={accounts} onTransactionCreated={fetchData} />
        </Layout>
    );
};

export default Dashboard;
