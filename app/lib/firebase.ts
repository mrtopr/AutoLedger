import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

/**
 * Checks if Firebase environment variables are provided
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

/**
 * Initialize or get Firebase App instance
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;

  try {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return null;
  }
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}

/**
 * Initialize reCAPTCHA Verifier
 * @param containerId HTML Element ID for reCAPTCHA (e.g. 'recaptcha-container')
 */
export function initRecaptcha(containerId: string): RecaptchaVerifier | null {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  try {
    // Clear any previous captcha instance on window if present
    if (typeof window !== 'undefined' && (window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch (e) {
        // Ignore clear error
      }
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved - will proceed with submit
      },
      'expired-callback': () => {
        console.warn('reCAPTCHA expired. Please retry.');
      },
    });

    if (typeof window !== 'undefined') {
      (window as any).recaptchaVerifier = verifier;
    }

    return verifier;
  } catch (error) {
    console.error('Error initializing reCAPTCHA:', error);
    return null;
  }
}

/**
 * Send OTP to Indian mobile number (+91 XXXXXXXXXX)
 */
export async function sendFirebasePhoneOtp(
  phone10Digit: string,
  appVerifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth is not configured. Please check your .env credentials.');
  }

  // Format to E.164 format (+91 for India)
  const formattedPhone = phone10Digit.startsWith('+') 
    ? phone10Digit 
    : `+91${phone10Digit.replace(/[^0-9]/g, '').slice(-10)}`;

  return await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
}

/**
 * Verify OTP entered by user and extract ID Token
 */
export async function verifyFirebaseOtpCode(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<{ idToken: string; phoneNumber?: string | null }> {
  const userCredential = await confirmationResult.confirm(otpCode.trim());
  const idToken = await userCredential.user.getIdToken();
  return {
    idToken,
    phoneNumber: userCredential.user.phoneNumber,
  };
}
