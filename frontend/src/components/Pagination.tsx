import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePagination } from "../hooks/usePagination";
import { PageSizeSelector } from "./PageSizeSelector";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  totalItems?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 10,
  onPageSizeChange,
  totalItems = 0,
}) => {
  const pageNumbers = usePagination({ currentPage, totalPages });

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <PageSizeSelector
            pageSize={pageSize}
            onPageSizeChange={onPageSizeChange}
          />
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#1a237e]">
            Page {currentPage} of {totalPages}
          </span>
          {totalItems > 0 && (
            <span className="text-sm text-gray-500">
              ({totalItems} {totalItems === 1 ? "item" : "items"})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-[#e3f2fd] text-[#1a237e] hover:border-[#00bfa5] disabled:opacity-50 disabled:hover:border-[#e3f2fd] transition-colors disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          {pageNumbers.map((pageNumber, index) => (
            <React.Fragment key={index}>
              {pageNumber === "..." ? (
                <span className="text-sm text-[#1a237e]">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(Number(pageNumber))}
                  className={`h-8 min-w-[2rem] px-3 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors
                    ${
                      currentPage === pageNumber
                        ? "bg-[#00bfa5] border-[#00bfa5] text-white hover:bg-[#00bfa5]/90"
                        : "border-[#e3f2fd] text-[#1a237e] hover:border-[#00bfa5]"
                    }`}
                >
                  {pageNumber}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-[#e3f2fd] text-[#1a237e] hover:border-[#00bfa5] disabled:opacity-50 disabled:hover:border-[#e3f2fd] transition-colors disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
