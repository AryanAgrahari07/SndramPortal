import axios from 'axios';
import { getAuthHeaders } from '../utils/authHeaders';

export interface DropdownOption {
  value: string;
}

export interface ColumnDropdownOption {
  columnName: string;
  options: string[];
}

export interface DropdownResponse {
  success: boolean;
  message?: string;
  data?: string[];
  dropdown_options?: ColumnDropdownOption[];
}

export interface ErrorResponse {
  message?: string;
}

export const dropdownConfigService = {
  async getTables() {
    const response = await axios.get<DropdownResponse>(
      'http://localhost:8080/table',
      { headers: getAuthHeaders(), withCredentials: true  }
    );
    return response.data.data || [];
  },

  async fetchColumns(tableName: string) {
    const response = await axios.post<DropdownResponse>(
      `http://localhost:8080/fetchcolumn`,
      { table_name: tableName },
      { headers: getAuthHeaders(), withCredentials: true  }
    );
    return response.data;
  },

  async fetchColumnDropdownOptions(tableName: string, columnName: string) {
    const response = await axios.post<DropdownResponse>(
      'http://localhost:8080/fetchColumnDropDown',
      {
        table_name: tableName,
        columnName: columnName,
      },
      { headers: getAuthHeaders(), withCredentials: true  }
    );
    return response.data;
  },

  async updateColumnDropdownOptions(
    tableName: string,
    dropdownOptions: ColumnDropdownOption[]
  ) {
    const response = await axios.post<DropdownResponse>(
      'http://localhost:8080/updateColumnDropDown',
      {
        table_name: tableName,
        dropdown_options: dropdownOptions,
      },
      { headers: getAuthHeaders(), withCredentials: true }
    );
    return response.data;
  },
};
