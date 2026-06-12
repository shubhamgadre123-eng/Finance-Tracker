"""
OTP Sender Service for Finance Tracker (Python/Flask)
Handles email and SMS OTP delivery
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

class OTPSender:
    def __init__(self):
        self.gmail_user = os.getenv('GMAIL_USER', 'your-email@gmail.com')
        self.gmail_password = os.getenv('GMAIL_PASSWORD', 'your-app-password')
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
    
    def send_email_otp(self, email, otp, user_name):
        """Send OTP via Gmail"""
        try:
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }}
        .container {{ max-width: 600px; margin: 20px auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); color: white; padding: 20px; border-radius: 5px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 24px; }}
        .content {{ padding: 20px 0; }}
        .otp-box {{ background-color: #f0f0f0; border: 2px solid #0f3460; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; }}
        .otp-box .otp {{ font-size: 32px; font-weight: bold; color: #0f3460; letter-spacing: 5px; font-family: monospace; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; }}
        .warning {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; border-radius: 3px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset - One Time Password</h1>
        </div>
        
        <div class="content">
            <p>Hi {user_name},</p>
            
            <p>You requested to reset your Finance Tracker password. Please use the OTP below to verify your identity and create a new password.</p>
            
            <div class="otp-box">
                <p style="margin: 0 0 10px 0; color: #666;">Your OTP is:</p>
                <div class="otp">{otp}</div>
                <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">Valid for 5 minutes</p>
            </div>
            
            <div class="warning">
                <strong>⚠️ Security Warning:</strong> If you did not request this password reset, please ignore this email and change your password immediately.
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>Never share this OTP with anyone</li>
                <li>Finance Tracker staff will never ask for your OTP</li>
                <li>This OTP will expire in 5 minutes</li>
            </ul>
            
            <p>Access your account here: <a href="${os.getenv('APP_URL', 'http://localhost:5500/Finance Tracker.html')}" style="color: #0f3460;">Finance Tracker Login</a></p>
        </div>
        
        <div class="footer">
            <p>&copy; 2026 Finance Tracker. All rights reserved.</p>
            <p>This email was sent to {email}</p>
        </div>
    </div>
</body>
</html>
            """
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = '🔐 Finance Tracker - Password Reset OTP'
            msg['From'] = self.gmail_user
            msg['To'] = email
            
            # Attach HTML
            msg.attach(MIMEText(html_content, 'html'))
            
            # Send email
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(self.gmail_user, self.gmail_password)
                server.send_message(msg)
            
            print(f'✅ OTP email sent to {email}')
            return {'success': True, 'message': 'OTP sent to email successfully'}
        
        except Exception as error:
            print(f'❌ Email sending error: {error}')
            return {'success': False, 'error': f'Failed to send email: {str(error)}'}
    
    def send_sms_otp(self, phone, otp):
        """Send OTP via SMS (Twilio)"""
        try:
            if self.twilio_account_sid and self.twilio_auth_token:
                # Production: Use Twilio
                from twilio.rest import Client
                client = Client(self.twilio_account_sid, self.twilio_auth_token)
                
                message = client.messages.create(
                    body=f'Your Finance Tracker OTP is: {otp}',
                    from_=self.twilio_phone,
                    to=phone
                )
                
                print(f'✅ SMS OTP sent to {phone}')
                return {'success': True, 'message': 'OTP sent via SMS successfully'}
            else:
                # Demo mode
                print(f'📱 SMS OTP to {phone}: {otp}')
                return {'success': True, 'message': 'OTP sent via SMS (demo mode)'}
        
        except Exception as error:
            print(f'❌ SMS sending error: {error}')
            return {'success': False, 'error': f'Failed to send SMS: {str(error)}'}
    
    def send_otp_by_method(self, user, otp, method='email'):
        """Send OTP using specified method"""
        try:
            if method == 'email':
                return self.send_email_otp(user.get('email'), otp, user.get('name'))
            elif method == 'sms':
                return self.send_sms_otp(user.get('phone'), otp)
            else:
                return {'success': False, 'error': 'Invalid OTP delivery method'}
        
        except Exception as error:
            print(f'❌ OTP sending error: {error}')
            return {'success': False, 'error': 'Failed to send OTP'}

# Create global instance
otp_sender = OTPSender()
