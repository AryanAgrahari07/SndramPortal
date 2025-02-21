const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.fetchColumnDropDown = async (req, res) => {
    try {
        const { table_name, columnName , existingValue} = req.body;

        if (!table_name || !columnName) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Provide both table_name and columnName.',
            });
        }

        const queryFetch = `
            SELECT dropdown_options 
            FROM app.dynamic_dropdowns
            WHERE table_name = $1;
        `;

        const result = await client_update.query(queryFetch, [table_name]);

        if (result.rows.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'No matching record found for the provided table_name.',
            });
        }

        const dropdownOptions = result.rows[0].dropdown_options;
        const columnData = dropdownOptions.find(option => option.columnName === columnName);

        if (!columnData) {
            return res.status(200).json({
                success: false,
                message: `No matching columnName '${columnName}' found in dropdown_options.`,
            });
        }

         // If there's an existing value and it's not in the options, add it
         if (existingValue && !columnData.options.includes(existingValue)) {
            columnData.options = [existingValue, ...columnData.options];
        }

        res.status(200).json({
            success: true,
            data: columnData.options,
            selectedValue: existingValue || null 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching the data.',
            error: error.message,
        });
    }
};