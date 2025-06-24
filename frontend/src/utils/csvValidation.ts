import axios from 'axios';
import { API_URL } from '@/config/constants';

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

interface ValidationRule {
  allow_numbers: boolean;
  allow_special_chars: boolean;
  allow_spaces: boolean;
  min_length?: number;
  max_length?: number;
  regex_pattern?: string;
  custom_error_message?: string;
  min_value?: number;
  max_value?: number;
  decimal_places?: number;
  min_date?: string;
  max_date?: string;
  allow_weekends?: boolean;
  number_sign?: 'positive' | 'negative' | 'non_negative' | 'non_positive';
  parity?: 'even' | 'odd';
  date_restriction?: 'past' | 'future' | 'today' | 'custom';
  days_from_today?: number;
  case_restriction?: 'uppercase' | 'lowercase';
  days_in_past?: number;
  days_in_future?: number;
}

interface ValidationRules {
  [key: string]: ValidationRule;
}

// Function to fetch validation rules from backend
export const fetchValidationRules = async (tableName: string): Promise<ValidationRules> => {
  try {
    const response = await axios.get(
      `${API_URL}/admin/validations/${tableName}`,
      {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );
    
    if (response.data.success) {
      // Convert array of rules to an object keyed by column_name
      const rules = response.data.data.reduce((acc: ValidationRules, rule: ValidationRule & { column_name: string }) => {
        acc[rule.column_name] = rule;
        return acc;
      }, {});
      return rules;
    }
    
    return {};
  } catch (error) {
    console.error("Error fetching validation rules:", error);
    return {};
  }
};

// Function to validate a single field value
export const validateFieldValue = (
  value: unknown, 
  dataType: string,
  validationRule?: ValidationRule
): string => {
  // Allow empty values
  if (value === null || value === undefined || value === "" || value === 'null' || value === 'NULL') {
    return "";
  }

  const stringValue = String(value).trim();
  
  // SQL Injection Prevention
  const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(['";])/i;
  if (sqlInjectionPattern.test(stringValue)) {
    return "Invalid input: Contains potentially harmful characters or keywords";
  }

  if (validationRule) {
    // Special characters validation
    if (!validationRule.allow_special_chars) {
      const symbolRegex = /[!@#$%^&*()+=\[\]{};:'"\\|,.<>/?`~\-_]/;
      if (symbolRegex.test(stringValue)) {
        return validationRule.custom_error_message || "Special characters are not allowed in this field";
      }
    }

    // Numbers validation
    if (!validationRule.allow_numbers) {
      const numberRegex = /\d/;
      if (numberRegex.test(stringValue)) {
        return validationRule.custom_error_message || "Numbers are not allowed in this field";
      }
    }

    // Spaces validation
    if (!validationRule.allow_spaces) {
      if (stringValue.includes(' ')) {
        return validationRule.custom_error_message || "Spaces are not allowed in this field";
      }
    }

    // Length validations (only for non-date fields)
    if (!dataType.includes('date') && !dataType.includes('timestamp')) {
      if (validationRule.min_length && stringValue.length < validationRule.min_length) {
        return `Minimum length should be ${validationRule.min_length} characters`;
      }

      if (validationRule.max_length && stringValue.length > validationRule.max_length) {
        return `Maximum length should be ${validationRule.max_length} characters`;
      }
    }

    // Case restriction validation for text fields
    if ((dataType.includes('character varying') || dataType.includes('text')) && validationRule.case_restriction) {
      switch (validationRule.case_restriction) {
        case 'uppercase':
          if (stringValue !== stringValue.toUpperCase()) {
            return "Value must be in uppercase";
          }
          break;
        case 'lowercase':
          if (stringValue !== stringValue.toLowerCase()) {
            return "Value must be in lowercase";
          }
          break;
      }
    }

    // Regex pattern validation
    if (validationRule.regex_pattern) {
      try {
        const regex = new RegExp(validationRule.regex_pattern);
        if (!regex.test(stringValue)) {
          return validationRule.custom_error_message || "Input format is invalid";
        }
      } catch (error) {
        console.error('Invalid regex pattern:', error);
      }
    }
  }

  // Data type validations
  const lowerDataType = dataType.toLowerCase();
  switch (lowerDataType) {
    case "integer":
    case "numeric":
    case "decimal": {
      const numValue = Number(stringValue);
      if (isNaN(numValue)) {
        return "Must be a valid number";
      }

      if (lowerDataType === "integer" && !Number.isInteger(numValue)) {
        return "Must be a valid integer";
      }

      if (validationRule) {
        // Number sign validations
        if (validationRule.number_sign) {
          switch (validationRule.number_sign) {
            case 'positive':
              if (numValue <= 0) {
                return "Value must be positive (> 0)";
              }
              break;
            case 'negative':
              if (numValue >= 0) {
                return "Value must be negative (< 0)";
              }
              break;
            case 'non_negative':
              if (numValue < 0) {
                return "Value must be non-negative (≥ 0)";
              }
              break;
            case 'non_positive':
              if (numValue > 0) {
                return "Value must be non-positive (≤ 0)";
              }
              break;
          }
        }

        // Parity validations
        if (validationRule.parity && Number.isInteger(numValue)) {
          switch (validationRule.parity) {
            case 'even':
              if (numValue % 2 !== 0) {
                return "Value must be an even number";
              }
              break;
            case 'odd':
              if (numValue % 2 === 0) {
                return "Value must be an odd number";
              }
              break;
          }
        }

        if (typeof validationRule.min_value === 'number' && numValue < validationRule.min_value) {
          return `Value must be greater than or equal to ${validationRule.min_value}`;
        }
        if (typeof validationRule.max_value === 'number' && numValue > validationRule.max_value) {
          return `Value must be less than or equal to ${validationRule.max_value}`;
        }
        if (typeof validationRule.decimal_places === 'number') {
          const decimalParts = stringValue.split('.');
          if (decimalParts[1] && decimalParts[1].length > validationRule.decimal_places) {
            return `Maximum ${validationRule.decimal_places} decimal places allowed`;
          }
        }
      }
      break;
    }

    case "character varying":
    case "text": {
      // Only apply numeric validations if they are explicitly configured
      if (validationRule) {
        const hasNumericValidations = 
          typeof validationRule.decimal_places === 'number' ||
          typeof validationRule.min_value === 'number' ||
          typeof validationRule.max_value === 'number';

        if (hasNumericValidations) {
          const numValue = Number(stringValue);
          if (isNaN(numValue)) {
            return "Must be a valid number";
          }

          if (validationRule.min_value !== null && validationRule.min_value !== undefined) {
            if (numValue < validationRule.min_value) {
              return `Value must be greater than or equal to ${validationRule.min_value}`;
            }
          }

          if (validationRule.max_value !== null && validationRule.max_value !== undefined) {
            if (numValue > validationRule.max_value) {
              return `Value must be less than or equal to ${validationRule.max_value}`;
            }
          }

          if (typeof validationRule.decimal_places === 'number') {
            const decimalParts = stringValue.split('.');
            if (decimalParts[1] && decimalParts[1].length > validationRule.decimal_places) {
              return `Maximum ${validationRule.decimal_places} decimal places allowed`;
            }
          }
        }
      }
      break;
    }

    case "date":
    case "timestamp":
    case "timestamp without time zone":
    case "timestamp with time zone": {
      // Validate date format (YYYY-MM-DD or DD-MM-YYYY)
      const dateRegexISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      const dateRegexDMY = /^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
      
      if (lowerDataType === "date" && !dateRegexISO.test(stringValue) && !dateRegexDMY.test(stringValue)) {
        return `Must be a valid date in YYYY-MM-DD or DD-MM-YYYY format`;
      }

      const dateValue = new Date(stringValue);
      if (isNaN(dateValue.getTime())) {
        return "Must be a valid date";
      }

      if (validationRule) {
        // Date restriction validations
        if (validationRule.date_restriction) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const inputDate = new Date(dateValue);
          inputDate.setHours(0, 0, 0, 0);

          switch (validationRule.date_restriction) {
            case 'past':
              if (inputDate > today) {
                return "Date must be in the past or today";
              }
              break;

            case 'future':
              if (inputDate < today) {
                return "Date must be in the future or today";
              }
              break;

            case 'today':
              if (inputDate.getTime() !== today.getTime()) {
                return "Date must be today";
              }
              break;

            case 'custom': {
              const pastLimit = validationRule.days_in_past;
              const futureLimit = validationRule.days_in_future;

              // Skip validation if both limits are null/undefined
              if (pastLimit === null || pastLimit === undefined) {
                if (futureLimit === null || futureLimit === undefined) {
                  break; // No restrictions if both are null/undefined
                }
              }

              // Handle past limit
              if (pastLimit !== null && pastLimit !== undefined) {
                if (pastLimit === 0) {
                  // Block all past dates
                  if (inputDate < today) {
                    return "Past dates are not allowed";
                  }
                } else {
                  // Check past limit
                  const pastDate = new Date(today);
                  pastDate.setDate(today.getDate() - pastLimit);
                  pastDate.setHours(0, 0, 0, 0);
                  if (inputDate < pastDate) {
                    return `Date must not be more than ${pastLimit} days in the past`;
                  }
                }
              }

              // Handle future limit
              if (futureLimit !== null && futureLimit !== undefined) {
                if (futureLimit === 0) {
                  // Block all future dates
                  if (inputDate > today) {
                    return "Future dates are not allowed";
                  }
                } else {
                  // Check future limit
                  const futureDate = new Date(today);
                  futureDate.setDate(today.getDate() + futureLimit);
                  futureDate.setHours(0, 0, 0, 0);
                  if (inputDate > futureDate) {
                    return `Date must not be more than ${futureLimit} days in the future`;
                  }
                }
              }
              break;
            }
          }

          if (validationRule.min_date && dateValue < new Date(validationRule.min_date)) {
            return `Date must be after ${new Date(validationRule.min_date).toLocaleDateString()}`;
          }
          if (validationRule.max_date && dateValue > new Date(validationRule.max_date)) {
            return `Date must be before ${new Date(validationRule.max_date).toLocaleDateString()}`;
          }
          if (validationRule.allow_weekends === false) {
            const day = dateValue.getDay();
            if (day === 0 || day === 6) {
              return "Weekend dates are not allowed";
            }
          }
        }
      }
      break;
    }

    case "uuid": {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(stringValue)) {
        return "Must be a valid UUID";
      }
      break;
    }

    case "boolean": {
      if (!["true", "false", "0", "1"].includes(stringValue.toLowerCase())) {
        return "Must be true or false";
      }
      break;
    }
  }

  return "";
};

// Main function to validate CSV data
export const validateCSVData = async (
  data: Record<string, any>[],
  columnTypes: ColumnType[],
  tableName: string
): Promise<ValidationError[]> => {
  const errors: ValidationError[] = [];
  
  // Fetch validation rules from backend
  const validationRules = await fetchValidationRules(tableName);

  // Validate each row in the CSV
  data.forEach((row, index) => {
    const rowNumber = index + 2; // Adding 2 because index starts at 0 and we skip header row

    Object.entries(row).forEach(([column, value]) => {
      const columnType = columnTypes.find(ct => ct.column_name === column);
      
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

      // Validate using the new field validation function
      const error = validateFieldValue(
        value, 
        columnType.data_type, 
        validationRules[column]
      );
      
      if (error) {
        errors.push({
          row: rowNumber,
          column,
          message: error
        });
      }
    });
  });

  return errors;
};