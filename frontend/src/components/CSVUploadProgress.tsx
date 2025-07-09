import React, { useEffect, useState } from 'react';
import { Progress } from "@/components/ui/progress";
import { X, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CSVUploadProgressProps {
  onClose: () => void;
}

// Define the upload status type
type UploadStatus = 'validating' | 'uploading' | 'processing_database' | 'finalizing' | 'completed' | 'failed' | 'connecting' | 'idle';

interface UploadState {
  tableName: string;
  fileName: string;
  totalRows: number;
  processedRows: number;
  currentChunk: number;
  totalChunks: number;
  status: UploadStatus;
  errors: any[];
  startTime: number;
  lastUpdated: number;
  socketConnected?: boolean;
  processingRate?: number; // rows per second
  dbProcessedRows?: number;
  dbTotalRows?: number;
  message?: string;
}

export const CSVUploadProgress: React.FC<CSVUploadProgressProps> = ({ onClose }) => {
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [processingRates, setProcessingRates] = useState<number[]>([]);
  const { toast } = useToast();
  
  // Load the upload state from localStorage on component mount
  useEffect(() => {
    const loadState = () => {
      const savedState = localStorage.getItem('csvUploadState');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          // Check if the upload is still relevant (less than 1 hour old)
          const isStale = Date.now() - parsedState.lastUpdated > 60 * 60 * 1000;
          
          if (!isStale) {
            setUploadState(parsedState);
            
            // Calculate processing rate if we have enough data
            if (parsedState.processedRows > 0 && parsedState.startTime) {
              const elapsedSeconds = (Date.now() - parsedState.startTime) / 1000;
              if (elapsedSeconds > 0) {
                const rate = parsedState.processedRows / elapsedSeconds;
                setProcessingRates(prev => {
                  const newRates = [...prev, rate].slice(-5); // Keep last 5 rates for averaging
                  return newRates;
                });
              }
            }
          } else {
            localStorage.removeItem('csvUploadState');
          }
        } catch (error) {
          console.error('Error parsing saved upload state:', error);
          localStorage.removeItem('csvUploadState');
        }
      }
    };

    loadState();
    // Poll for updates every second
    const interval = setInterval(loadState, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Listen for upload progress updates
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'csvUploadState' && e.newValue) {
        try {
          const newState = JSON.parse(e.newValue);
          setUploadState(newState);
          
          // Calculate processing rate
          if (newState.processedRows > 0 && newState.startTime) {
            const elapsedSeconds = (Date.now() - newState.startTime) / 1000;
            if (elapsedSeconds > 0) {
              const rate = newState.processedRows / elapsedSeconds;
              setProcessingRates(prev => {
                const newRates = [...prev, rate].slice(-5); // Keep last 5 rates for averaging
                return newRates;
              });
            }
          }
        } catch (error) {
          console.error('Error parsing upload state update:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Calculate progress percentage
  const calculateProgress = (): number => {
    if (!uploadState) return 0;
    
    switch (uploadState.status) {
      case 'connecting':
        return 5;
      case 'validating':
        // During validation, progress is based on processed rows vs total rows
        return Math.min(100, Math.round((uploadState.processedRows / uploadState.totalRows) * 40));
      case 'uploading':
        // During upload, start at 40% and go to 80% based on chunks
        const baseProgress = 40;
        const uploadProgress = Math.round((uploadState.currentChunk / uploadState.totalChunks) * 40);
        return baseProgress + uploadProgress;
      case 'processing_database':
        // During database processing, start at 80% and go to 95%
        const dbBaseProgress = 80;
        if (uploadState.dbTotalRows && uploadState.dbTotalRows > 0) {
          const dbProgress = Math.round((uploadState.dbProcessedRows! / uploadState.dbTotalRows) * 15);
          return dbBaseProgress + dbProgress;
        }
        return dbBaseProgress;
      case 'finalizing':
        return 95; // Almost done
      case 'completed':
        return 100;
      case 'failed':
        return 100; // Show full bar but in error state
      default:
        return 0;
    }
  };

  // Calculate estimated time remaining
  const calculateETA = (): string => {
    if (!uploadState || uploadState.processedRows === 0) return 'Calculating...';
    
    // Use average processing rate for more stable estimates
    let avgRate = 0;
    if (processingRates.length > 0) {
      avgRate = processingRates.reduce((sum, rate) => sum + rate, 0) / processingRates.length;
    } else {
      const elapsedMs = Date.now() - uploadState.startTime;
      avgRate = uploadState.processedRows / (elapsedMs / 1000);
    }
    
    if (avgRate <= 0) return 'Calculating...';
    
    const remainingRows = uploadState.totalRows - uploadState.processedRows;
    const remainingSeconds = avgRate > 0 ? remainingRows / avgRate : 0;
    
    if (remainingSeconds <= 0) return 'Almost done...';
    
    // Convert to minutes and seconds
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    const remainingSecondsDisplay = Math.floor(remainingSeconds % 60);
    
    if (remainingMinutes > 0) {
      return `~${remainingMinutes}m ${remainingSecondsDisplay}s remaining`;
    } else {
      return `~${remainingSecondsDisplay}s remaining`;
    }
  };

  // Calculate processing rate (rows/sec)
  const getProcessingRate = (): string => {
    if (processingRates.length === 0) return '...';
    
    const avgRate = processingRates.reduce((sum, rate) => sum + rate, 0) / processingRates.length;
    if (avgRate >= 1000) {
      return `${(avgRate / 1000).toFixed(1)}k rows/sec`;
    }
    return `${Math.round(avgRate)} rows/sec`;
  };

  // Handle close and cleanup
  const handleClose = () => {
    if (uploadState?.status === 'completed' || uploadState?.status === 'failed') {
      localStorage.removeItem('csvUploadState');
    }
    onClose();
  };

  // Handle retry for failed uploads
  const handleRetry = () => {
    // For now, just close the modal - the user will need to restart the upload
    localStorage.removeItem('csvUploadState');
    toast({
      title: "Upload cancelled",
      description: "Please try uploading your CSV file again.",
    });
    onClose();
  };

  if (!uploadState) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {uploadState.status === 'connecting' && (
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
            )}
            {uploadState.status === 'validating' && (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            )}
            {uploadState.status === 'uploading' && (
              <Loader2 className="h-4 w-4 text-green-500 animate-spin" />
            )}
            {uploadState.status === 'completed' && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {uploadState.status === 'failed' && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <h3 className="font-medium text-gray-800 truncate max-w-[250px]">
              {uploadState.fileName} - {uploadState.tableName}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        
        <div className="mb-3">
          <Progress 
            value={calculateProgress()} 
            className={`h-2 ${uploadState.status === 'failed' ? 'bg-red-100' : ''}`} 
          />
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div>
            {uploadState.status === 'connecting' && 'Establishing connection...'}
            {uploadState.status === 'validating' && 'Validating data...'}
            {uploadState.status === 'uploading' && `Uploading chunk ${uploadState.currentChunk} of ${uploadState.totalChunks}`}
            {uploadState.status === 'processing_database' && (uploadState.message || `Processing in database: ${uploadState.dbProcessedRows} of ${uploadState.dbTotalRows} rows`)}
            {uploadState.status === 'finalizing' && 'Finalizing transaction...'}
            {uploadState.status === 'completed' && 'Upload completed'}
            {uploadState.status === 'failed' && 'Upload failed'}
          </div>
          <div>
            {(uploadState.status === 'uploading' || uploadState.status === 'validating' || uploadState.status === 'processing_database') && calculateETA()}
          </div>
        </div>
        
        <div className="mt-2 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {uploadState.processedRows.toLocaleString()} of {uploadState.totalRows.toLocaleString()} rows processed
          </div>
          {(uploadState.status === 'uploading' || uploadState.status === 'validating') && (
            <div className="text-xs font-medium text-green-600">
              {getProcessingRate()}
            </div>
          )}
        </div>
        
        {uploadState.errors.length > 0 && (
          <div className="mt-3 p-2 bg-red-50 rounded-md text-xs text-red-600 max-h-32 overflow-auto">
            <div className="font-medium mb-1">Errors found:</div>
            <ul className="list-disc pl-4 space-y-1">
              {uploadState.errors.slice(0, 5).map((error, index) => (
                <li key={index}>
                  {error.originalLineNumber || error.row ? 
                    `Line ${error.originalLineNumber || error.row}: ` : ''}
                  {error.column ? `${error.column} - ` : ''}
                  {error.message}
                </li>
              ))}
              {uploadState.errors.length > 5 && (
                <li>And {uploadState.errors.length - 5} more errors...</li>
              )}
            </ul>
          </div>
        )}
        
        {uploadState.status === 'failed' && (
          <div className="mt-3">
            <button
              onClick={handleRetry}
              className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVUploadProgress; 