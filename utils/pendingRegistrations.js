// In-memory storage for pending registrations (before OTP verification)
// This could be replaced with Redis in production for scalability

const pendingRegistrations = new Map();

// Store pending registration
export const storePendingRegistration = (email, data) => {
  pendingRegistrations.set(email.toLowerCase(), {
    ...data,
    createdAt: Date.now()
  });
};

// Get pending registration
export const getPendingRegistration = (email) => {
  return pendingRegistrations.get(email.toLowerCase());
};

// Delete pending registration
export const deletePendingRegistration = (email) => {
  pendingRegistrations.delete(email.toLowerCase());
};

// Clean up expired registrations (older than 10 minutes)
export const cleanupExpiredRegistrations = () => {
  const now = Date.now();
  const expiryTime = 10 * 60 * 1000; // 10 minutes
  
  for (const [email, data] of pendingRegistrations.entries()) {
    if (now - data.createdAt > expiryTime) {
      pendingRegistrations.delete(email);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredRegistrations, 5 * 60 * 1000);
