const { client_update } = require('../../configuration/database/databaseUpdate.js');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Create email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.OTP_EMAIL.trim(),
        pass: process.env.OTP_PASSWORD.replace(/['"]/g, '').trim()
    },
    tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      
    },
    
});

// Verify SMTP connection on startup
transporter.verify()
    .then(() => console.log('SMTP Server connection established'))
    .catch(error => {
        console.error('SMTP Connection Error:', {
            code: error.code,
            message: error.message
        });
        process.exit(1); // Exit if SMTP connection fails on startup
    });

// Function to send OTP email
async function sendOTPEmail(recipientEmail, otp) {
    const mailOptions = {
        from: process.env.OTP_EMAIL,
        to: recipientEmail,
        subject: 'Your OTP Code (Valid for 30 seconds)',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>OTP Verification</h2>
                <p>Your OTP code is: <strong>${otp}</strong></p>
                <p>This code will expire in 30 seconds. Please use it immediately.</p>
                <p>If you didn't request this code, please ignore this email.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send OTP email');
    }
}

exports.sendOTP = async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format',
        });
    }

    // Basic email format validation
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format',
        });
    }

    // Sanitize email by converting to lowercase and trimming
    const sanitizedEmail = email.toLowerCase().trim();

    try {
        // Begin transaction
        await client_update.query('BEGIN');

        const checkUserQuery = {
            text: 'SELECT email FROM app."users" WHERE email = $1',
            values: [sanitizedEmail]
        };

        const userExists = await client_update.query(checkUserQuery);

        if (userExists.rows.length === 0) {
            await client_update.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'This email is not registered',
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash the OTP
        const saltRounds = 10;
        const hashedOTP = await bcrypt.hash(otp, saltRounds);

        // Delete any existing OTP for this email
        await client_update.query(
            'DELETE FROM app."OTP_tracker" WHERE email = $1',
            [email]
        );

        // Insert new hashed OTP
        const insertOtpQuery = {
            text: `
                INSERT INTO app."OTP_tracker" (email, "OTP", "OTP_disable", created_at)
                VALUES ($1, $2, false, CURRENT_TIMESTAMP)
            `,
            values: [sanitizedEmail, hashedOTP]
        };

        await client_update.query(insertOtpQuery);

        // Send OTP via email
        try {
            await sendOTPEmail(email, otp);
            await client_update.query('COMMIT');
        } catch (emailError) {
            await client_update.query('ROLLBACK');
            console.error('Email sending failed:', emailError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email',
                error: emailError.message
            });
        }

        res.status(200).json({
            success: true,
            message: 'OTP generated and sent successfully. Valid for 30 seconds.',
        });
    } catch (error) {
        await client_update.query('ROLLBACK');
        console.error('Error in sendOTP:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while generating OTP',
            error: error.message
        });
    }
};