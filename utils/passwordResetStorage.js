/**
 * Temporary storage for password reset OTPs
 * Stores OTPs in memory until verified (10 minutes expiry)
 */

const passwordResetOTPs = new Map();

/**
 * Store a password reset OTP for an email
 * @param {string} email - User's email address
 * @param {object} resetData - Reset data { otp, expiresAt, attempts }
 */
export const setPasswordResetOTP = (email, resetData) => {
  passwordResetOTPs.set(email.toLowerCase(), resetData);
};

/**
 * Get password reset OTP data for an email
 * @param {string} email - User's email address
 * @returns {object|null} Reset data or null if not found/expired
 */
export const getPasswordResetOTP = (email) => {
  const resetData = passwordResetOTPs.get(email.toLowerCase());
  
  if (!resetData) {
    return null;
  }
  
  // Check if OTP has expired
  if (resetData.expiresAt < new Date()) {
    passwordResetOTPs.delete(email.toLowerCase());
    return null;
  }
  
  return resetData;
};

/**
 * Delete password reset OTP for an email
 * @param {string} email - User's email address
 */
export const deletePasswordResetOTP = (email) => {
  passwordResetOTPs.delete(email.toLowerCase());
};

/**
 * Cleanup expired password reset OTPs
 * Runs periodically to free up memory
 */
const cleanupExpiredResets = () => {
  const now = new Date();
  for (const [email, resetData] of passwordResetOTPs.entries()) {
    if (resetData.expiresAt < now) {
      passwordResetOTPs.delete(email);
    }
  }
};

// Cleanup expired resets every 5 minutes
setInterval(cleanupExpiredResets, 5 * 60 * 1000);

export default {
  setPasswordResetOTP,
  getPasswordResetOTP,
  deletePasswordResetOTP
};
