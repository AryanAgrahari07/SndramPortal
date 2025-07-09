import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/button';

interface BulkOperationProgressProps {
  isOpen: boolean;
  onClose: () => void;
  operationType: 'approve' | 'reject';
  totalRequests: number;
  progress: number;
  status: 'processing' | 'success' | 'error' | 'finalizing';
  errorMessage: string;
  summary: {
    total: number;
    approved?: number;
    rejected?: number;
    failed: number;
  };
}

export const BulkOperationProgress = ({
  isOpen,
  onClose,
  operationType,
  totalRequests,
  progress,
  status,
  errorMessage,
  summary,
}: BulkOperationProgressProps) => {
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  // Calculate progress percentage
  useEffect(() => {
    if (totalRequests > 0) {
      const percentage = Math.min(Math.round((progress / totalRequests) * 100), 100);
      setProgressPercentage(percentage);
    } else {
      setProgressPercentage(0);
    }
  }, [progress, totalRequests]);
  
  // Track elapsed time
  useEffect(() => {
    if (status === 'processing' || status === 'finalizing') {
      if (!startTime) {
        setStartTime(Date.now());
      }
      
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - (startTime || Date.now())) / 1000));
      }, 1000);
      
      return () => clearInterval(timer);
    } else if (startTime) {
      // Final update of elapsed time when operation completes
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }
    
    return undefined;
  }, [status, startTime]);
  
  // Reset timer when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStartTime(null);
      setElapsedTime(0);
    }
  }, [isOpen]);
  
  // Format elapsed time as mm:ss
  const formatElapsedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Calculate estimated time remaining
  const getEstimatedTimeRemaining = () => {
    if (progress <= 0 || totalRequests <= 0 || elapsedTime <= 0) {
      return 'Calculating...';
    }
    
    const rate = progress / elapsedTime; // items per second
    if (rate <= 0) {
      return 'Calculating...';
    }
    
    const remainingItems = totalRequests - progress;
    const remainingSeconds = Math.round(remainingItems / rate);
    
    if (remainingSeconds < 5) {
      return 'Almost done...';
    }
    
    if (remainingSeconds < 60) {
      return `About ${remainingSeconds} seconds`;
    }
    
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    return `About ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'processing' && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            )}
            {status === 'finalizing' && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            <span>
              {status === 'processing' && `Processing ${operationType === 'approve' ? 'Approvals' : 'Rejections'}...`}
              {status === 'finalizing' && 'Finalizing Operation...'}
              {status === 'success' && `${operationType === 'approve' ? 'Approval' : 'Rejection'} Complete`}
              {status === 'error' && `${operationType === 'approve' ? 'Approval' : 'Rejection'} Failed`}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {(status === 'processing' || status === 'finalizing') && (
            <>
              <div className="flex justify-between text-sm">
                <span>Processing {progress} of {totalRequests} requests</span>
                <span>{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Elapsed: {formatElapsedTime(elapsedTime)}</span>
                <span>
                  {status === 'finalizing' ? 'Finalizing...' : getEstimatedTimeRemaining()}
                </span>
              </div>
              
              {totalRequests > 100 && (
                <div className="text-xs text-gray-500 mt-2">
                  <p>Processing large dataset. This may take a few minutes.</p>
                  <p>You can hide this dialog and continue working.</p>
                </div>
              )}
            </>
          )}

          {status === 'success' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>Operation completed successfully</span>
              </div>
              <div className="mt-4 space-y-2 rounded-md bg-gray-50 p-3">
                <div className="text-sm font-medium">Summary:</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total requests:</div>
                  <div>{summary.total}</div>
                  
                  {operationType === 'approve' && summary.approved !== undefined && (
                    <>
                      <div>Successfully approved:</div>
                      <div className="text-green-600">{summary.approved}</div>
                    </>
                  )}
                  
                  {operationType === 'reject' && summary.rejected !== undefined && (
                    <>
                      <div>Successfully rejected:</div>
                      <div className="text-amber-600">{summary.rejected}</div>
                    </>
                  )}
                  
                  <div>Failed:</div>
                  <div className="text-red-600">{summary.failed}</div>
                  
                  {elapsedTime > 0 && (
                    <>
                      <div>Total time:</div>
                      <div>{formatElapsedTime(elapsedTime)}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                <span>Operation failed</span>
              </div>
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {errorMessage || 'An unknown error occurred'}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>
            {status === 'processing' || status === 'finalizing' ? 'Hide' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};