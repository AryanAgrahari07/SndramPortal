const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.isActive = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    await client_update.query('BEGIN');

    // Get the full user data before making changes
    const userQuery = `
      SELECT user_id, email, role, first_name, last_name, active, created_at, updated_at
      FROM app.users 
      WHERE email = $1
    `;
    const userResult = await client_update.query(userQuery, [email]);

    if (userResult.rowCount === 0) {
      await client_update.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const previousData = userResult.rows[0];
    const currentActive = previousData.active;
    const newActive = !currentActive;

    // Update the active status
    const updateQuery = `
      UPDATE app.users 
      SET active = $1, 
          updated_at = NOW() 
      WHERE email = $2 
      RETURNING user_id, email, role, first_name, last_name, active, created_at, updated_at
    `;
    const result = await client_update.query(updateQuery, [newActive, email]);
    
    if (result.rowCount === 0) {
      await client_update.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: "Failed to update user status",
      });
    }

    const currentData = result.rows[0];

    // Create an array of changes
    const changes = [
      {
        field: 'active',
        oldValue: currentActive,
        newValue: newActive
      }
    ];

    await client_update.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `User ${newActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        current: currentData,
        previous: previousData,
        changes: changes
      }
    });

  } catch (error) {
    await client_update.query('ROLLBACK');
    console.error('Error in isActive:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};