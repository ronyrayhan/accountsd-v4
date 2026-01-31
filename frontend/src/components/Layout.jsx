import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children, title, actions }) => {
    return (
        <div className="d-flex">
            <Sidebar />
            <main id="main-content">
                <div className="top-bar">
                    <h4 className="m-0 text-dark fw-bold">{title || 'Dashboard'}</h4>
                    <div className="d-flex gap-2">
                        {actions}
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
