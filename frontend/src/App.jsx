import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MainLayout from './components/MainLayout';
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
import OnboardingManagement from './pages/hr/OnboardingManagement';

// Employee Portal (Unified)
import ESSDashboard from './pages/portal/ESSDashboard';
import MyAttendance from './pages/portal/MyAttendance';
import MyLeaves from './pages/portal/MyLeaves';
import MyProfile from './pages/portal/MyProfile';
// Manager Module
import ManagerLeaves from './pages/portal/manager/ManagerLeaves';
import ManagerTeam from './pages/portal/manager/ManagerTeam';
import ApplyForTeam from './pages/portal/manager/ApplyForTeam';

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

      <Route element={<MainLayout />}>
        <Route
          path="/"
          element={
            user?.role === 'ESS' ? (
              <ProtectedRoute module="ESS">
                <ESSDashboard />
              </ProtectedRoute>
            ) : (
              <ProtectedRoute module="Dashboard">
                <Dashboard />
              </ProtectedRoute>
            )
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
          path="/hr/onboarding"
          element={
            <ProtectedRoute module="HR">
              <OnboardingManagement />
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
        <Route
          path="/ess"
          element={
            <ProtectedRoute module="ESS">
              <ESSDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-attendance"
          element={
            <ProtectedRoute module="ESS">
              <MyAttendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-leaves"
          element={
            <ProtectedRoute module="ESS">
              <MyLeaves />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-profile"
          element={
            <ProtectedRoute module="ESS">
              <MyProfile />
            </ProtectedRoute>
          }
        />

        {/* Manager/Approver Routes */}
        <Route
          path="/approvals/leaves"
          element={
            <ProtectedRoute module="Approvals">
              <ManagerLeaves />
            </ProtectedRoute>
          }
        />
        <Route
          path="/approvals/team"
          element={
            <ProtectedRoute module="Approvals">
              <ManagerTeam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/approvals/apply-for"
          element={
            <ProtectedRoute module="Approvals">
              <ApplyForTeam />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch All - 404 */}
      <Route path="*" element={<div className="d-flex justify-content-center align-items-center vh-100"><h3>404 | Page Not Found</h3></div>} />
    </Routes>
  );
}

export default App;
