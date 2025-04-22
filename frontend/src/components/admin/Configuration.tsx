import { useState } from "react";
import ColumnConfigurator from "./configurators/ColumnConfigurator";
import DropdownManager from "./configurators/DropdownManager";
import GroupConfiguration from "./configurators/GroupConfiguration";
import TableConfigurator from "./configurators/TableConfigurator";
import ColumnRenamer from "./configurators/ColumnRenamer";

type TabType = "column" | "dropdown" | "group" | "table" | "rename";

const Configuration = () => {
  const [activeTab, setActiveTab] = useState<TabType>("column");

  const renderContent = () => {
    switch (activeTab) {
      case "column":
        return <ColumnConfigurator tables={[]} />;
      case "dropdown":
        return <DropdownManager tables={[]} />;
      case "group":
        return <GroupConfiguration />;
      case "table":
        return <TableConfigurator />;
      case "rename":
        return <ColumnRenamer />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <button
          onClick={() => setActiveTab("column")}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "column"
              ? "bg-[#0F172A] text-white"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Column Configuration
        </button>
        <button
          onClick={() => setActiveTab("dropdown")}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "dropdown"
              ? "bg-[#0F172A] text-white"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Dropdown Management
        </button>
        <button
          onClick={() => setActiveTab("group")}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "group"
              ? "bg-[#0F172A] text-white"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Group Configuration
        </button>
        <button
          onClick={() => setActiveTab("table")}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "table"
              ? "bg-[#0F172A] text-white"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Table Configuration
        </button>

        <button
           onClick={() => setActiveTab("rename")}
           className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
             activeTab === "rename"
               ? "bg-[#0F172A] text-white"
               : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
           }`}
        >
          Rename Columns
        </button>
      </div>

      <div className="bg-[#F8FAFC] min-h-[calc(100vh-36rem)]">
        {renderContent()}
      </div>
    </div>
  );
};

export default Configuration;
