import React from 'react';
import Sidebar from '../components/Sidebar';
import { Outlet } from 'react-router-dom';

const AppLayout = () => {
  return (
    <div className="app-container" style={{ display: 'flex' }}>
      {/* Sidebar is mounted once */}
      <Sidebar />

      {/* Main content area where routes render */}
      <main id="main-content" style={{ flexGrow: 1, minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
