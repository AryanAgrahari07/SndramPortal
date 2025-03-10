import { isSymbolAllowed, isNumberAllowed, isSpaceAllowed } from "@/config/ValidationConfig";

interface ColumnType {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
}

interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export const validateCSVData = (
  data: Record<string, any>[],
  columnTypes: ColumnType[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  data.forEach((row, index) => {
    const rowNumber = index + 2; // Adding 2 because index starts at 0 and we skip header row

    Object.entries(row).forEach(([column, value]) => {
      const columnType = columnTypes.find(ct => ct.column_name === column);
      const normalizedColumn = column.toLowerCase();
      
      if (!columnType) {
        errors.push({
          row: rowNumber,
          column,
          message: `Unknown column`,
        });
        return;
      }

      // Skip validation for null/empty values
      if (value === null || value === '') return;

      const stringValue = String(value).trim();
      
      // SQL Injection Prevention
      const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(['";])/i;
      if (sqlInjectionPattern.test(stringValue)) {
        errors.push({
          row: rowNumber,
          column,
          message: "Invalid input: Contains potentially harmful characters or keywords"
        });
        return;
      }

      // Custom Validations for text/varchar fields
      if (columnType.data_type === 'text' || columnType.data_type.includes('character varying')) {
        // Symbol validation
        if (!isSymbolAllowed(normalizedColumn)) {
          const symbolRegex = /[!@#$%^&*()+=\[\]{};:'"\\|,.<>/?`~\-_]/;
          if (symbolRegex.test(stringValue)) {
            errors.push({
              row: rowNumber,
              column,
              message: "Special characters are not allowed in this field"
            });
            return;
          }
        }

        // Number validation
        if (!isNumberAllowed(normalizedColumn) && !normalizedColumn.includes('id')) {
          const numberRegex = /\d/;
          if (numberRegex.test(stringValue)) {
            errors.push({
              row: rowNumber,
              column,
              message: "Numbers are not allowed in this field"
            });
            return;
          }
        }

        // Space validation
        if (!isSpaceAllowed(column)) {
          if (stringValue.includes(' ')) {
            errors.push({
              row: rowNumber,
              column,
              message: "Spaces are not allowed in this field"
            });
            return;
          }
        }

        // Email validation
        if (normalizedColumn.includes('email')) {
          const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
          if (!emailRegex.test(stringValue)) {
            errors.push({
              row: rowNumber,
              column,
              message: "Please enter a valid email address"
            });
            return;
          }
        }

        // Phone validation
        if (normalizedColumn.includes('phone') || normalizedColumn.includes('mobile')) {
          const phoneRegex = /^\+?[\d\s-]{10,}$/;
          if (!phoneRegex.test(stringValue)) {
            errors.push({
              row: rowNumber,
              column,
              message: "Please enter a valid phone number"
            });
            return;
          }
        }
      }

      // Data type validations
      switch (columnType.data_type) {
        case 'integer':
          if (!Number.isInteger(Number(value))) {
            errors.push({
              row: rowNumber,
              column,
              message: `Must be an integer`,
            });
          }
          break;

        case 'numeric':
        case 'decimal':
          if (isNaN(Number(value))) {
            errors.push({
              row: rowNumber,
              column,
              message: `Must be a number`,
            });
          }
          break;

        case 'boolean':
          if (!['true', 'false', '0', '1'].includes(stringValue.toLowerCase())) {
            errors.push({
              row: rowNumber,
              column,
              message: `Must be a boolean value (true/false)`,
            });
          }
          break;

        case 'date':
        case 'timestamp':
        case 'timestamp without time zone':
        case 'timestamp with time zone':
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push({
              row: rowNumber,
              column,
              message: `Must be a valid date`,
            });
          }
          break;

        case 'uuid':
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(stringValue)) {
            errors.push({
              row: rowNumber,
              column,
              message: `Must be a valid UUID`,
            });
          }
          break;
      }

      // Length validation for character varying
      if (columnType.data_type.includes('character varying') && 
          columnType.character_maximum_length && 
          stringValue.length > columnType.character_maximum_length) {
        errors.push({
          row: rowNumber,
          column,
          message: `Exceeds maximum length of ${columnType.character_maximum_length}`,
        });
      }
    });
  });

  return errors;
};