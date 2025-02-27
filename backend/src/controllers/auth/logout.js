// const authService = require('../../services/authService.js');

// exports.logout = async (req, res) => {
//     try {
//         const { refreshToken } = req.body;
        
//         if (!refreshToken) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Refresh token is required"
//             });
//         }

//         await authService.invalidateSession(req.user.user_id);

//         return res.status(200).json({
//             success: true,
//             message: "Logged out successfully"
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: "Error logging out"
//         });
//     }
// };