import React from "react";
import { Header } from "./Header";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Header />
      <main className="container mx-auto px-0 py-4">
        <div className="bg-white rounded-[32px] shadow-lg py-2">{children}</div>
      </main>
      </div>
  );
};
