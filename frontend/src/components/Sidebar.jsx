import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './Sidebar.css';

const Sidebar = () => {
    const { user, token, logout } = useAuth();
    // Initialize state from localStorage so it persists across page reloads/navigation
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    });
    const [reminderCount, setReminderCount] = useState(0);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [profileImgError, setProfileImgError] = useState(false);
    const scrollRef = useRef(null);
    const location = useLocation();

    const filteredNavigation = (user?.navigation || []).map(group => {
        const filteredItems = group.items.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filteredItems.length > 0 || group.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            return {
                ...group,
                items: searchQuery ? (filteredItems.length > 0 ? filteredItems : group.items) : group.items
            };
        }
        return null;
    }).filter(group => group !== null);

    // Initialize expanded groups on load
    useEffect(() => {
        if (user?.navigation) {
            const initialExpanded = {};
            // Only auto-expand if NOT collapsed (avoids popup showing on load)
            if (!isCollapsed) {
                // Always expand the first group (Main Menu)
                if (user.navigation.length > 0) {
                    initialExpanded[user.navigation[0].title] = true;
                }

                // Expand the group containing the current route
                user.navigation.forEach(group => {
                    const isActive = group.items.some(item =>
                        item.path === location.pathname ||
                        (item.path !== '/' && location.pathname.startsWith(item.path))
                    );
                    if (isActive) {
                        initialExpanded[group.title] = true;
                    }
                });

                setExpandedGroups(prev => ({ ...initialExpanded, ...prev }));
            }
        }
    }, [user?.navigation]); // Run when navigation structure loads

    const toggleGroup = (title) => {
        setExpandedGroups(prev => {
            const isOpen = !!prev[title];

            if (isCollapsed) {
                // Exclusive Accordion for Collapsed State (Popups) - only one at a time
                return { [title]: !isOpen };
            } else {
                // Multiple Open behavior for Expanded State - keep others open
                return { ...prev, [title]: !isOpen };
            }
        });
    };

    const updateIndicator = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isAtBottom = scrollHeight - scrollTop <= clientHeight + 15;
        const indicator = scrollRef.current.parentElement.querySelector('.scroll-hint');
        if (indicator) {
            indicator.style.opacity = (isAtBottom || scrollHeight <= clientHeight) ? '0' : '1';
        }
    }, []);

    const toggleSidebar = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('sidebarCollapsed', newState);

        // If collapsing, close all popups so none are open by default
        if (newState) {
            setExpandedGroups({});
        }

        setTimeout(updateIndicator, 350); // Check after transition
    };

    useEffect(() => {
        updateIndicator();
        window.addEventListener('resize', updateIndicator);
        return () => window.removeEventListener('resize', updateIndicator);
    }, [updateIndicator, user?.navigation, expandedGroups, isCollapsed]);

    useEffect(() => {
        const fetchReminders = async () => {
            if (!user || user.role === 'ESS') return;
            try {
                // Fetch increments to count upcoming ones (next 60 days)
                const res = await api.get('/payroll/increments');
                const upcoming = res.data.filter(inc => {
                    const eff = new Date(inc.effective_date);
                    const now = new Date();
                    const diff = (eff - now) / (1000 * 60 * 60 * 24);
                    return diff > 0 && diff <= 60;
                }).length;
                setReminderCount(upcoming);
            } catch (err) {
                // Silent fail if unauthorized or error
                console.error("Failed to fetch sidebar badges", err);
            }
        };
        fetchReminders();
    }, [user]);

    // Close popup when clicking outside (only relative for collapsed popups)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isCollapsed && scrollRef.current && !scrollRef.current.contains(event.target)) {
                // Close any open popups if clicking outside the sidebar menu area
                setExpandedGroups({});
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCollapsed]);

    // Reset image error state when user changes or profile picture updates
    useEffect(() => {
        setProfileImgError(false);
    }, [user?.profile_picture]);

    return (
        <nav id="sidebar" className={isCollapsed ? 'collapsed' : ''}>

            {/* Toggle Button (Floating on the edge) */}
            <button className="toggle-btn" onClick={toggleSidebar}>
                <i className={`fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
            </button>

            {/* Brand */}
            <div className="sidebar-brand">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="me-2 text-primary" style={{ width: '28px', height: '28px', fill: '#3b82f6' }}>
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
                <span className="text-truncate">{user?.settings?.site_brand || 'AccountsD'}</span>
            </div>

            {/* Search Box */}
            <div className="sidebar-search">
                {isCollapsed ? (
                    <div className="collapsed-search-trigger" onClick={toggleSidebar}>
                        <i className="fa-solid fa-magnifying-glass"></i>
                    </div>
                ) : (
                    <div className="search-wrapper">
                        <i className="fa-solid fa-magnifying-glass"></i>
                        <input
                            type="text"
                            placeholder="Search menu..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Navigation Menu */}
            <div className="menu-container position-relative flex-grow-1 overflow-hidden d-flex flex-column">
                <div
                    ref={scrollRef}
                    className="flex-grow-1 overflow-auto menu-scroll-area"
                    style={{ scrollbarWidth: 'none' }}
                    onScroll={updateIndicator}
                >
                    {(filteredNavigation).map((group, groupIdx) => (
                        <div key={groupIdx} className="nav-group-wrapper position-relative">
                            {/* Section Header */}
                            <div
                                className={`menu-header ${groupIdx > 0 ? 'mt-3' : ''} d-flex justify-content-between align-items-center user-select-none`}
                                onClick={() => toggleGroup(group.title)}
                                style={{ cursor: 'pointer', opacity: 0.9 }}
                                data-tooltip={isCollapsed ? group.title : ''}
                            >
                                <div className="d-flex align-items-center">
                                    {group.icon && <i className={`${group.icon} me-3 header-icon`}></i>}
                                    <span>{group.title}</span>
                                </div>
                            </div>

                            {/* Links */}
                            {(expandedGroups[group.title] || searchQuery) && (
                                <div className="menu-group-content mb-2">
                                    {group.items.map((item, itemIdx) => (
                                        <NavLink
                                            key={itemIdx}
                                            to={item.path}
                                            end={item.path === '/' || item.path === '/hr'} /* Ensure strict matching for dashboard paths */
                                            className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
                                        >
                                            <i className={item.icon}></i>
                                            <span className="d-flex justify-content-between align-items-center w-100">
                                                {item.label}
                                                {item.label === 'Payroll Center' && reminderCount > 0 && (
                                                    <span className="badge bg-danger rounded-pill x-small px-2" style={{ fontSize: '0.7em' }}>{reminderCount}</span>
                                                )}
                                            </span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {/* Neon Glow Indicator for more content */}
                <div className="scroll-hint" style={{ transition: 'opacity 0.3s', pointerEvents: 'none', opacity: 0 }}>
                    <div className="neon-indicator"></div>
                </div>
            </div>

            {/* Profile Footer */}
            <div className="user-profile-section">
                <div className="user-info">
                    <NavLink to="/my-profile" className="avatar-circle text-decoration-none flex-shrink-0">
                        {user?.profile_picture && !profileImgError ? (
                            <img
                                src={`${api.defaults.baseURL}/files/${user.profile_picture}?token=${token}`}
                                alt="Profile"
                                className="w-100 h-100 d-block"
                                style={{ objectFit: 'cover', minWidth: '100%', minHeight: '100%' }}
                                onError={() => setProfileImgError(true)}
                            />
                        ) : (
                            user?.username?.[0]?.toUpperCase() || 'U'
                        )}
                    </NavLink>
                    <div className="user-text">
                        <NavLink to="/my-profile" className="text-white fw-bold text-truncate small d-block text-decoration-none hover-link" style={{ maxWidth: '100px' }}>{user?.username}</NavLink>
                        <div className="text-muted small text-truncate" style={{ fontSize: '0.75rem', maxWidth: '100px' }}>
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