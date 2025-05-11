const adminLogsService = require('../services/adminLogsService');

/**
 * Get admin logs with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAdminLogs = async (req, res) => {
    try {
        const filters = {
            section: req.query.section,
            actionType: req.query.actionType,
            adminId: req.query.adminId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            tableName: req.query.tableName,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder,
            search: req.query.search,
            groupName: req.query.groupName,
            columnName: req.query.columnName
        };
        
        const result = await adminLogsService.getAdminLogs(filters);
        res.json(result);
    } catch (error) {
        console.error('Error in getAdminLogs controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admin logs',
            error: error.message
        });
    }
};

/**
 * Get available sections for filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSections = async (req, res) => {
    try {
        const sections = await adminLogsService.getSections();
        res.json({
            success: true,
            sections: ['all', ...sections]
        });
    } catch (error) {
        console.error('Error in getSections controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sections',
            error: error.message
        });
    }
};

/**
 * Get available action types for filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getActionTypes = async (req, res) => {
    try {
        const actionTypes = await adminLogsService.getActionTypes();
        res.json({
            success: true,
            actionTypes: ['all', ...actionTypes]
        });
    } catch (error) {
        console.error('Error in getActionTypes controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch action types',
            error: error.message
        });
    }
};

/**
 * Get a specific admin log by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLogById = async (req, res) => {
    try {
        const { id } = req.params;
        const log = await adminLogsService.getLogById(id);
        res.json({
            success: true,
            log
        });
    } catch (error) {
        console.error('Error in getLogById controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch log',
            error: error.message
        });
    }
};

module.exports = {
    getAdminLogs,
    getSections,
    getActionTypes,
    getLogById
};