const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.fetchColumnDropDown = async (req, res) => {
    const { table_name, columnName } = req.body;
  
    try {
        const query = `
            SELECT dropdown_options 
            FROM app.dynamic_dropdowns 
            WHERE table_name = $1;
        `;
        
        const result = await client_update.query(query, [table_name]);
        
        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No dropdown options found for this column",
                data: []
            });
        }
        
        const dropdownOptions = result.rows[0].dropdown_options;
        const columnConfig = dropdownOptions.find(config => config.columnName === columnName);
        
        if (!columnConfig) {
            return res.status(200).json({
                success: true,
                message: "No dropdown options found for this column",
                data: []
            });
        }
        
        // Handle both simple and complex option formats
        let options = [];
        
        if (Array.isArray(columnConfig.options)) {
            options = columnConfig.options.map(opt => {
                // If it's a dependent option with parent, return only the value
                if (typeof opt === 'object' && opt.value) {
                    return opt.value;
                }
                // Otherwise return the option directly (simple string option)
                return opt;
            });
        }
        
        return res.status(200).json({
            success: true,
            data: options,
            dropdown_options: dropdownOptions,
            // Include additional information for dependent dropdowns
            hasParent: !!columnConfig.parentColumn,
            parentColumn: columnConfig.parentColumn || null
        });
    } catch (error) {
        console.error("Error fetching column dropdown:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch column dropdown",
            error: error.message
        });
    }
};