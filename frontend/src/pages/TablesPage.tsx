import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { DynamicTable } from "../components/DynamicTable";
import { fetchTables } from "../services/tableService";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface Table {
  table_name: string;
  display_name?: string;
  description?: string | null;
}

interface TableMetadata {
  id: string;
  original_table_name: string;
  display_name: string;
  description: string | null;
}

export const TablesPage: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [tableKey, setTableKey] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const containerRef = useRef<HTMLDivElement>(null);
  // const [tableMetadata, setTableMetadata] = useState<
  //   Record<string, TableMetadata>
  // >({});

  const navigate = useNavigate();

  const loadTableMetadata = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/get-renamed-tables", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        const metadataMap = data.data.reduce(
          (acc: Record<string, TableMetadata>, item: TableMetadata) => {
            acc[item.original_table_name] = item;
            return acc;
          },
          {}
        );
        return metadataMap;
      }
      return {};
    } catch (error) {
      console.error("Failed to fetch table metadata:", error);
      throw error;
    }
  };

  const loadTables = async (metadata: Record<string, TableMetadata>) => {
    const response = await fetchTables();
    if (response.success) {
      const enhancedTables = response.tables.map((table) => ({
        ...table,
        display_name: metadata[table.table_name]?.display_name,
        description: metadata[table.table_name]?.description,
      }));
      return enhancedTables;
    }
    throw new Error(response.message || "Failed to fetch tables");
  };

  useEffect(() => {
    const initializeTables = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const metadata = await loadTableMetadata();
        const enhancedTables = await loadTables(metadata);
        // setTableMetadata(metadata);
        setTables(enhancedTables);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while initializing tables"
        );
      } finally {
        setIsLoading(false);
      }
    };

    initializeTables();
  }, []);

  // Calculate items per page based on container height
  useEffect(() => {
    const calculateItemsPerPage = () => {
      if (containerRef.current) {
        // Account for header (64px), breadcrumb (48px), margins and padding
        const headerHeight = 64;
        const breadcrumbHeight = 48;
        const margins = 48; // Total vertical margins
        const availableHeight =
          window.innerHeight - (headerHeight + breadcrumbHeight + margins);

        const itemHeight = 60; // Height of each table card
        const gap = 16; // Gap between cards
        const totalItemHeight = itemHeight + gap;

        const columns =
          window.innerWidth >= 1280 ? 3 : window.innerWidth >= 768 ? 2 : 1;
        const rows = Math.floor(availableHeight / totalItemHeight);
        const calculatedItems = rows * columns;

        // Set minimum items based on screen size
        const minItems = columns * 3; // At least 3 rows
        setItemsPerPage(Math.max(calculatedItems, minItems));
      }
    };

    calculateItemsPerPage();
    window.addEventListener("resize", calculateItemsPerPage);
    return () => window.removeEventListener("resize", calculateItemsPerPage);
  }, []);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setTableKey((prev) => prev + 1);
  };

  const filteredTables = tables.filter((table) => {
    const searchLower = searchQuery.toLowerCase();
    const tableName = table.table_name.toLowerCase();
    const displayName = table.display_name?.toLowerCase() || "";
    return tableName.includes(searchLower) || displayName.includes(searchLower);
  });

  const totalPages = Math.ceil(filteredTables.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedTables = filteredTables.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00bfa5]"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Breadcrumb and Search - Hidden when table is selected */}
        {!selectedTable && (
          <div className="flex items-center justify-between h-12 mb-4 px-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/dashboard")}
                className="text-[#1a237e] hover:text-[#283593] flex items-center transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Home
              </button>
              <span className="text-gray-400">/</span>
              <span className="text-[#00bfa5]">Data Management</span>
            </div>

            <div className="relative w-[300px]">
              <input
                type="text"
                placeholder="Search table here..."
                value={searchQuery}
                onChange={handleSearch}
                className="w-full px-4 py-2 bg-white rounded-lg border border-[#e3f2fd] focus:outline-none focus:ring-2 focus:ring-[#00bfa5] focus:border-transparent transition-all"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-600 p-4 text-center bg-red-50 rounded-lg mx-6 mb-4">
            {error}
          </div>
        )}

        {selectedTable ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 px-6">
              <button
                onClick={() => setSelectedTable(null)}
                className="flex items-center text-[#1a237e] hover:text-[#283593] transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Tables
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <DynamicTable
                key={tableKey}
                tableName={selectedTable}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                userRole="maker"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 px-6">
            <div
              ref={containerRef}
              className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min content-start"
            >
              {displayedTables.map((table) => (
                <button
                  key={table.table_name}
                  onClick={() => setSelectedTable(table.table_name)}
                  className="flex flex-col p-4 bg-white rounded-lg border border-[#e3f2fd] hover:border-[#00bfa5] hover:shadow-lg transition-all text-left min-h-[60px] group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[#1a237e] font-medium group-hover:text-[#283593]">
                      {table.display_name || table.table_name}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#00bfa5] group-hover:translate-x-1 transition-transform" />
                  </div>
                  {table.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {table.description}
                    </p>
                  )}
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4 py-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-[#e3f2fd] hover:border-[#00bfa5] disabled:opacity-50 disabled:hover:border-[#e3f2fd] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 text-[#1a237e]" />
                </button>
                <span className="text-[#1a237e]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-[#e3f2fd] hover:border-[#00bfa5] disabled:opacity-50 disabled:hover:border-[#e3f2fd] transition-colors"
                >
                  <ArrowRight className="h-4 w-4 text-[#1a237e]" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TablesPage;
