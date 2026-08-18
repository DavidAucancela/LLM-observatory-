import React, { createContext, useContext } from 'react';

const SidebarContext = createContext({ openSidebar: () => {} });

export function SidebarProvider({ openSidebar, children }) {
  return (
    <SidebarContext.Provider value={{ openSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
