import crypto from 'crypto';
import Razorpay from 'razorpay';

export interface CreatePaymentLinkParams {
  amountPaise: number; // in paise (e.g. 50000 = ₹500.00)
  currency?: string;
  description: string;
  customer: {
    name: string;
    contact: string;
    email?: string;
  };
  notes?: Record<string, string>;
  invoiceId?: string;
  customerId?: string;
  tenantId?: string;
}

export interface PaymentLinkResult {
  id: string;
  shortUrl: string;
  status: string;
  amountPaise: number;
  qrUrl?: string;
  isMock?: boolean;
}

/**
 * Get Razorpay client instance with fallback support
 */
export function getRazorpayClient(customKeyId?: string, customSecret?: string) {
  const key_id = customKeyId || process.env.RAZORPAY_KEY_ID;
  const key_secret = customSecret || process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    return null;
  }

  return new Razorpay({
    key_id,
    key_secret,
  });
}

/**
 * Verify Razorpay Webhook HMAC SHA256 Signature
 */
export function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
  secret?: string
): boolean {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || 'autoledger_webhook_secret_2026';
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf-8'),
      Buffer.from(signature, 'utf-8')
    );
  } catch (err) {
    console.error('Webhook signature verification error:', err);
    return false;
  }
}

/**
 * Create a dynamic Razorpay Payment Link for invoice or khata collection
 */
export async function createPaymentLink(
  params: CreatePaymentLinkParams,
  customKeyId?: string,
  customSecret?: string
): Promise<PaymentLinkResult> {
  const razorpay = getRazorpayClient(customKeyId, customSecret);

  // If Razorpay keys are configured, make live API call
  if (razorpay) {
    try {
      const response: any = await razorpay.paymentLink.create({
        amount: params.amountPaise,
        currency: params.currency || 'INR',
        accept_partial: false,
        description: params.description,
        customer: {
          name: params.customer.name,
          contact: params.customer.contact.replace(/\D/g, '').slice(-10),
          email: params.customer.email || undefined,
        },
        notify: {
          sms: true,
          email: Boolean(params.customer.email),
        },
        reminder_enable: true,
        notes: {
          tenantId: params.tenantId || '',
          customerId: params.customerId || '',
          invoiceId: params.invoiceId || '',
          platform: 'AutoLedger ERP',
          ...params.notes,
        },
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://x-autoledger.vercel.app'}/pos`,
        callback_method: 'get',
      });

      return {
        id: response.id,
        shortUrl: response.short_url,
        status: response.status,
        amountPaise: response.amount,
        isMock: false,
      };
    } catch (apiErr: any) {
      console.warn('Razorpay API error, falling back to instant sandbox link:', apiErr?.message);
    }
  }

  // Developer / Sandbox Instant Mock Link fallback
  const mockId = `plink_${Math.random().toString(36).substring(2, 10)}`;
  const cleanPhone = params.customer.contact.replace(/\D/g, '').slice(-10);
  const amountRupees = (params.amountPaise / 100).toFixed(2);
  const encodedDesc = encodeURIComponent(params.description);
  
  // Standard UPI Intent Link
  const upiIntentUrl = `upi://pay?pa=autoledger@okhdfcbank&pn=${encodeURIComponent(params.customer.name)}&am=${amountRupees}&cu=INR&tn=${encodedDesc}`;

  return {
    id: mockId,
    shortUrl: `https://rzp.io/i/demo-${mockId}`,
    status: 'created',
    amountPaise: params.amountPaise,
    qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiIntentUrl)}`,
    isMock: true,
  };
}
