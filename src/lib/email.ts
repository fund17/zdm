import nodemailer from 'nodemailer'

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

/**
 * Send verification code email to user
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  name: string
): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"ZMG Management System" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'ZMG - Email Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: #f7fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">🔐 Email Verification</h1>
            </div>
            <div class="content">
              <h2 style="color: #2d3748;">Hi ${name},</h2>
              <p style="color: #4a5568; line-height: 1.6;">
                Thank you for registering with ZMG Management System. 
                To complete your registration, please use the verification code below:
              </p>
              <div class="code">${code}</div>
              <p style="color: #4a5568; line-height: 1.6;">
                This code will expire in <strong>15 minutes</strong>.
              </p>
              <p style="color: #718096; font-size: 14px; margin-top: 30px;">
                If you didn't request this code, please ignore this email or contact our support team.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ZMG Management System. All rights reserved.</p>
              <p>Need help? Contact <a href="mailto:adminbalom@zmg.co.id" style="color: #2563eb;">adminbalom@zmg.co.id</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${name},

Your verification code is: ${code}

This code will expire in 15 minutes.

If you didn't request this, please ignore this email.

---
ZMG Management System
      `,
    })
    
    console.log('✅ Verification email sent to:', email)
  } catch (error) {
    console.error('❌ Failed to send email:', error)
    throw new Error('Failed to send verification email')
  }
}

/**
 * Send login alert email to user
 */
export async function sendLoginAlertEmail(
  email: string,
  name: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    const loginTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'long',
    })

    // Parse user agent for browser and OS info
    const getBrowserInfo = (ua: string) => {
      if (ua.includes('Chrome')) return 'Chrome'
      if (ua.includes('Firefox')) return 'Firefox'
      if (ua.includes('Safari')) return 'Safari'
      if (ua.includes('Edge')) return 'Edge'
      return 'Unknown Browser'
    }

    const getOSInfo = (ua: string) => {
      if (ua.includes('Windows')) return 'Windows'
      if (ua.includes('Mac')) return 'macOS'
      if (ua.includes('Linux')) return 'Linux'
      if (ua.includes('Android')) return 'Android'
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
      return 'Unknown OS'
    }

    const browser = getBrowserInfo(userAgent)
    const os = getOSInfo(userAgent)

    await transporter.sendMail({
      from: `"ZMG Security Alert" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🔔 New Login to Your ZMG Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: #f7fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            .info-label { color: #64748b; font-weight: 600; }
            .info-value { color: #1e293b; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">🔔 New Login Detected</h1>
            </div>
            <div class="content">
              <h2 style="color: #2d3748;">Hi ${name},</h2>
              <p style="color: #4a5568; line-height: 1.6;">
                We detected a new login to your ZMG Management System account.
              </p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Login Details:</h3>
                <div class="info-row">
                  <span class="info-label">Date & Time:</span>
                  <span class="info-value">${loginTime}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Browser:</span>
                  <span class="info-value">${browser}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Operating System:</span>
                  <span class="info-value">${os}</span>
                </div>
                <div class="info-row" style="border-bottom: none;">
                  <span class="info-label">IP Address:</span>
                  <span class="info-value">${ipAddress}</span>
                </div>
              </div>

              <p style="color: #4a5568; line-height: 1.6;">
                If this was you, you can safely ignore this email.
              </p>

              <div class="warning">
                <p style="margin: 0; color: #92400e; line-height: 1.6;">
                  <strong>⚠️ Wasn't you?</strong><br>
                  If you did not log in, please change your password immediately and contact our support team at 
                  <a href="mailto:adminbalom@zmg.co.id" style="color: #2563eb;">adminbalom@zmg.co.id</a>
                </p>
              </div>

              <p style="color: #718096; font-size: 14px; margin-top: 30px;">
                This is an automated security notification. You can manage your security settings in your account profile.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ZMG Management System. All rights reserved.</p>
              <p>This email was sent to ${email} because login alerts are enabled for your account.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${name},

We detected a new login to your ZMG Management System account.

Login Details:
- Date & Time: ${loginTime}
- Browser: ${browser}
- Operating System: ${os}
- IP Address: ${ipAddress}

If this was you, you can safely ignore this email.

If you did not log in, please change your password immediately and contact adminbalom@zmg.co.id

---
ZMG Management System Security
      `,
    })
    
    console.log('✅ Login alert email sent to:', email)
  } catch (error) {
    console.error('❌ Failed to send login alert email:', error)
    // Don't throw error, login alert email is not critical
  }
}

/**
 * Send welcome email after successful registration
 */
export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"ZMG Management System" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Welcome to ZMG Management System! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f7fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">🎉 Welcome to ZMG!</h1>
            </div>
            <div class="content">
              <h2 style="color: #2d3748;">Hi ${name},</h2>
              <p style="color: #4a5568; line-height: 1.6;">
                Your account has been successfully created! You can now access all features of the ZMG Management System.
              </p>
              <p style="color: #4a5568; line-height: 1.6;">
                <strong>What you can do:</strong>
              </p>
              <ul style="color: #4a5568; line-height: 1.8;">
                <li>Manage daily plans and rollout schedules</li>
                <li>Track PO status and project progress</li>
                <li>Upload and manage project files</li>
                <li>Generate reports and export data</li>
              </ul>
              <div style="text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" class="button">
                  Sign In Now
                </a>
              </div>
              <p style="color: #718096; font-size: 14px; margin-top: 30px;">
                If you have any questions, feel free to reach out to our support team.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ZMG Management System. All rights reserved.</p>
              <p>Need help? Contact <a href="mailto:adminbalom@zmg.co.id" style="color: #2563eb;">adminbalom@zmg.co.id</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    })
    
    console.log('✅ Welcome email sent to:', email)
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error)
    // Don't throw error, welcome email is not critical
  }
}
