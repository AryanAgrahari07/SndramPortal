const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.getUserEmails = async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'userIds must be a non-empty array'
            });
        }

        const query = `
            SELECT user_id, email 
            FROM app.users 
            WHERE user_id = ANY($1::uuid[])
        `;

        const result = await client_update.query(query, [userIds]);

        const emailMap = result.rows.reduce((acc, row) => {
            acc[row.user_id] = row.email;
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            emails: emailMap
        });
    } catch (error) {
        console.error('Error fetching user emails:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user emails',
            error: error.message
        });
    }
};