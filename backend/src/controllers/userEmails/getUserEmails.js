const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");

exports.getUserEmails = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "userIds must be a non-empty array",
      });
    }

    // Separating emails and UUIDs
    const emails = userIds.filter((id) => id.includes("@"));
    const uuids = userIds.filter((id) =>
      id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    );

    // Initialize emailMap with direct emails
    const emailMap = emails.reduce((acc, email) => {
      acc[email] = email;
      return acc;
    }, {});

    if (uuids.length > 0) {
      const query = `
                    SELECT user_id, email 
                    FROM app.users 
                    WHERE user_id = ANY($1::uuid[])
                `;

      const result = await client_update.query(query, [uuids]);

      // Adding UUID results to the map
      result.rows.forEach((row) => {
        emailMap[row.user_id] = row.email;
      });
    }

    res.status(200).json({
      success: true,
      emails: emailMap,
    });
  } catch (error) {
    console.error("Error fetching user emails:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user emails",
      error: error.message,
    });
  }
};
