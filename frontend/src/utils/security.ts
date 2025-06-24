export const sanitizeInput = (input: string): string => {
    if (typeof input !== 'string') return input;
  
    // Remove SQL keywords and special characters
    const sanitized = input
      // Escape special characters
      .replace(/['"\\]/g, '')
      // Remove common SQL keywords
      .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b/gi, '')
  
    return sanitized;
  };

export const preventXSS = (input: string): string => {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };