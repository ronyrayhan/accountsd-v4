import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Ledger from './pages/Ledger';
import Reports from './pages/Reports';
import Logs from './pages/Logs';
import AccountStatement from './pages/AccountStatement';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Payroll from './pages/Payroll';
import AccountSummaries from './pages/AccountSummaries';
import AssetTracking from './pages/AssetTracking';
import ActiveSessions from './pages/ActiveSessions';
import HRManagement from './pages/HRManagement';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute module="Dashboard">
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ledger"
            element={
              <ProtectedRoute module="Ledger">
                <Ledger />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute module="Reports">
                <Reports />
              </ProtectedRoute>
            }
          />

          <Route
            path="/logs"
            element={
              <ProtectedRoute roles={['Admin']}>
                <Logs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/active-sessions"
            element={
              <ProtectedRoute roles={['Admin']}>
                <ActiveSessions />
              </ProtectedRoute>
            }
          />

          <Route
            path="/statement/:id"
            element={
              <ProtectedRoute module="Statements">
                <AccountStatement />
              </ProtectedRoute>
            }
          />


          <Route
            path="/settings"
            element={
              <ProtectedRoute module="Settings">
                <Settings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/billing"
            element={
              <ProtectedRoute module="Billing">
                <Billing />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll"
            element={
              <ProtectedRoute module="Payroll">
                <Payroll />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assets"
            element={
              <ProtectedRoute module="Assets">
                <AssetTracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr"
            element={
              <ProtectedRoute module="HR">
                <HRManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/summaries"
            element={
              <ProtectedRoute module="Summaries">
                <AccountSummaries />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
