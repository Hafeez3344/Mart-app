'use client';

import React from 'react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';

export default function StaffLayout({ children }) {
  return (
    <div className="flex h-screen bg-[#F4F8FC] overflow-hidden text-slate-800 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
