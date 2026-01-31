import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, roles = [], module = null }) => {
    const { user, loading } = useAuth();

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center vh-100">
            <div className="spinner-border text-primary" role="status"></div>
        </div>
    );

    if (!user) {
        return <Navigate to="/login" />;
    }

    // Role-based check (if specific roles are required like 'Admin')
    if (roles.length && !roles.includes(user.role)) {
        return <Navigate to="/" />;
    }

    // Module-based check
    if (module && user.role !== 'Admin') {
        const hasModuleAccess = user.modules?.includes(module);
        if (!hasModuleAccess) {
            return <Navigate to="/" />;
        }
    }

    return children;
};

export default ProtectedRoute;
