import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PageSizeSelectorProps {
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  options?: number[];
}

export const PageSizeSelector: React.FC<PageSizeSelectorProps> = ({
  pageSize,
  onPageSizeChange,
  options = [10, 20, 50],
}) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Show</span>
      <Select
        value={pageSize.toString()}
        onValueChange={(value) => onPageSizeChange(Number(value))}
      >
        <SelectTrigger className="w-[70px] h-8">
          <SelectValue placeholder={pageSize} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option.toString()}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm text-gray-500">per page</span>
    </div>
  );
};
