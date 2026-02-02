import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
    const { user, logout } = useAuth();
    // Initialize state from localStorage so it persists across page reloads/navigation
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    });

    const toggleSidebar = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('sidebarCollapsed', newState);
    };

    return (
        <nav id="sidebar" className={isCollapsed ? 'collapsed' : ''}>

            {/* Toggle Button (Floating on the edge) */}
            <button className="toggle-btn" onClick={toggleSidebar}>
                <i className={`fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
            </button>

            {/* Brand */}
            <div className="sidebar-brand">
                <i className="fa-solid fa-rocket text-primary fs-3"></i>
                <span className="text-truncate">{user?.settings?.site_brand || 'AccountsD'}</span>
            </div>

            {/* Navigation Menu */}
            <div className="flex-grow-1 overflow-auto" style={{ scrollbarWidth: 'none' }}>
                {(user?.navigation || []).map((group, groupIdx) => (
                    <React.Fragment key={groupIdx}>
                        {/* Section Header */}
                        <div className={`menu-header ${groupIdx > 0 ? 'mt-4' : ''}`}>
                            {group.title}
                        </div>

                        {/* Links */}
                        {group.items.map((item, itemIdx) => (
                            <NavLink
                                key={itemIdx}
                                to={item.path}
                                end={item.path === '/' || item.path === '/hr'} /* Ensure strict matching for dashboard paths */
                                title={isCollapsed ? item.label : ''} /* Tooltip on hover when collapsed */
                                className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
                            >
                                <i className={item.icon}></i>
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </React.Fragment>
                ))}
            </div>

            {/* Profile Footer */}
            <div className="user-profile-section">
                <div className="user-info">
                    <div className="avatar-circle">
                        {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="overflow-hidden">
                        <div className="text-white fw-bold text-truncate small">{user?.username}</div>
                        <div className="text-muted small text-truncate" style={{ fontSize: '0.75rem' }}>
                            {user?.role}
                        </div>
                    </div>
                </div>
                <button className="btn-signout" onClick={logout} title="Sign Out">
                    <i className="fa-solid fa-power-off"></i>
                    <span className="ms-2">Sign Out</span>
                </button>
            </div>
        </nav>
    );
};

export default Sidebar;