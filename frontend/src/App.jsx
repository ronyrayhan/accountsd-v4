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
// HR Module - New Pages
import HRDashboard from './pages/hr/HRDashboard';
import EmployeeList from './pages/hr/EmployeeList';
import EmployeeProfile from './pages/hr/EmployeeProfile';
import EmployeeForm from './pages/hr/EmployeeForm';
import AttendanceManagement from './pages/hr/AttendanceManagement';
import LeaveManagement from './pages/hr/LeaveManagement';
import LeaveSettings from './pages/hr/LeaveSettings';
import ShiftManagement from './pages/hr/ShiftManagement';
import PunchSimulator from './pages/hr/PunchSimulator';

// Employee Portal
import PortalLogin from './pages/portal/PortalLogin';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalLeave from './pages/portal/PortalLeave';

// HR Module - New Pages

import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import { useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
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
            <HRDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/employees"
        element={
          <ProtectedRoute module="HR">
            <EmployeeList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/employees/new"
        element={
          <ProtectedRoute module="HR">
            <EmployeeForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/employees/:id/edit"
        element={
          <ProtectedRoute module="HR">
            <EmployeeForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/employees/:id"
        element={
          <ProtectedRoute module="HR">
            <EmployeeProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/attendance"
        element={
          <ProtectedRoute module="HR">
            <AttendanceManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/leaves"
        element={
          <ProtectedRoute module="HR">
            <LeaveManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/leave-settings"
        element={
          <ProtectedRoute module="HR">
            <LeaveSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/shifts"
        element={
          <ProtectedRoute module="HR">
            <ShiftManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/simulator"
        element={
          <ProtectedRoute module="HR">
            <PunchSimulator />
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

      {/* Employee Portal - Isolated Module */}
      <Route path="/portal/login" element={<PortalLogin />} />
      <Route path="/portal/dashboard" element={<PortalDashboard />} />
      <Route path="/portal/leaves" element={<PortalLeave />} />
    </Routes>
  );
}

export default App;
