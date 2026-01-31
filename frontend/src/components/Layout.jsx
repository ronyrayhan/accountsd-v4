import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children, title, actions }) => {
    const { user } = useAuth();
    const brand = user?.settings?.site_brand || 'AccountsD';

    useEffect(() => {
        document.title = `${title ? title + ' | ' : ''}${brand}`;
    }, [title, brand]);

    return (
        <div className="d-flex text-dark">
            <Sidebar />
            <main id="main-content" className="bg-light min-vh-100 w-100">
                <div className="top-bar bg-white px-4 py-3 border-bottom-light sticky-top" style={{ zIndex: 100 }}>
                    <div className="container-fluid d-flex justify-content-between align-items-center">
                        <h4 className="m-0 text-dark fw-extrabold">{title || 'Dashboard'}</h4>
                        <div className="d-flex gap-2">
                            {actions}
                        </div>
                    </div>
                </div>

                <div className="container-fluid p-4">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
