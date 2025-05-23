/**
 * List of tables that should be restricted from non-admin users
 * These tables contain sensitive information and system configurations
 */
const RESTRICTED_TABLES = [
    'agg_transaction_data',
    'OTP_tracker',
    'table_metadata',
    'change_tracker',
    'add_row_table',
    'users',
    'user_sessions',
    'group_table',
    'column_permission',
    'dynamic_dropdowns',
    'column_renames',
    'column_validations',
    'admin_action_logs'
];

module.exports = {
    RESTRICTED_TABLES,
    isRestrictedTable: (tableName) => RESTRICTED_TABLES.includes(tableName.toLowerCase())
}; 