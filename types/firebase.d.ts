declare module 'firebase/app' {
  export interface FirebaseApp {
    name: string;
    options: Record<string, any>;
  }
  export function initializeApp(options: Record<string, any>, name?: string): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function getApp(name?: string): FirebaseApp;
}

declare module 'firebase/auth' {
  export interface Auth {
    currentUser: any;
    [key: string]: any;
  }
  export interface ConfirmationResult {
    confirm(verificationCode: string): Promise<any>;
    verificationId: string;
  }
  export class RecaptchaVerifier {
    constructor(container: any, parameters?: any, auth?: any);
    render(): Promise<number>;
    clear(): void;
    verify(): Promise<string>;
  }
  export function getAuth(app?: any): Auth;
  export function signInWithPhoneNumber(auth: Auth, phoneNumber: string, appVerifier: any): Promise<ConfirmationResult>;
}

