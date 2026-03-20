import React from 'react';
import { Outlet } from 'react-router-dom';
import { ExplorerProvider } from './v1_ExplorerContext';
import V1ExplorerSidebar from './v1_ExplorerSidebar';

function V1ExplorerLayout() {
  return (
    <ExplorerProvider>
      <div className="flex -mx-6 -mb-6" style={{ height: 'calc(100vh - 8.5rem)' }}>
        <V1ExplorerSidebar />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </div>
    </ExplorerProvider>
  );
}

export default V1ExplorerLayout;
