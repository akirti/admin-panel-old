import React from 'react';
import { Outlet } from 'react-router';
import { ExplorerProvider } from './v1_ExplorerContext';
import V1ExplorerSidebar from './v1_ExplorerSidebar';

function V1ExplorerLayout() {
  return (
    <ExplorerProvider>
      <div className="flex h-[calc(100vh-7rem)] -m-6">
        <V1ExplorerSidebar />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </div>
    </ExplorerProvider>
  );
}

export default V1ExplorerLayout;
