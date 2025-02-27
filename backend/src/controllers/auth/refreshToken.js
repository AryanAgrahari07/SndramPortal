// const authService = require('../../services/authService');
// const jwt = require('jsonwebtoken');

// exports.refreshToken = async (req, res) => {
//     try {
//         const { refreshToken } = req.body;

//         const authHeader = req.headers.authorization;
//         const token = authHeader?.split(' ')[1];

//         if (!refreshToken) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Refresh token is required"
//             });
//         }

//         const session = await authService.validateRefreshToken(token);

//         if (!session) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Invalid refresh token"
//             });
//         }

//           // Generate new access token with current timestamp
//           const accessToken = jwt.sign(
//             {
//                 user_id: session.user_id,
//                 email: session.email,
//                 role: session.role
//             },
//             process.env.JWT_SECRET,
//             { expiresIn: '2m' }  // Set appropriate expiration time
//         );



//         // const accessToken = authService.generateAccessToken({
//         //     user_id: session.user_id,
//         //     email: session.email,
//         //     role: session.role
//         // });

//         const newRefreshToken = authService.generateRefreshToken();

//         await authService.updateSession(session.session_id, newRefreshToken);

//         console.log(accessToken);
//         console.log(session);

//         return res.status(200).json({
//             success: true,
//             token: accessToken,
//             refreshToken: newRefreshToken,
//             data: {
//                 email: session.email,
//                 role: session.role
//             }
//         });
//     } catch (error) {
//         console.error('Refresh token error:', error); //
//         return res.status(401).json({
//             success: false,
//             message: "Invalid refresh token"
//         });
//     }
// };