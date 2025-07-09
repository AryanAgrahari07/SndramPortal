import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  className?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-gray-100",
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-[#00bfa5] transition-all"
          style={{ 
            width: `${Math.max(0, Math.min(100, value))}%`,
            transition: "width 0.3s ease-in-out"
          }}
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";

export { Progress }; 