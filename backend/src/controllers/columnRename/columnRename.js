const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.getColumnRenames = async (req, res) => {
  try {
    const { table_name } = req.params;
    
    const query = `
      SELECT original_column_name, renamed_column_name
      FROM app.column_renames
      WHERE table_name = $1
    `;
    
    const result = await client_update.query(query, [table_name]);
    
    res.json({
      success: true,
      columns: result.rows
    });
  } catch (error) {
    console.error('Error fetching column renames:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch column renames',
      error: error.message
    });
  }
};

exports.updateColumnRename = async (req, res) => {
  try {
    const { table_name, original_column_name, renamed_column_name } = req.body;
    
    // Check if rename already exists
    const checkQuery = `
      SELECT id FROM app.column_renames
      WHERE table_name = $1 AND original_column_name = $2
    `;
    
    const existing = await client_update.query(checkQuery, [table_name, original_column_name]);
    
    if (existing.rows.length > 0) {
      // Update existing rename
      const updateQuery = `
        UPDATE app.column_renames
        SET renamed_column_name = $3
        WHERE table_name = $1 AND original_column_name = $2
      `;
      await client_update.query(updateQuery, [table_name, original_column_name, renamed_column_name]);
    } else {
      // Insert new rename
      const insertQuery = `
        INSERT INTO app.column_renames (table_name, original_column_name, renamed_column_name)
        VALUES ($1, $2, $3)
      `;
      await client_update.query(insertQuery, [table_name, original_column_name, renamed_column_name]);
    }
    
    res.json({
      success: true,
      message: 'Column rename updated successfully'
    });
  } catch (error) {
    console.error('Error updating column rename:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update column rename',
      error: error.message
    });
  }
};


exports.deleteColumnRename = async (req, res) => {
  try {
    const { table_name, column_name } = req.params;
    
    const query = `
      DELETE FROM app.column_renames
      WHERE table_name = $1 AND original_column_name = $2
    `;
    
    await client_update.query(query, [table_name, column_name]);
    
    res.json({
      success: true,
      message: 'Column rename deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting column rename:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete column rename',
      error: error.message
    });
  }
};