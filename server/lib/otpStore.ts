// In-memory OTP storage for rapid verification
// In production, backed by Redis or SMS Gateway (Twilio/Fast2SMS)
export interface OtpSession {
  otp: string;
  expiresAt: number;
  customerId: string;
  tenantId: string;
}

const globalForOtp = globalThis as unknown as {
  activeOtpStore?: Map<string, OtpSession>;
};

export const activeOtpStore =
  globalForOtp.activeOtpStore || new Map<string, OtpSession>();

if (process.env.NODE_ENV !== 'production') {
  globalForOtp.activeOtpStore = activeOtpStore;
}
