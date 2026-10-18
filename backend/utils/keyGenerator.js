const crypto = require('crypto');
const pool = require('../config/database');

/**
 * Generate a random 4-digit PIN (no repeating consecutive digits for better security)
 */
function generatePIN() {
  const digits = [];
  let lastDigit = null;

  while (digits.length < 4) {
    const digit = Math.floor(Math.random() * 10);
    // Avoid consecutive repeating digits (e.g., 1122 is ok, but 1112 is not great)
    if (digit !== lastDigit || digits.length === 0) {
      digits.push(digit);
      lastDigit = digit;
    }
  }

  return digits.join('');
}

/**
 * Generate QR code string for gate/venue access
 * Format: FAYSHAA-[TYPE]-[BOOKING_ID]-[USER_ID]-[TIMESTAMP]
 */
function generateQRCode(type, bookingId, userId) {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
  return `FAYSHAA-${type.toUpperCase()}-${bookingId}-${userId}-${timestamp}-${randomSuffix}`;
}

/**
 * Assign deposit box number based on apartment
 * Fetches the actual deposit box from the database
 */
async function assignDepositBox(apartmentId) {
  try {
    // Query the actual deposit box from the database
    const result = await pool.query(`
      SELECT box_number, current_pin
      FROM deposit_boxes
      WHERE apartment_id = $1
      LIMIT 1
    `, [apartmentId]);

    if (result.rows.length > 0) {
      return {
        boxNumber: result.rows[0].box_number,
        boxPIN: result.rows[0].current_pin
      };
    }

    // Fallback: if no deposit box found, create a temporary reference
    console.warn(`⚠️ No deposit box found for apartment_id ${apartmentId}, using fallback`);
    const boxNumber = `DB-${String(apartmentId).padStart(3, '0')}`;
    return {
      boxNumber: boxNumber,
      boxPIN: generatePIN()
    };
  } catch (error) {
    console.error('Error querying deposit box:', error);
    // Fallback in case of error
    const boxNumber = `DB-${String(apartmentId).padStart(3, '0')}`;
    return {
      boxNumber: boxNumber,
      boxPIN: generatePIN()
    };
  }
}

/**
 * Generate all keys for an apartment booking
 * NOTE: This is now async because it needs to query the database
 */
async function generateApartmentKeys(bookingId, userId, apartmentId) {
  const depositBox = await assignDepositBox(apartmentId);

  return {
    gateQRCode: generateQRCode('APT', bookingId, userId),
    doorPIN: generatePIN(),
    depositBoxNumber: depositBox.boxNumber,
    depositBoxPIN: depositBox.boxPIN,
    generatedAt: new Date(),
  };
}

/**
 * Generate all keys for a wellness journey booking
 */
function generateWellnessKeys(bookingId, userId) {
  return {
    qrCode: generateQRCode('WELLNESS', bookingId, userId),
    journeyPIN: generatePIN(),
    generatedAt: new Date(),
  };
}

/**
 * Generate a new deposit box PIN (for when box is opened)
 */
function regenerateDepositBoxPIN() {
  return generatePIN();
}

module.exports = {
  generatePIN,
  generateQRCode,
  assignDepositBox,
  generateApartmentKeys,
  generateWellnessKeys,
  regenerateDepositBoxPIN,
};
