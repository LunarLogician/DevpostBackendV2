const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const SENDER_NAME = process.env.EMAIL_FROM_NAME || 'DevPost AI';
const SENDER_EMAIL = process.env.EMAIL_FROM || 'zzubairahmed402@gmail.com';

const sendEmail = async (to, subject, html) => {
  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Brevo error ${res.status}`);
  return data;
};

// Send verification email with OTP
export const sendVerificationEmail = async (email, name, otp) => {
  try {
    console.log('\n📧 =================================');
    console.log('📧 SENDING OTP VERIFICATION EMAIL');
    console.log('   To:', email, '| OTP:', otp);
    console.log('📧 =================================\n');

    const data = await sendEmail(
      email,
      'Verify Your Email - DevPost AI',
      `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333">
        <div style="max-width:600px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0">
            <h1>🚀 Welcome to DevPost AI!</h1>
          </div>
          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
            <p>Hi ${name},</p>
            <p>Thanks for signing up! Enter this code to verify your account:</p>
            <div style="background:white;border:2px dashed #667eea;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
              <p style="margin:0;color:#666;font-size:14px">Your Verification Code</p>
              <div style="font-size:36px;font-weight:bold;color:#667eea;letter-spacing:8px;margin:10px 0">${otp}</div>
              <p style="margin:0;color:#666;font-size:12px">Valid for 10 minutes</p>
            </div>
            <p>If you didn't create an account, ignore this email.</p>
            <p>Best regards,<br>The DevPost AI Team</p>
          </div>
        </div>
      </body></html>`
    );

    console.log('✅ Verification email sent! MessageId:', data.messageId);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('❌ EMAIL FAILED:', error.message);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset OTP email
export const sendPasswordResetEmail = async (email, name, otp) => {
  try {
    console.log('\n🔐 =================================');
    console.log('🔐 SENDING PASSWORD RESET OTP');
    console.log('   To:', email, '| OTP:', otp);
    console.log('🔐 =================================\n');

    const data = await sendEmail(
      email,
      'Reset Your Password - DevPost AI',
      `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333">
        <div style="max-width:600px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0">
            <h1>🔐 Reset Your Password</h1>
          </div>
          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
            <p>Hi ${name},</p>
            <p>Enter this code to reset your DevPost AI password:</p>
            <div style="background:white;border:2px dashed #667eea;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
              <p style="margin:0;color:#666;font-size:14px">Your Reset Code</p>
              <div style="font-size:36px;font-weight:bold;color:#667eea;letter-spacing:8px;margin:10px 0">${otp}</div>
              <p style="margin:0;color:#666;font-size:12px">Valid for 10 minutes</p>
            </div>
            <p>If you didn't request this, ignore this email.</p>
            <p>Best regards,<br>The DevPost AI Team</p>
          </div>
        </div>
      </body></html>`
    );

    console.log('✅ Password reset email sent! MessageId:', data.messageId);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('❌ PASSWORD RESET EMAIL FAILED:', error.message);
    throw new Error('Failed to send password reset email');
  }
};
