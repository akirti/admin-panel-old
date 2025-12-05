"""
Email service for sending notifications.
"""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """Email service for sending notifications."""
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.EMAIL_FROM
        self.from_name = settings.EMAIL_FROM_NAME
    
    async def send_email(
        self,
        to_emails: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send an email to one or more recipients."""
        if not self.smtp_user or not self.smtp_password:
            logger.warning("SMTP credentials not configured. Email not sent.")
            return False
        
        try:
            message = MIMEMultipart("alternative")
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = ", ".join(to_emails)
            message["Subject"] = subject
            
            if text_content:
                message.attach(MIMEText(text_content, "plain"))
            message.attach(MIMEText(html_content, "html"))
            
            # Port 465 uses SSL, port 587 uses STARTTLS
            use_tls = self.smtp_port == 465
            start_tls = self.smtp_port == 587
            
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_password,
                use_tls=use_tls,
                start_tls=start_tls
            )
            logger.info(f"Email sent to: {to_emails}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    async def send_welcome_email(self, email: str, full_name: str, temp_password: str) -> bool:
        """Send welcome email with temporary password."""
        subject = "Welcome to Admin Panel"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Welcome to Admin Panel</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Hello <strong>{full_name}</strong>,</p>
                <p>Your account has been created. Here are your login credentials:</p>
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Email:</strong> {email}</p>
                    <p><strong>Temporary Password:</strong> {temp_password}</p>
                </div>
                <p style="color: #dc2626;"><strong>Please change your password after your first login.</strong></p>
                <p>Best regards,<br>Admin Panel Team</p>
            </div>
        </body>
        </html>
        """
        return await self.send_email([email], subject, html_content)
    
    async def send_password_reset_email(self, email: str, full_name: str, reset_token: str) -> bool:
        """Send password reset email."""
        subject = "Password Reset Request"
        reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Password Reset</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Hello <strong>{full_name}</strong>,</p>
                <p>You requested a password reset. Click the button below to reset your password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <p>Best regards,<br>Admin Panel Team</p>
            </div>
        </body>
        </html>
        """
        return await self.send_email([email], subject, html_content)
    
    async def send_role_change_notification(
        self, 
        email: str, 
        full_name: str, 
        change_type: str,
        changes: dict
    ) -> bool:
        """Send notification about role/group/permission changes."""
        subject = f"Your {change_type} has been updated"
        
        changes_html = ""
        for key, value in changes.items():
            if isinstance(value, dict) and "old" in value and "new" in value:
                changes_html += f"<li><strong>{key}:</strong> {value['old']} → {value['new']}</li>"
            else:
                changes_html += f"<li><strong>{key}:</strong> {value}</li>"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Account Update Notification</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Hello <strong>{full_name}</strong>,</p>
                <p>Your {change_type} has been updated with the following changes:</p>
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <ul>{changes_html}</ul>
                </div>
                <p>If you have any questions, please contact your administrator.</p>
                <p>Best regards,<br>Admin Panel Team</p>
            </div>
        </body>
        </html>
        """
        return await self.send_email([email], subject, html_content)
    
    async def send_customer_association_notification(
        self,
        email: str,
        full_name: str,
        customers_added: List[str],
        customers_removed: List[str]
    ) -> bool:
        """Send notification about customer association changes."""
        subject = "Your Customer Associations Updated"
        
        added_html = ""
        if customers_added:
            added_html = "<p><strong>Customers Added:</strong></p><ul>"
            for c in customers_added:
                added_html += f"<li>{c}</li>"
            added_html += "</ul>"
        
        removed_html = ""
        if customers_removed:
            removed_html = "<p><strong>Customers Removed:</strong></p><ul>"
            for c in customers_removed:
                removed_html += f"<li>{c}</li>"
            removed_html += "</ul>"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Customer Association Update</h1>
            </div>
            <div style="padding: 30px; background-color: #f9fafb;">
                <p>Hello <strong>{full_name}</strong>,</p>
                <p>Your customer associations have been updated:</p>
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    {added_html}
                    {removed_html}
                </div>
                <p>If you have any questions, please contact your administrator.</p>
                <p>Best regards,<br>Admin Panel Team</p>
            </div>
        </body>
        </html>
        """
        return await self.send_email([email], subject, html_content)


# Global email service instance
email_service = EmailService()
