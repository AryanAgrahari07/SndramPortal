import type React from "react"
import type { TabItem } from "../types/admin"

interface NavigationTabsProps {
  tabs: TabItem[]
  onTabChange: (tabId: string) => void
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({ tabs, onTabChange }) => {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex gap-8 px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`py-4 px-1 relative ${
              tab.isActive
                ? "text-blue-600 font-medium border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
           >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

