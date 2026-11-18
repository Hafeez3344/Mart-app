'use client';

import React, { createContext, useContext, useState } from 'react';

const SidebarContext = createContext({
  isOpen: false,
  toggleSidebar: () => {},
  closeSidebar: () => {},
  openSidebar: () => {}
});

export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const closeSidebar = () => setIsOpen(false);
  const openSidebar = () => setIsOpen(true);

  return (
    <SidebarContext.Provider value={{ isOpen, toggleSidebar, closeSidebar, openSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
