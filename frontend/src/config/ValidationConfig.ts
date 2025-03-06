import { SYMBOL_ALLOWED_COLUMNS } from './allowedcolumns/Symbol_allowed_columns';
import { NUMBER_ALLOWED_COLUMNS } from './allowedcolumns/Number_allowed_columns';
import { SPACE_ALLOWED_COLUMNS } from './allowedcolumns/Space_allowed_columns';

export const isSpaceAllowed = (column: string): boolean => {
  return SPACE_ALLOWED_COLUMNS.includes(column.toLowerCase() as any);
};

export const isSymbolAllowed = (column: string): boolean => {
  return SYMBOL_ALLOWED_COLUMNS.includes(column.toLowerCase() as any);
};

export const isNumberAllowed = (column: string): boolean => {
  return NUMBER_ALLOWED_COLUMNS.includes(column.toLowerCase() as any);
};


export const preventXSS = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};