const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options) {
    try {
      await this.transporter.sendMail({
        from: `${process.env.EMAIL_FROM_NAME || 'Fayshaa'} <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      console.log(`✅ Email sent successfully to ${options.to}`);
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  async sendBookingConfirmation(params) {
    const {
      to,
      guestName,
      bookingNumber,
      checkInDate,
      checkOutDate,
      unitNumber,
      apartmentCategory,
      numberOfNights,
      totalPrice,
      accessCode,
      qrCodeDataURI, // QR code as data URI
      doorPIN, // 4-digit door PIN
      depositBoxNumber, // Deposit box number
      depositBoxPIN, // Deposit box PIN
      credentials, // { username, temporaryPassword }
    } = params;

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatPrice = (price) => {
      return parseInt(price).toLocaleString();
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              background: #ffffff;
              padding: 40px 30px;
              border: 1px solid #e0e0e0;
              border-top: none;
            }
            .booking-details {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e0e0e0;
            }
            .detail-row:last-child {
              border-bottom: none;
              font-weight: bold;
              font-size: 18px;
              color: #10b981;
            }
            .access-code-box {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 25px;
              border-radius: 8px;
              text-align: center;
              margin: 25px 0;
            }
            .access-code {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
              margin: 10px 0;
            }
            .credentials-box {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 20px;
              margin: 20px 0;
            }
            .credential-item {
              font-family: 'Courier New', monospace;
              background: white;
              padding: 10px;
              margin: 5px 0;
              border-radius: 4px;
            }
            .qr-section {
              text-align: center;
              background: #f0f9f4;
              padding: 25px;
              border-radius: 8px;
              margin: 25px 0;
              border: 2px solid #10b981;
            }
            .qr-section img {
              width: 200px;
              height: 200px;
              border: 3px solid #10b981;
              border-radius: 8px;
            }
            .pin-box {
              background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
              color: #10b981;
              padding: 25px;
              text-align: center;
              border-radius: 8px;
              margin: 20px 0;
            }
            .pin-label {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-bottom: 10px;
              opacity: 0.8;
              color: #d1d5db;
            }
            .pin-value {
              font-size: 48px;
              letter-spacing: 15px;
              font-weight: bold;
              font-family: 'Courier New', monospace;
            }
            .deposit-box-section {
              background: #f0f9f4;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #10b981;
            }
            .deposit-info-row {
              display: flex;
              justify-content: space-between;
              margin: 10px 0;
              padding: 10px;
              background: white;
              border-radius: 4px;
            }
            .app-links {
              text-align: center;
              margin: 30px 0;
            }
            .app-button {
              display: inline-block;
              background: #10b981;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 5px;
              font-weight: 600;
            }
            .app-button:hover {
              background: #059669;
            }
            .footer {
              background: #f5f5f5;
              padding: 20px 30px;
              border-radius: 0 0 8px 8px;
              border: 1px solid #e0e0e0;
              border-top: none;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            .icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="icon">🏨</div>
            <h1>Booking Confirmed!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Booking #${bookingNumber}</p>
          </div>
          <div class="content">
            <p>Dear ${guestName},</p>
            <p>Thank you for choosing <strong>Fayshaa Wellness Residence</strong>! Your booking has been confirmed and we're excited to welcome you.</p>

            <div class="booking-details">
              <h3 style="margin-top: 0; color: #10b981;">📋 Booking Details</h3>
              <div class="detail-row">
                <span>Apartment:</span>
                <strong>${apartmentCategory} - Unit ${unitNumber}</strong>
              </div>
              <div class="detail-row">
                <span>Check-in:</span>
                <strong>${formatDate(checkInDate)}</strong>
              </div>
              <div class="detail-row">
                <span>Check-out:</span>
                <strong>${formatDate(checkOutDate)}</strong>
              </div>
              <div class="detail-row">
                <span>Number of Nights:</span>
                <strong>${numberOfNights}</strong>
              </div>
              <div class="detail-row">
                <span>Total Amount:</span>
                <strong>${formatPrice(totalPrice)} XAF</strong>
              </div>
            </div>

            <div class="access-code-box">
              <h3 style="margin-top: 0;">🔑 Your Access Code</h3>
              <p style="margin: 5px 0; opacity: 0.9;">Use this code to access your apartment:</p>
              <div class="access-code">${accessCode}</div>
              <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.8;">Please keep this code secure</p>
            </div>

            ${qrCodeDataURI ? `
              <div class="qr-section">
                <h3 style="margin: 0 0 15px; color: #10b981;">🚪 Gate QR Code</h3>
                <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 15px 0;">
                  <p style="margin: 0 0 15px; color: #666; font-size: 14px;">Your QR code is available in the <strong>Fayshaa Mobile App</strong> under <em>"My Bookings"</em> or <em>"Digital Keys"</em> section.</p>
                  <div style="background: #f0f9f4; padding: 15px; border-radius: 6px; border: 2px dashed #10b981;">
                    <p style="margin: 0 0 5px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">QR Code Data</p>
                    <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 11px; color: #059669; word-break: break-all; line-height: 1.4;">${accessCode}</p>
                  </div>
                  <p style="margin: 15px 0 0; font-size: 13px; color: #666;">💡 <strong>Tip:</strong> Open the Fayshaa app and navigate to your booking to view and scan the QR code at the gate.</p>
                </div>
              </div>
            ` : ''}

            ${doorPIN ? `
              <h3 style="color: #10b981; margin: 25px 0 10px;">🔢 Door PIN</h3>
              <div class="pin-box">
                <div class="pin-label">Enter on keypad</div>
                <div class="pin-value">${doorPIN}</div>
              </div>
            ` : ''}

            ${depositBoxNumber ? `
              <div class="deposit-box-section">
                <h3 style="margin-top: 0; color: #10b981;">📦 Your Deposit Box</h3>
                <div class="deposit-info-row">
                  <span style="color: #666; font-weight: bold;">Box Number:</span>
                  <span style="color: #10b981; font-weight: bold; font-size: 18px;">${depositBoxNumber}</span>
                </div>
                ${depositBoxPIN ? `
                  <div class="deposit-info-row">
                    <span style="color: #666; font-weight: bold;">Current PIN:</span>
                    <span style="color: #10b981; font-weight: bold; font-family: 'Courier New', monospace; font-size: 18px;">${depositBoxPIN}</span>
                  </div>
                ` : ''}
                <p style="font-size: 12px; color: #666; margin: 15px 0 0; padding: 10px; background: white; border-radius: 4px;">
                  💡 <strong>Security Feature:</strong> PIN changes after each opening for enhanced security
                </p>
              </div>
            ` : ''}

            ${credentials ? `
              <div class="credentials-box">
                <h3 style="margin-top: 0; color: #856404;">📱 Mobile App Access</h3>
                <p style="margin: 10px 0;">An account has been created for you to access our mobile app. You can use the app to book wellness services, view your bookings, and more!</p>
                <div class="credential-item">
                  <strong>Email:</strong> ${to}
                </div>
                <div class="credential-item">
                  <strong>Username:</strong> ${credentials.username}
                </div>
                <div class="credential-item">
                  <strong>Temporary Password:</strong> ${credentials.temporaryPassword}
                </div>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #856404;">⚠️ Please change your password after your first login.</p>
              </div>

              <div class="app-links">
                <h3 style="color: #10b981;">Download Our App</h3>
                <p style="margin: 10px 0;">Access wellness services, manage bookings, and more:</p>
                <a href="${process.env.IOS_APP_URL || '#'}" class="app-button">📱 iOS App</a>
                <a href="${process.env.ANDROID_APP_URL || '#'}" class="app-button">🤖 Android App</a>
              </div>
            ` : ''}

            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #2e7d32;">📍 Check-In Information</h3>
              <p style="margin: 5px 0;"><strong>Time:</strong> From 2:00 PM</p>
              <p style="margin: 5px 0;"><strong>Location:</strong> Fayshaa Wellness Residence, Cameroon</p>
              <p style="margin: 5px 0;"><strong>Access:</strong> Use your access code (${accessCode}) at the smart lock</p>
            </div>

            <p>If you have any questions or special requests, please don't hesitate to contact us.</p>

            <p style="margin-top: 30px;">
              We look forward to hosting you!<br>
              <strong>The Fayshaa Team</strong>
            </p>
          </div>
          <div class="footer">
            <p style="margin: 5px 0;">
              <strong>Fayshaa Wellness Residence</strong><br>
              Cameroon
            </p>
            <p style="margin: 10px 0;">
              Need help? Contact us at <a href="mailto:${process.env.CONTACT_EMAIL}" style="color: #10b981; text-decoration: none;">${process.env.CONTACT_EMAIL}</a>
            </p>
            <p style="margin: 10px 0;">&copy; ${new Date().getFullYear()} Fayshaa Wellness Residence. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Booking Confirmed!

Dear ${guestName},

Thank you for choosing Fayshaa Wellness Residence! Your booking has been confirmed.

BOOKING DETAILS
---------------
Booking Number: ${bookingNumber}
Apartment: ${apartmentCategory} - Unit ${unitNumber}
Check-in: ${formatDate(checkInDate)}
Check-out: ${formatDate(checkOutDate)}
Number of Nights: ${numberOfNights}
Total Amount: ${formatPrice(totalPrice)} XAF

YOUR ACCESS CODE
---------------
${accessCode}

Please keep this code secure. You'll need it to access your apartment.

${credentials ? `
MOBILE APP CREDENTIALS
---------------------
Email: ${to}
Username: ${credentials.username}
Temporary Password: ${credentials.temporaryPassword}

⚠️ Please change your password after your first login.

Download our mobile app to access wellness services and manage your bookings:
iOS: ${process.env.IOS_APP_URL || 'Available soon'}
Android: ${process.env.ANDROID_APP_URL || 'Available soon'}
` : ''}

CHECK-IN INFORMATION
-------------------
Time: From 2:00 PM
Location: Fayshaa Wellness Residence, Cameroon
Access: Use your access code at the smart lock

If you have any questions, contact us at ${process.env.CONTACT_EMAIL}

We look forward to hosting you!

The Fayshaa Team
    `.trim();

    await this.sendEmail({
      to,
      subject: `Booking Confirmed - ${bookingNumber} | Fayshaa Wellness Residence`,
      html,
      text,
    });
  }

  /**
   * Send comprehensive apartment booking confirmation email with all details
   * Includes: booking details, access codes, QR code, digital keys, and credentials
   */
  async sendApartmentDigitalKey(params) {
    const {
      to,
      name,
      bookingNumber,
      apartmentName,
      villaNumber,
      checkInDate,
      checkOutDate,
      numberOfNights,
      totalPrice,
      accessCode,
      qrCodeDataURI,
      doorPIN,
      depositBoxNumber,
      depositBoxPIN,
      credentials, // { username, email, temporaryPassword }
    } = params;

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatPrice = (price) => {
      return parseInt(price).toLocaleString();
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #0D0D0D; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #F2E9D8; border-radius: 10px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #C8A45D 0%, #A08444 100%); padding: 40px; text-align: center; color: #0D0D0D; }
          .header h1 { margin: 0 0 10px; font-size: 28px; }
          .header p { margin: 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 40px; }
          .success-message { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 10px; margin-bottom: 30px; }
          .success-message h2 { margin: 0; font-size: 24px; }
          .qr-section { text-align: center; padding: 30px; background: #E8DCC5; border-radius: 10px; margin-bottom: 30px; }
          .qr-section img { width: 200px; height: 200px; }
          .qr-section p { margin: 15px 0 0; color: #666; font-size: 14px; }
          .access-code-box { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px; text-align: center; border-radius: 10px; margin: 20px 0; }
          .access-code-label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; opacity: 0.9; }
          .access-code-value { font-size: 36px; letter-spacing: 8px; font-weight: bold; font-family: 'Courier New', monospace; }
          .pin-box { background: #0D0D0D; color: #C8A45D; padding: 25px; text-align: center; border-radius: 10px; margin: 20px 0; }
          .pin-label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; opacity: 0.8; }
          .pin-value { font-size: 48px; letter-spacing: 15px; font-weight: bold; }
          .info-section { background: #E8DCC5; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
          .info-label { font-weight: bold; color: #666; }
          .info-value { color: #0D0D0D; }
          .credentials-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
          .credential-item { font-family: 'Courier New', monospace; background: white; padding: 10px; margin: 5px 0; border-radius: 4px; }
          .footer { padding: 30px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Booking Confirmed!</h1>
            <p>Booking #${bookingNumber}</p>
          </div>

          <div class="content">
            <div class="success-message">
              <h2>✓ Thank You for Choosing Fayshaa!</h2>
              <p style="margin: 10px 0 0;">Your reservation is confirmed and we're excited to welcome you.</p>
            </div>

            <h2 style="color: #0D0D0D; margin-top: 0;">Your Stay Details</h2>
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">Apartment:</span>
                <span class="info-value">${apartmentName} - ${villaNumber}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Check-in:</span>
                <span class="info-value">${formatDate(checkInDate)} at 2:00 PM</span>
              </div>
              <div class="info-row">
                <span class="info-label">Check-out:</span>
                <span class="info-value">${formatDate(checkOutDate)} at 11:00 AM</span>
              </div>
              <div class="info-row">
                <span class="info-label">Number of Nights:</span>
                <span class="info-value">${numberOfNights}</span>
              </div>
              <div class="info-row" style="font-size: 18px; color: #10b981; font-weight: bold; border-top: 2px solid #C8A45D; padding-top: 10px; margin-top: 10px;">
                <span class="info-label">Total Amount:</span>
                <span class="info-value">${formatPrice(totalPrice)} XAF</span>
              </div>
            </div>

            <h2 style="color: #0D0D0D;">🔑 Your Access Codes</h2>
            <p style="color: #666; margin-bottom: 20px;">Save these codes - you'll need them to access your apartment:</p>

            <div class="access-code-box">
              <div class="access-code-label">Apartment Access Code</div>
              <div class="access-code-value">${accessCode}</div>
              <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.8;">Keep this code secure</p>
            </div>

            <div class="qr-section">
              <h3 style="margin: 0 0 20px; color: #0D0D0D;">🚪 Gate QR Code</h3>
              <img src="${qrCodeDataURI}" alt="QR Code" />
              <p><strong>Scan at gate to enter</strong></p>
              <p style="font-size: 12px;">Hold phone steady • Works offline</p>
            </div>

            <h3 style="color: #0D0D0D;">🔢 Door PIN</h3>
            <div class="pin-box">
              <div class="pin-label">Enter on keypad</div>
              <div class="pin-value">${doorPIN}</div>
            </div>

            <div class="info-section">
              <h3 style="margin-top: 0; color: #0D0D0D;">📦 Deposit Box</h3>
              <div class="info-row">
                <span class="info-label">Box Number:</span>
                <span class="info-value">${depositBoxNumber}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Current PIN:</span>
                <span class="info-value">${depositBoxPIN}</span>
              </div>
              <p style="font-size: 12px; color: #666; margin-top: 15px;">
                💡 PIN changes after each opening for security
              </p>
            </div>

            ${credentials ? `
              <div class="credentials-box">
                <h3 style="margin-top: 0; color: #856404;">📱 Your Mobile App Access</h3>
                <p style="margin: 10px 0;">An account has been created for you to access the Fayshaa mobile app. Use the app to book wellness services, view your bookings, and access your digital keys!</p>
                <div class="credential-item">
                  <strong>Email:</strong> ${credentials.email}
                </div>
                <div class="credential-item">
                  <strong>Username:</strong> ${credentials.username}
                </div>
                ${credentials.temporaryPassword ? `
                  <div class="credential-item">
                    <strong>Temporary Password:</strong> ${credentials.temporaryPassword}
                  </div>
                  <p style="margin: 10px 0 0 0; font-size: 13px; color: #856404;">⚠️ Please change your password after your first login for security.</p>
                ` : credentials.note ? `
                  <p style="margin: 10px 0; padding: 10px; background: #fff; border-radius: 4px; font-size: 13px; color: #856404;">
                    ⚠️ ${credentials.note}
                  </p>
                ` : ''}

                <div style="margin-top: 20px; text-align: center;">
                  <p style="font-weight: bold; margin-bottom: 10px;">Download Our App:</p>
                  <a href="https://apps.apple.com/app/fayshaa" style="display: inline-block; background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 5px;">📱 App Store</a>
                  <a href="https://play.google.com/store/apps/details?id=com.fayshaa" style="display: inline-block; background: #10b981; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 5px;">🤖 Google Play</a>
                </div>
              </div>
            ` : ''}

            <div style="background: #FFF4E5; padding: 15px; border-radius: 10px; border-left: 4px solid #C8A45D; margin-top: 30px;">
              <p style="margin: 0; font-size: 13px; color: #666;">
                <strong>📱 Tip:</strong> All your keys and booking details are also available in the Fayshaa mobile app under "My Bookings" and "Digital Keys".
              </p>
            </div>

            <div style="background: #E8DCC5; padding: 15px; border-radius: 10px; margin-top: 20px;">
              <h3 style="margin-top: 0; color: #0D0D0D;">📍 Check-in Information</h3>
              <p style="margin: 5px 0;"><strong>Location:</strong> Fayshaa Wellness Residence, Yaoundé, Cameroon</p>
              <p style="margin: 5px 0;"><strong>Check-in Time:</strong> 2:00 PM onwards</p>
              <p style="margin: 5px 0;"><strong>Check-out Time:</strong> 11:00 AM</p>
            </div>
          </div>

          <div class="footer">
            <p><strong>Need Help?</strong></p>
            <p>Contact us at concierge@fayshaa.com or +237 651 841 003</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} Fayshaa Wellness Residence - Property by Result</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: `Booking Confirmed! Your Access Codes & Details - Booking #${bookingNumber}`,
      html,
    });
  }

  /**
   * Send wellness journey confirmation email with journey PIN
   */
  async sendWellnessJourneyConfirmation(params) {
    const { to, name, journeyName, journeyPIN, date, time, duration, gateQRCode, doorPIN } = params;

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="background: #0D0D0D; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #F2E9D8; border-radius: 10px;">
          <div style="background: linear-gradient(135deg, #7fae8a 0%, #4a7c59 100%); padding: 40px; text-align: center; color: #FFF;">
            <h1 style="margin: 0;">✦ Your Wellness Journey Awaits</h1>
            <p style="margin: 10px 0 0; font-size: 18px;">${journeyName}</p>
          </div>

          <div style="padding: 40px; text-align: center;">
            <h2 style="color: #0D0D0D;">Journey PIN</h2>
            <div style="background: #7fae8a; color: #FFF; padding: 30px; border-radius: 10px; margin: 20px 0;">
              <div style="font-size: 60px; letter-spacing: 20px; font-weight: bold;">${journeyPIN}</div>
            </div>
            <p style="color: #666;">Use this PIN at each wellness stage entrance</p>
          </div>

          <div style="padding: 0 40px 40px;">
            <div style="background: rgba(127, 174, 138, 0.1); padding: 20px; border-radius: 10px;">
              <h3 style="color: #0D0D0D; margin-top: 0;">Your Journey Details</h3>
              <p style="color: #666;"><strong>Date:</strong> ${formatDate(date)}</p>
              <p style="color: #666;"><strong>Time:</strong> ${time}</p>
              <p style="color: #666;"><strong>Duration:</strong> ${duration}</p>
            </div>

            ${doorPIN ? `
            <div style="background: rgba(200, 164, 93, 0.15); padding: 20px; border-radius: 10px; margin-top: 20px;">
              <h3 style="color: #0D0D0D; margin-top: 0;">🔑 Your Apartment Access</h3>
              <p style="color: #666; margin-bottom: 15px;">These codes remain the same for your entire stay:</p>

              <div style="background: #FFF; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #C8A45D;">
                <p style="color: #666; margin: 0 0 8px 0;"><strong>🚪 Door PIN:</strong></p>
                <div style="background: #C8A45D; color: #FFF; padding: 15px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 40px; letter-spacing: 15px; font-weight: bold;">${doorPIN}</div>
                </div>
              </div>

              ${gateQRCode ? `
              <div style="background: #FFF; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #C8A45D;">
                <p style="color: #666; margin: 0 0 8px 0;"><strong>🔓 Gate QR Code:</strong></p>
                <div style="background: #FFF; padding: 10px; border-radius: 6px; text-align: center;">
                  <div style="font-family: monospace; font-size: 14px; background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; color: #333;">
                    ${gateQRCode}
                  </div>
                  <p style="color: #999; font-size: 11px; margin: 8px 0 0;">Scan this code at the main gate</p>
                </div>
              </div>
              ` : ''}

              <p style="color: #666; font-size: 13px; margin-top: 15px; font-style: italic;">
                💡 These access codes are valid for your entire stay and can also be found in the Fayshaa app under "Digital Keys"
              </p>
            </div>
            ` : ''}

            <div style="background: #FFF4E5; padding: 15px; border-radius: 10px; border-left: 4px solid #7fae8a; margin-top: 20px;">
              <p style="margin: 0; font-size: 13px; color: #666;">
                <strong>📱 Pro Tip:</strong> All your access codes (Journey PIN, Door PIN, and Gate QR) are always available in the Fayshaa mobile app under "Digital Keys" section.
              </p>
            </div>
          </div>

          <div style="padding: 30px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #E8DCC5;">
            <p>Questions? Contact our Wellness Concierge at +237 651 841 003</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} Fayshaa - Property by Result</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: `Your ${journeyName} - Wellness Journey Confirmation`,
      html,
    });
  }

  async sendPasswordResetEmail(params) {
    const { to, userName, resetToken } = params;

    // Create reset link (will be handled by the mobile app)
    const resetLink = `${process.env.APP_URL || 'https://fayshaa.com'}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #C8A45D 0%, #9B7A3C 100%);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              background: #ffffff;
              padding: 40px 30px;
              border: 1px solid #e0e0e0;
              border-top: none;
            }
            .reset-box {
              background: linear-gradient(135deg, #C8A45D 0%, #9B7A3C 100%);
              color: white;
              padding: 25px;
              border-radius: 8px;
              text-align: center;
              margin: 25px 0;
            }
            .reset-button {
              display: inline-block;
              background: white;
              color: #C8A45D;
              padding: 15px 40px;
              text-decoration: none;
              border-radius: 6px;
              margin: 15px 0;
              font-weight: 600;
              font-size: 16px;
            }
            .footer {
              background: #f5f5f5;
              padding: 20px 30px;
              border-radius: 0 0 8px 8px;
              border: 1px solid #e0e0e0;
              border-top: none;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            .icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="icon">🔐</div>
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello${userName ? ` ${userName}` : ''},</p>
            <p>We received a request to reset your password for your Fayshaa Wellness Residence account.</p>

            <div class="reset-box">
              <h3 style="margin-top: 0;">Reset Your Password</h3>
              <p style="margin: 10px 0; opacity: 0.9;">Click the button below to choose a new password:</p>
              <a href="${resetLink}" class="reset-button">Reset Password</a>
              <p style="margin: 15px 0 0 0; font-size: 13px; opacity: 0.8;">This link will expire in 1 hour</p>
            </div>

            <div class="warning">
              <p style="margin: 0; color: #856404;"><strong>⚠️ Security Notice:</strong></p>
              <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>Your password will remain unchanged unless you click the link above</li>
                <li>Never share your password with anyone</li>
              </ul>
            </div>

            <p style="margin-top: 25px; font-size: 14px; color: #666;">
              <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br>
              <span style="color: #C8A45D; word-break: break-all;">${resetLink}</span>
            </p>

            <p style="margin-top: 30px;">
              If you have any questions, feel free to contact our support team.<br>
              <strong>The Fayshaa Team</strong>
            </p>
          </div>
          <div class="footer">
            <p style="margin: 5px 0;">
              <strong>Fayshaa Wellness Residence</strong><br>
              Cameroon
            </p>
            <p style="margin: 10px 0;">
              Need help? Contact us at <a href="mailto:${process.env.CONTACT_EMAIL}" style="color: #C8A45D; text-decoration: none;">${process.env.CONTACT_EMAIL}</a>
            </p>
            <p style="margin: 10px 0;">&copy; ${new Date().getFullYear()} Fayshaa Wellness Residence. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Password Reset Request

Hello${userName ? ` ${userName}` : ''},

We received a request to reset your password for your Fayshaa Wellness Residence account.

RESET YOUR PASSWORD
-------------------
Click the link below or copy it into your browser to reset your password:
${resetLink}

This link will expire in 1 hour.

SECURITY NOTICE
---------------
- If you didn't request this password reset, please ignore this email
- Your password will remain unchanged unless you use the link above
- Never share your password with anyone

If you have any questions, contact us at ${process.env.CONTACT_EMAIL}

The Fayshaa Team
    `.trim();

    await this.sendEmail({
      to,
      subject: 'Password Reset Request | Fayshaa Wellness Residence',
      html,
      text,
    });
  }
}

module.exports = new EmailService();
