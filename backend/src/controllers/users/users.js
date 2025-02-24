const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// Create a new user
exports.createUser = async (req, res) => {
  const { email, role, first_name, last_name } = req.body;

  try {
    // Validate required fields
    if (!email  || !role || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check if user already exists
    const userExists = await client_update.query(
      "SELECT * FROM app.users WHERE email = $1",
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Generate UUID for new user
    const userId = uuidv4();

    // Hash password
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const query = `
            INSERT INTO app.users (
                user_id,
                email,
                role,
                first_name,
                last_name,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING user_id, email, role, first_name, last_name, created_at;
        `;

    const result = await client_update.query(query, [
      userId,
      email,
      role,
      first_name,
      last_name,
    ]);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {

  const { searchQuery } = req.query; 

  try {
    const query = `
            SELECT user_id, email, role, first_name, last_name, active, created_at, updated_at
            FROM app.users
            ${searchQuery ? `WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)` : ''}
            ORDER BY created_at DESC;
        `;

    const values = searchQuery ? [`%${searchQuery}%`] : [];
    
    const result = await client_update.query(query, values);

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
            SELECT user_id, email, role, first_name, last_name, created_at, updated_at
            FROM app.users
            WHERE user_id = $1;
        `;
    const result = await client_update.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { email, role, first_name, last_name } = req.body;

  try {
    let updateFields = [];
    let values = [];
    let valueIndex = 1;

    if (email) {
      updateFields.push(`email = $${valueIndex}`);
      values.push(email);
      valueIndex++;
    }

    // if (password) {
    //   const salt = await bcrypt.genSalt(10);
    //   const hashedPassword = await bcrypt.hash(password, salt);
    //   updateFields.push(`password_hash = $${valueIndex}`);
    //   values.push(hashedPassword);
    //   valueIndex++;
    // }

    if (role) {
      updateFields.push(`role = $${valueIndex}`);
      values.push(role);
      valueIndex++;
    }

    if (first_name) {
      updateFields.push(`first_name = $${valueIndex}`);
      values.push(first_name);
      valueIndex++;
    }

    if (last_name) {
      updateFields.push(`last_name = $${valueIndex}`);
      values.push(last_name);
      valueIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
            UPDATE app.users
            SET ${updateFields.join(", ")}
            WHERE user_id = $${valueIndex}
            RETURNING user_id, email, role, first_name, last_name, created_at, updated_at;
        `;

    values.push(id);
    const result = await client_update.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const query = "DELETE FROM app.users WHERE user_id = $1 RETURNING *;";
    const result = await client_update.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

// Sign in user
exports.signin = async (req, res) => {
  const { email, role } = req.body;

  try {
    // Validate input
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, and role are required",
      });
    }

    // Find user
    const query = "SELECT * FROM app.users WHERE email = $1 AND role = $2";
    const result = await client_update.query(query, [email, role]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials or role",
      });
    }

    const user = result.rows[0];

    // Verify password
    // const isValidPassword = await bcrypt.compare(password, user.password_hash);

    // if (!isValidPassword) {
    //   return res.status(401).json({
    //     success: false,
    //     message: "Invalid credentials",
    //   });
    // }

    // Determine redirect path based on role
    let redirectPath;
    switch (user.role) {
      case "maker":
        redirectPath = "/dashboard";
        break;
      case "checker":
        redirectPath = "/checker";
        break;
      case "admin":
        redirectPath = "/admin";
        break;
      default:
        redirectPath = "/login";
    }

    // Remove password from response
    // delete user.password_hash;

    res.status(200).json({
      success: true,
      message: "Signed in successfully",
      data: {
        ...user,
        redirectPath,
      },
    });
  } catch (error) {
    console.error("Error signing in:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sign in",
      error: error.message,
    });
  }
};
