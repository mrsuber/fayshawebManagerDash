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

  /** Outgoing email needs SMTP_USER and SMTP_PASS (see .env.example). */
  get configured() {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  async sendEmail(options) {
    if (!this.configured) {
      console.warn(`✉️  Email to ${options.to} not sent: outgoing email is not configured (SMTP_USER / SMTP_PASS)`);
      throw new Error('Outgoing email is not configured');
    }
    try {
      await this.transporter.sendMail({
        from: `${process.env.EMAIL_FROM_NAME || 'Fayshaa'} <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
        replyTo: options.replyTo,
      });
      console.log(`✅ Email sent successfully to ${options.to}`);
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  /**
   * The stay confirmation: dates, residence, amount, the digital key (gate QR attached inline, door PIN, deposit box)
   * and, for a guest who has never signed in, their first sign-in details. Built by services/stayKeys.js.
   */
  async sendBookingConfirmation(params) {
    const { layout, panel, row, code, button, esc, C, sans } = require('./emailLayout');
    const { formatMoney } = require('../utils/money');
    const {
      to, guestName, bookingNumber, checkInDate, checkOutDate, checkInTime = '14:00', checkOutTime = '11:00',
      unitNumber, apartmentCategory, numberOfNights, totalPrice, currency = 'XAF',
      gateCode, qrCodePng, doorPIN, depositBoxNumber, depositBoxPIN, credentials,
    } = params;
    const appUrl = process.env.APP_URL || 'https://fayshaa.com';
    const stores = [
      process.env.IOS_APP_URL ? `<a href="${esc(process.env.IOS_APP_URL)}" style="color:${C.gold}">App Store</a>` : '',
      process.env.ANDROID_APP_URL ? `<a href="${esc(process.env.ANDROID_APP_URL)}" style="color:${C.gold}">Google Play</a>` : '',
    ].filter(Boolean).join(' · ');

    const stay = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row('Booking', esc(bookingNumber))}
      ${row('Residence', `${esc(apartmentCategory)} · ${esc(unitNumber)}`)}
      ${row('Arrival', `${esc(checkInDate)}<br><span style="color:${C.muted};font-size:13px">from ${esc(checkInTime)}</span>`)}
      ${row('Departure', `${esc(checkOutDate)}<br><span style="color:${C.muted};font-size:13px">by ${esc(checkOutTime)}</span>`)}
      ${row('Nights', esc(numberOfNights))}
      ${row('Total paid', `<strong style="color:${C.gold}">${esc(formatMoney(totalPrice, currency))}</strong>`)}
    </table>`;

    const key = gateCode
      ? panel('Your digital key', `
        ${qrCodePng ? `<div style="text-align:center;margin:4px 0 16px"><img src="cid:gate-qr" width="200" height="200" alt="Gate QR code" style="background:#fff;padding:10px;border-radius:12px"></div>
        <p style="margin:0 0 18px;text-align:center;font:13px ${sans};color:${C.muted}">Show this code at the gate. It is also in the Faysha app.</p>` : ''}
        ${doorPIN ? code(doorPIN, 'Residence door PIN') : ''}
        ${depositBoxNumber ? `<div style="margin-top:18px;padding-top:16px;border-top:1px solid ${C.line}">
          <div style="font:14px ${sans};color:${C.text}">Deposit box <strong style="color:${C.gold}">${esc(depositBoxNumber)}</strong></div>
          <div style="font:13px/1.6 ${sans};color:${C.muted};margin-top:4px">${depositBoxPIN
            ? `PIN <strong style="color:${C.text};font-family:'Courier New',monospace">${esc(depositBoxPIN)}</strong>. Deliveries arrive here; the PIN changes after each delivery and the app always shows the current one.`
            : 'Your deposit box PIN appears in the app when your stay begins.'}</div>
        </div>` : ''}`)
      : '';

    const account = credentials && credentials.temporaryPassword
      ? panel('Your Faysha account', `
        <p style="margin:0 0 12px;font:14px/1.6 ${sans};color:${C.muted}">We created your account so you can open your key, order dining, book wellness and talk to the concierge from the Faysha app.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row('Email', esc(credentials.email || to))}
          ${row('Temporary password', `<span style="font-family:'Courier New',monospace;color:${C.gold};font-size:16px">${esc(credentials.temporaryPassword)}</span>`)}
        </table>
        <p style="margin:14px 0 0;font:13px/1.6 ${sans};color:${C.muted}">You will choose your own password the first time you sign in.${stores ? ` Get the app: ${stores}.` : ''}</p>`)
      : '';

    const html = layout({
      preheader: `Your stay ${bookingNumber} is confirmed — ${checkInDate}`,
      title: 'Your stay is confirmed',
      intro: `Dear ${esc(guestName)}, thank you for choosing Faysha. Everything you need for your arrival is below.`,
      body: `${panel('Your stay', stay)}${key}${account}
        <div style="text-align:center;margin-top:26px">${button(`${appUrl}/account`, 'View my stay')}</div>`,
    });

    const text = [
      `Your stay is confirmed — ${bookingNumber}`,
      '',
      `${apartmentCategory} · ${unitNumber}`,
      `Arrival: ${checkInDate}, from ${checkInTime}`,
      `Departure: ${checkOutDate}, by ${checkOutTime}`,
      `Nights: ${numberOfNights}`,
      `Total paid: ${formatMoney(totalPrice, currency)}`,
      '',
      doorPIN ? `Door PIN: ${doorPIN}` : '',
      depositBoxNumber ? `Deposit box ${depositBoxNumber}${depositBoxPIN ? `, PIN ${depositBoxPIN}` : ' (PIN in the app when your stay begins)'}` : '',
      gateCode ? 'Your gate QR code is attached and in the Faysha app.' : '',
      '',
      credentials && credentials.temporaryPassword
        ? `Your Faysha account\nEmail: ${credentials.email || to}\nTemporary password: ${credentials.temporaryPassword}\nYou will choose your own password the first time you sign in.`
        : '',
      '',
      `Questions? ${process.env.CONTACT_EMAIL || appUrl}`,
    ].filter((l, i, a) => l || a[i - 1]).join('\n');

    await this.sendEmail({
      to,
      subject: `Your stay is confirmed · ${bookingNumber}`,
      html,
      text,
      attachments: qrCodePng ? [{ filename: 'gate-qr.png', content: qrCodePng, cid: 'gate-qr' }] : undefined,
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
