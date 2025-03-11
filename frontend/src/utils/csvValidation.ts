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
      if (value === null || value === '' || value === 'null' || value === 'NULL') return;

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
           // Validate date format (YYYY-MM-DD or DD-MM-YYYY)
           const dateRegexISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
           const dateRegexDMY = /^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
           
           if (!dateRegexISO.test(stringValue) && !dateRegexDMY.test(stringValue)) {
             errors.push({
               row: rowNumber,
               column,
               message: `Must be a valid date in YYYY-MM-DD or DD-MM-YYYY format`,
             });
             break;
           }
 
           // Parse the date based on its format
           let year: number, month: number, day: number;
           
           if (dateRegexISO.test(stringValue)) {
             [year, month, day] = stringValue.split('-').map(Number);
           } else {
             [day, month, year] = stringValue.split('-').map(Number);
           }
 
           // Validate date values
           const isValidDate = new Date(year, month - 1, day).getMonth() === month - 1;
           if (!isValidDate) {
             errors.push({
               row: rowNumber,
               column,
               message: `Invalid date value`,
             });
           }
           break;

        case 'timestamp':
        case 'timestamp without time zone':
        case 'timestamp with time zone':
           // Validate timestamp format with both date formats
          const timestampRegexISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\s([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d{1,3})?(([+-])([01]\d|2[0-3]):([0-5]\d))?$/;
          const timestampRegexDMY = /^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}\s([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d{1,3})?(([+-])([01]\d|2[0-3]):([0-5]\d))?$/;

          if (!timestampRegexISO.test(stringValue) && !timestampRegexDMY.test(stringValue)) {
            errors.push({
              row: rowNumber,
              column,
              message: `Must be a valid timestamp in YYYY-MM-DD HH:mm:ss[.SSS][+/-HH:mm] or DD-MM-YYYY HH:mm:ss[.SSS][+/-HH:mm] format`,
            });
            break;
          }

          // Convert DD-MM-YYYY to YYYY-MM-DD format if needed
          let timestampStr = stringValue;
          if (timestampRegexDMY.test(stringValue)) {
            const [datePart, timePart] = stringValue.split(' ');
            const [day, month, year] = datePart.split('-');
            timestampStr = `${year}-${month}-${day} ${timePart}`;
          }

          const timestamp = new Date(timestampStr);
          if (isNaN(timestamp.getTime())) {
            errors.push({
              row: rowNumber,
              column,
              message: `Invalid timestamp value`,
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