# Sundaram Portal

A comprehensive web application for managing and configuring database tables with role-based access.

## Features

### Role-Based Access
- **Maker**: Can edit specific columns in tables based on permissions
- **Checker**: Approves or rejects changes made by makers
- **Admin**: Configures the system, manages users, and sets up permissions

### Dropdown Management
- Configure dropdown options for columns
- Create dependent dropdowns where options depend on parent column values
- Bulk upload options via CSV file

#### Auto-Adding Parent Values (New Feature)
When a user uploads a CSV file with parent values that don't exist yet, the system can automatically:
- Add those new parent values to the parent column's dropdown options
- Associate child options with these new parent values
- Display a notification that new parent values were added
- Refresh the parent dropdown to include these new values

This eliminates the need to first add parent values separately before adding child options.

### Column Configuration
- Configure which columns are editable by makers
- Set validation rules for column values
- Rename columns for display purposes

### Change Tracking
- All changes made by makers are tracked for approval by checkers
- History of changes is maintained

## Technical Stack
- **Frontend**: React, TypeScript, Shadcn UI
- **Backend**: Node.js, Express
- **Database**: PostgreSQL

## Getting Started

1. Clone the repository
2. Install dependencies for both frontend and backend:
   ```
   cd SndaramPortal/frontend && npm install
   cd SndaramPortal/backend && npm install
   ```
3. Set up the PostgreSQL database using the schema files
4. Start the backend server:
   ```
   cd SndaramPortal/backend && npm run dev
   ```
5. Start the frontend development server:
   ```
   cd SndaramPortal/frontend && npm run dev
   ```

## Documentation

### Using the Auto-Add Parent Values Feature

1. Navigate to Admin → Dropdown Manager
2. Select a table and column with a parent-child relationship
3. When uploading a CSV file with the parent-child options:
   - Include new parent values directly in the CSV
   - The system will automatically add these parent values to both:
     - The parent dropdown options list
     - The child dropdown's parent association
   - A notification will show which new parent values were added

CSV format example:
```
parent_value,option_value
Existing Parent,Child Option 1
New Parent 1,Child Option 2
New Parent 2,Child Option 3
```

*Note: This feature streamlines the process of adding hierarchical dropdown options, eliminating the need to add parent values before adding child options.* 