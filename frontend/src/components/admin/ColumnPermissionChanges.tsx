import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ColumnData {
  column_list: Array<{
    column_name: string;
    column_status: 'editable' | 'non-editable';
  }>;
}

interface ColumnPermissionChangesProps {
  oldData: ColumnData;
  newData: ColumnData;
}

const ColumnPermissionChanges: React.FC<ColumnPermissionChangesProps> = ({ oldData, newData }) => {
  // Extract column lists
  const oldColumns = oldData.column_list || [];
  const newColumns = newData.column_list || [];
  
  // Track changes
  const toEditable: string[] = [];
  const toNonEditable: string[] = [];
  const unchanged = {
    editable: [] as string[],
    nonEditable: [] as string[]
  };
  
  // Compare old and new permissions
  newColumns.forEach(newCol => {
    const oldCol = oldColumns.find(col => col.column_name === newCol.column_name);
    
    if (!oldCol) {
      // New column
      if (newCol.column_status === 'editable') {
        toEditable.push(newCol.column_name);
      } else {
        toNonEditable.push(newCol.column_name);
      }
    } else if (oldCol.column_status !== newCol.column_status) {
      // Changed column
      if (newCol.column_status === 'editable') {
        toEditable.push(newCol.column_name);
      } else {
        toNonEditable.push(newCol.column_name);
      }
    } else {
      // Unchanged column
      if (newCol.column_status === 'editable') {
        unchanged.editable.push(newCol.column_name);
      } else {
        unchanged.nonEditable.push(newCol.column_name);
      }
    }
  });
  
  // Determine if we have any changes
  const hasChanges = toEditable.length > 0 || toNonEditable.length > 0;
  
  return (
    <div className="space-y-6">
      {hasChanges ? (
        <>
          {/* Changed columns */}
          <div className="space-y-4">
            {toEditable.length > 0 && (
              <div>
                <h3 className="text-base font-medium mb-2">Columns Changed to Editable</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {toEditable.map(col => (
                    <div key={col} className="bg-white p-3 rounded-md border border-gray-200 flex items-center">
                      <div className="text-red-600 line-through mr-2">Non-Editable</div>
                      <ArrowRight className="h-4 w-4 text-gray-400 mx-1" />
                      <div className="text-green-600 font-medium">Editable</div>
                      <div className="ml-auto font-medium">{col}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {toNonEditable.length > 0 && (
              <div>
                <h3 className="text-base font-medium mb-2">Columns Changed to Non-Editable</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {toNonEditable.map(col => (
                    <div key={col} className="bg-white p-3 rounded-md border border-gray-200 flex items-center">
                      <div className="text-green-600 line-through mr-2">Editable</div>
                      <ArrowRight className="h-4 w-4 text-gray-400 mx-1" />
                      <div className="text-red-600 font-medium">Non-Editable</div>
                      <div className="ml-auto font-medium">{col}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Stats summary */}
          <div className="bg-white p-4 rounded-md border border-gray-200">
            <h3 className="text-base font-medium mb-3">Summary of Changes</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-3 rounded-md border border-green-100">
                <div className="text-sm text-gray-500 mb-1">Changed to Editable</div>
                <div className="text-xl font-semibold text-green-600">{toEditable.length}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-md border border-red-100">
                <div className="text-sm text-gray-500 mb-1">Changed to Non-Editable</div>
                <div className="text-xl font-semibold text-red-600">{toNonEditable.length}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Total Editable</div>
                <div className="text-xl font-semibold text-gray-700">
                  {toEditable.length + unchanged.editable.length}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Total Non-Editable</div>
                <div className="text-xl font-semibold text-gray-700">
                  {toNonEditable.length + unchanged.nonEditable.length}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100 text-yellow-700">
          No permission changes detected between old and new data.
        </div>
      )}
    </div>
  );
};

export default ColumnPermissionChanges; 