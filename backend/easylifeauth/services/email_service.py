"""Async Email Service using aiosmtplib"""
from typing import Dict, Any, Optional
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from ..errors.email_error import EmailError


class EmailService:
    """Async Email Service"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.smtp_server = config.get("smtp_server", "localhost")
        self.smtp_port = config.get("smtp_port", 25)
        self.email = config.get("email", "noreply@easylife.local")
        self.password = config.get("password")
        self.use_tls = config.get("use_tls", False)
    
    def _prepare_email_template(
        self,
        to_email: str,
        reset_token: str,
        reset_url: str
    ) -> MIMEMultipart:
        """Prepare password reset email"""
        subject = "Password Reset Request"
        
        html_content = f"""
            <html>
                <body>
                    <h2>Password Reset Request</h2>
                    <p>You have requested to reset your password. Click the link below to reset:</p>
                    <p><a href="{reset_url}?token={reset_token}">Reset Password</a></p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <h3>Contact us:</h3>
                    <ul>
                        <li>Email: support@easylife.local</li>
                        <li>Office Hrs: 8:00 AM - 05:00 PM EST</li>
                    </ul>
                    <p>Thank you</p>
                    <p>Team EasyLife</p>
                </body>
            </html>
        """
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.email
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html"))
        
        return msg

    async def send_reset_email(
        self,
        to_email: str,
        reset_token: str,
        reset_url: str
    ) -> None:
        """Send password reset email"""
        msg = self._prepare_email_template(to_email, reset_token, reset_url)
        
        try:
            if self.use_tls and self.password:
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_server,
                    port=self.smtp_port,
                    username=self.email,
                    password=self.password,
                    start_tls=True
                )
            else:
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_server,
                    port=self.smtp_port
                )
        except Exception as e:
            raise EmailError(f"Failed to send email: {str(e)}", 500) from e

    def _prepare_feedback_email_template(
        self,
        to_email: str,
        data: Dict[str, Any]
    ) -> MIMEMultipart:
        """Prepare feedback email"""
        subject = "Thank you for your feedback"
        
        feedback_template = ""
        if data:
            feedback_template = f"""
                <p>Feedback Submitted at {data.get('createdAt', '')}</p>
                <p>Rating: {data.get('rating', '')}</p>
                <p>Comments: {data.get('improvements', '')}</p>
                <p>Suggestions: {data.get('suggestions', '')}</p>
                <p>Email: {data.get('email', '')}</p>
                <hr/>
            """
        
        html_content = f"""
            <html>
                <body>
                    <h2>Feedback Submitted</h2>
                    {feedback_template}
                    <h3>Contact us:</h3>
                    <ul>
                        <li>Email: support@easylife.local</li>
                        <li>Office Hrs: 8:00 AM - 05:00 PM EST</li>
                    </ul>
                    <p>Thank you</p>
                    <p>Team EasyLife</p>
                </body>
            </html>
        """
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.email
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html"))
        
        return msg

    async def send_feedback_email(
        self,
        to_email: str,
        data: Dict[str, Any]
    ) -> None:
        """Send feedback confirmation email"""
        msg = self._prepare_feedback_email_template(to_email, data)
        
        try:
            if self.use_tls and self.password:
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_server,
                    port=self.smtp_port,
                    username=self.email,
                    password=self.password,
                    start_tls=True
                )
            else:
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_server,
                    port=self.smtp_port
                )
        except Exception as e:
            raise EmailError(f"Failed to send email: {str(e)}", 500) from e

    def _generate_scenario_steps_template(self, data: Dict[str, Any]) -> str:
        """Generate HTML for scenario steps"""
        steps = data.get("stepQueries", [])
        names = data.get("steps", [])
        
        steps = steps if isinstance(steps, list) else []
        names = names if isinstance(names, list) else []
        
        max_len = max(len(steps), len(names))
        html = "<ol>\n"
        
        for i in range(max_len):
            step = steps[i] if i < len(steps) else ""
            name = names[i] if i < len(names) else ""
            html += f"  <li><p>{name}</p><p>{step}</p></li>\n"
        
        html += "</ol>"
        return html

    def _prepare_scenario_email_template(
        self,
        to_email: str,
        data: Dict[str, Any]
    ) -> MIMEMultipart:
        """Prepare scenario request email"""
        status_desc = {
            "S": "SUBMITTED",
            "P": "IN_PROGRESS",
            "D": "DEVELOPMENT",
            "R": "REVIEW",
            "Y": "DEPLOYED",
            "A": "ACTIVE",
            "I": "INACTIVE",
            "X": "REJECTED"
        }
        
        subject = f"Update on Scenario {data.get('requestId', '')} - {data.get('scenarioName', '')}"
        
        steps_template = self._generate_scenario_steps_template(data)
        
        comments = data.get("comments", [])
        comment_str = ""
        if comments:
            comment_str = "<ol>\n"
            for c in comments:
                comment_str += f"  <li><p>{c}</p></li>\n"
            comment_str += "</ol>"
        
        scenario_template = f"""
            <ul>
                <li><p>Description: {data.get('description', '')}</p></li>
                <li><p>Data Category: {data.get('dataDomain', '')}</p></li>
                <li><p>Related schemas: {', '.join(data.get('databases', []))}</p></li>
                <li><p>Filters: {', '.join(data.get('filters', []))}</p></li>
                <li><h4>Suggested Steps</h4>{steps_template}</li>
                <li><p>Result Size: {data.get('resultSize', '100')}</p></li>
                <li><p>Assigned To: {data.get('assignedTo', 'Team')}</p></li>
                <li><p>Scenario Key: {data.get('scenarioKey', '')}</p></li>
                <li><p>Fulfillment Date: {data.get('fulfilmentDate', '')}</p></li>
                <li><p>Status: {status_desc.get(data.get('status', 'S'), 'UNKNOWN')}</p></li>
                <li><p>Updated: {data.get('rowUpdateStp', '')}</p></li>
                <li><h4>Comments</h4>{comment_str}</li>
            </ul>
        """
        
        html_content = f"""
            <html>
                <body>
                    <h3>Update on Scenario <b>{data.get('requestId', '')} - {data.get('scenarioName', '')}</b></h3>
                    {scenario_template}
                    <hr/>
                    <h3>Contact us:</h3>
                    <ul>
                        <li>Email: support@easylife.local</li>
                        <li>Office Hrs: 8:00 AM - 05:00 PM EST</li>
                    </ul>
                    <p>Thank you</p>
                    <p>Team EasyLife</p>
                </body>
            </html>
        """
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.email
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html"))
        
        return msg

    async def send_scenario_email(
        self,
        to_email: str,
        data: Dict[str, Any]
    ) -> None:
        """Send scenario update email"""
        msg = self._prepare_scenario_email_template(to_email, data)
        
        try:
            if self.use_tls and self.password:
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_server,
                    port=self.smtp_port,
                    username=self.email,
                    password=self.password,
                    start_tls=True
                )
            else:
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_server,
                    port=self.smtp_port
                )
        except Exception as e:
            raise EmailError(f"Failed to send email: {str(e)}", 500) from e
