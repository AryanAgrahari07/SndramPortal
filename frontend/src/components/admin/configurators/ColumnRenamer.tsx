import { useState, useEffect } from 'react';
import axios from 'axios';
import { EXCLUDED_TABLES } from '@/config/tableConfig';


interface TableColumn {
  column_name: string;
  renamed_column_name?: string;
}

const ColumnRenamer = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');


  const handleEditSubmit = async (columnName: string) => {
    if (editValue.trim()) {
      await handleRename(columnName, editValue);
      setEditingColumn(null);
      setEditValue('');
    }
  };

  // Fetch tables on component mount
  useEffect(() => {
    fetchTables();
  }, []);

  // Fetch columns when table is selected
  useEffect(() => {
    if (selectedTable) {
      fetchColumns();
    }
  }, [selectedTable]);

  const fetchTables = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        "http://localhost:8080/table",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true
        }
      );

      if (response.data.success) {
        // Filter out excluded tables
        const filteredTables = response.data.tables
          .map((table: { table_name: string }) => table.table_name)
          .filter((tableName: string) => !EXCLUDED_TABLES.includes(tableName));
        setTables(filteredTables);
      } else {
        throw new Error(response.data.message || "Failed to fetch tables");
      }

    } catch (err) {
      setError('Failed to fetch tables');
      console.error(err);
    }
  };

  const fetchColumns = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const columnsResponse = await axios.post(
        `http://localhost:8080/fetchcolumn`,
        {table_name: selectedTable},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true
        }
      );

      const renamesResponse = await axios.get(
        `http://localhost:8080/columns/${selectedTable}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true
        }
      );
  
      // Combine the data
      const columnsData = columnsResponse.data.columns.map((columnName: string) => {
        const existingRename = renamesResponse.data.columns.find(
          (rename: any) => rename.original_column_name === columnName
        );
        return {
          column_name: columnName,
          renamed_column_name: existingRename?.renamed_column_name || ''
        };
      });

      setColumns(columnsData);
    } catch (err) {
      setError('Failed to fetch columns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRename = async (columnName: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `http://localhost:8080/column-rename/${selectedTable}/${columnName}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true
        }
      );
      
      // Refresh columns after deletion
      fetchColumns();
    } catch (err) {
      setError('Failed to delete column rename');
      console.error(err);
    }
  };

  const handleRename = async (columnName: string, newName: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        "http://localhost:8080/column-rename",
        {
            table_name: selectedTable,
            original_column_name: columnName,
            renamed_column_name: newName
          }
        ,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true
        }
      );
      
      // Refresh columns after rename
      fetchColumns();
    } catch (err) {
      setError('Failed to rename column');
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Table
        </label>
        <select
          className="w-full max-w-xs border border-gray-300 rounded-md shadow-sm p-2"
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
        >
          <option value="">Select a table</option>
          {tables.map((table) => (
            <option key={table} value={table}>
              {table}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

{selectedTable && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-4">Column Renames</h3>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original Column Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Renamed Column Name
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {columns.map((column) => (
                   <tr key={column.column_name}>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                     {column.column_name}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
            {editingColumn === column.column_name ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  className="border border-gray-300 rounded-md shadow-sm p-2 w-full"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleEditSubmit(column.column_name)}
                  onKeyUp={(e) => {
                    console.log("key pressed", e.key);
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditSubmit(column.column_name);
                    }
                  }}
                  autoFocus
                  onFocus={() => console.log('Input focused')}
                />
              </div>
            ) : column.renamed_column_name ? (
              <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-900">{column.renamed_column_name}</span>
              <div className="flex space-x-2">
                <button 
                  onClick={() => {
                    setEditingColumn(column.column_name);
                    setEditValue(column.renamed_column_name || '');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  title="Edit rename"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button 
                  onClick={() => handleDeleteRename(column.column_name)}
                  className="text-red-400 hover:text-red-600"
                  title="Delete rename"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            ) : (
              <input
              type="text"
              className="border border-gray-300 rounded-md shadow-sm p-2 w-full"
              placeholder="Enter new column name"
              onChange={(e) => setEditValue(e.target.value)}
              onKeyUp={(e) => {
                console.log("key pressed", e.key);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEditSubmit(column.column_name);
                }
              }}
              onBlur={(e) => handleRename(column.column_name, e.target.value)}
            />
          )}
        </td>
                 </tr>
                  ))}
                </tbody>
                </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ColumnRenamer;