import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';

const PunchSimulator = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [cards, setCards] = useState([]);
    const [selectedCard, setSelectedCard] = useState('');
    const [deviceId, setDeviceId] = useState('SIMULATOR_WEB_01');
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/hr/employees');
            setEmployees(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching employees:', err);
            setLoading(false);
        }
    };

    const handleEmployeeChange = (e) => {
        const empId = e.target.value;
        setSelectedEmployee(empId);

        const emp = employees.find(e => e._id === empId);
        if (emp && emp.rfid_card_number) {
            setCards([emp.rfid_card_number]);
            setSelectedCard(emp.rfid_card_number);
        } else {
            setCards([]);
            setSelectedCard('');
        }
    };

    const handlePunch = async () => {
        if (!selectedCard) return;

        try {
            const payload = {
                rfid_card_number: selectedCard,
                device_id: deviceId,
                timestamp: new Date()
            };

            const res = await api.post('/hr/attendance/rfid-punch', payload, {
                headers: {
                    'x-device-api-key': 'default_esp32_key_change_in_production'
                }
            });

            addLog({
                type: 'success',
                message: res.data.message,
                data: res.data
            });
        } catch (error) {
            addLog({
                type: 'error',
                message: error.response?.data?.message || 'Punch failed',
                data: error.response?.data
            });
        }
    };

    const addLog = (log) => {
        setLogs(prev => [{
            id: Date.now(),
            timestamp: new Date(),
            ...log
        }, ...prev]);
    };

    return (
        <Layout title="RFID Punch Simulator">
            <div className="row">
                <div className="col-md-6">
                    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                        <h5 className="fw-bold mb-4">Device Simulator</h5>

                        <div className="mb-3">
                            <label className="form-label text-muted small fw-bold">Select Employee</label>
                            <select
                                className="form-select rounded-pill"
                                value={selectedEmployee}
                                onChange={handleEmployeeChange}
                            >
                                <option value="">-- Choose Employee --</option>
                                {employees.map(emp => (
                                    <option key={emp._id} value={emp._id}>
                                        {emp.personal_info.full_name} ({emp.employee_id})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedEmployee && (
                            <div className="mb-4">
                                <label className="form-label text-muted small fw-bold">RFID Card</label>
                                <select
                                    className="form-select rounded-pill font-monospace"
                                    value={selectedCard}
                                    onChange={e => setSelectedCard(e.target.value)}
                                    disabled={cards.length === 0}
                                >
                                    {cards.length > 0 ? (
                                        cards.map(card => <option key={card} value={card}>{card}</option>)
                                    ) : (
                                        <option>No RFID Card Linked</option>
                                    )}
                                </select>
                                {cards.length === 0 && (
                                    <div className="form-text text-danger">
                                        <i className="fa-solid fa-circle-exclamation me-1"></i>
                                        This employee does not have an RFID card linked.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="form-label text-muted small fw-bold">Device ID</label>
                            <input
                                type="text"
                                className="form-control rounded-pill"
                                value={deviceId}
                                onChange={e => setDeviceId(e.target.value)}
                            />
                        </div>

                        <button
                            className="btn btn-primary w-100 rounded-pill py-3 fw-bold shadow-sm"
                            onClick={handlePunch}
                            disabled={!selectedCard}
                        >
                            <i className="fa-solid fa-fingerprint me-2"></i>
                            SIMULATE PUNCH
                        </button>
                    </div>
                </div>

                <div className="col-md-6">
                    <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                        <div className="card-header bg-light border-bottom p-3">
                            <h6 className="fw-bold mb-0 text-muted">Simulation Logs</h6>
                        </div>
                        <div className="card-body p-0 overflow-auto" style={{ maxHeight: '400px' }}>
                            {logs.length === 0 ? (
                                <div className="text-center text-muted opacity-50 py-5">
                                    <i className="fa-solid fa-terminal fs-1 mb-2"></i>
                                    <div>Waiting for punches...</div>
                                </div>
                            ) : (
                                <div className="list-group list-group-flush">
                                    {logs.map(log => (
                                        <div key={log.id} className="list-group-item p-3">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <span className={`badge ${log.type === 'success' ? 'bg-success' : 'bg-danger'} rounded-pill`}>
                                                    {log.type === 'success' ? 'SUCCESS' : 'ERROR'}
                                                </span>
                                                <small className="text-muted font-monospace" style={{ fontSize: '0.7rem' }}>
                                                    {log.timestamp.toLocaleTimeString()}
                                                </small>
                                            </div>
                                            <div className="fw-bold small mb-1">{log.message}</div>
                                            {log.data && (
                                                <pre className="bg-light p-2 rounded small mb-0 mt-2 text-muted border" style={{ fontSize: '0.7rem', maxHeight: '100px', overflow: 'auto' }}>
                                                    {JSON.stringify(log.data, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default PunchSimulator;
