/**
 * OTP Sender Service for Finance Tracker
 * Handles email and SMS OTP delivery
 */

const nodemailer = require('nodemailer');

// ==================== EMAIL CONFIGURATION ====================
// Using Gmail SMTP (enable "Less secure app access" or use App Password)
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'your-email@gmail.com',
        pass: process.env.GMAIL_PASSWORD || 'your-app-password'
    }
});

// ==================== SMS CONFIGURATION ====================
// For SMS sending, you would use Twilio or similar service
// This is a placeholder for demonstration
const sendSMS = async (phone, otp) => {
    try {
        // In production, implement with Twilio SDK:
        // const twilio = require('twilio');
        // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        // await client.messages.create({
        //     body: `Your Finance Tracker OTP is: ${otp}`,
        //     from: process.env.TWILIO_PHONE_NUMBER,
        //     to: phone
        // });
        
        // For now, log to console (demo mode)
        console.log(`📱 SMS OTP sent to ${phone}: ${otp}`);
        return { success: true, message: 'OTP sent via SMS (demo mode)' };
    } catch (error) {
        console.error('SMS sending error:', error);
        return { success: false, error: 'Failed to send SMS' };
    }
};

// ==================== EMAIL OTP SENDER ====================
const sendEmailOTP = async (email, otp, userName) => {
    try {
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); color: white; padding: 20px; border-radius: 5px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 20px 0; }
        .otp-box { background-color: #f0f0f0; border: 2px solid #0f3460; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; }
        .otp-box .otp { font-size: 32px; font-weight: bold; color: #0f3460; letter-spacing: 5px; font-family: monospace; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset - One Time Password</h1>
        </div>
        
        <div class="content">
            <p>Hi ${userName},</p>
            
            <p>You requested to reset your Finance Tracker password. Please use the OTP below to verify your identity and create a new password.</p>
            
            <div class="otp-box">
                <p style="margin: 0 0 10px 0; color: #666;">Your OTP is:</p>
                <div class="otp">${otp}</div>
                <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">Valid for 5 minutes</p>
            </div>
            
            <div class="warning">
                <strong>⚠️ Security Warning:</strong> If you did not request this password reset, please ignore this email and change your password immediately. Your account may have been accessed without authorization.
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>Never share this OTP with anyone</li>
                <li>Finance Tracker staff will never ask for your OTP</li>
                <li>This OTP will expire in 5 minutes</li>
                <li>If you didn't request this, your account may be at risk</li>
            </ul>
            
            <p>Access your account here: <a href="http://localhost:5500" style="color: #0f3460;">Finance Tracker Login</a></p>
        </div>
        
        <div class="footer">
            <p>&copy; 2026 Finance Tracker. All rights reserved.</p>
            <p>This email was sent to ${email}</p>
        </div>
    </div>
</body>
</html>
        `;

        const mailOptions = {
            from: process.env.GMAIL_USER || 'finance-tracker@app.com',
            to: email,
            subject: '🔐 Finance Tracker - Password Reset OTP',
            html: htmlContent
        };

        await emailTransporter.sendMail(mailOptions);
        console.log(`✅ OTP email sent to ${email}`);
        return { success: true, message: 'OTP sent to email successfully' };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: 'Failed to send email: ' + error.message };
    }
};

// ==================== SEND OTP VIA PHONE ====================
const sendSMSOTP = async (phone, otp) => {
    try {
        // In production, use Twilio or similar service
        // For demo, we'll log to console
        console.log(`📱 SMS OTP to ${phone}: ${otp}`);
        return { success: true, message: 'OTP sent via SMS (check console in demo)' };
    } catch (error) {
        console.error('SMS error:', error);
        return { success: false, error: 'Failed to send SMS' };
    }
};

// ==================== UNIFIED OTP SENDER ====================
const sendOTPByMethod = async (user, otp, method = 'email') => {
    try {
        if (method === 'email') {
            return await sendEmailOTP(user.email, otp, user.name);
        } else if (method === 'sms') {
            return await sendSMSOTP(user.phone, otp);
        } else {
            return { success: false, error: 'Invalid OTP delivery method' };
        }
    } catch (error) {
        console.error('OTP sending error:', error);
        return { success: false, error: 'Failed to send OTP' };
    }
};

// ==================== VERIFY EMAIL CONFIGURATION ====================
const verifyEmailConfiguration = async () => {
    try {
        await emailTransporter.verify();
        console.log('✅ Email transporter configured successfully');
        return true;
    } catch (error) {
        console.error('❌ Email configuration error:', error.message);
        return false;
    }
};

module.exports = {
    sendEmailOTP,
    sendSMSOTP,
    sendOTPByMethod,
    verifyEmailConfiguration
};
