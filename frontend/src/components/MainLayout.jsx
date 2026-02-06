import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const MainLayout = () => {
    return (
        <div className="text-dark">
            <Sidebar />
            <main id="main-content" className="bg-light min-vh-100">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
