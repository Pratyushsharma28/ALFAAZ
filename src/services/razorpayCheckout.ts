import {
  BackendRazorpayOrderResult,
  RazorpaySuccessPayload,
  RegistrationFormData,
} from '../types/registration';

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

interface RazorpayCheckoutConstructor {
  new (options: Record<string, unknown>): RazorpayCheckoutInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutConstructor;
  }
}

const RAZORPAY_CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptLoadPromise: Promise<void> | null = null;

/**
 * Dynamically loads the official Razorpay Checkout script once.
 */
export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay Checkout can only open in a browser.'));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SCRIPT_URL}"]`
    );

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => {
          scriptLoadPromise = null;
          reject(new Error('Failed to load Razorpay Checkout SDK.'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(
        new Error('Unable to load Razorpay Checkout. Please check your network connection.')
      );
    };
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

export interface OpenRazorpayCheckoutHandlers {
  order: BackendRazorpayOrderResult;
  formData: RegistrationFormData;
  onSuccessCallback: (payload: RazorpaySuccessPayload) => void;
  onPaymentFailed: (reason: string) => void;
  onCancelled: () => void;
}

/**
 * Opens the official Razorpay Checkout modal using the backend-generated order ID.
 * Note: onSuccessCallback ONLY receives the raw Razorpay payment tokens; the caller
 * must send them to the backend for signature verification before confirming.
 */
export async function openRazorpayCheckout({
  order,
  formData,
  onSuccessCallback,
  onPaymentFailed,
  onCancelled,
}: OpenRazorpayCheckoutHandlers): Promise<void> {
  await loadRazorpayCheckoutScript();

  if (!window.Razorpay) {
    throw new Error('Razorpay Checkout SDK is unavailable.');
  }

  if (!order.razorpayKeyId || !order.orderId) {
    throw new Error('Incomplete Razorpay order details returned by the backend.');
  }

  let settled = false;

  const rzp = new window.Razorpay({
    key: order.razorpayKeyId,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'ALFAAZ — UNFILTERED',
    description: `${formData.entryType.toUpperCase()} Registration · 18 Dec 2026`,
    order_id: order.orderId,
    prefill: {
      name: formData.fullName.trim(),
      email: formData.email.trim(),
      contact: formData.mobileNumber.trim(),
    },
    notes: {
      registrationId: order.registrationId,
      entryType: formData.entryType,
      categories: formData.categories.join(', '),
      college: formData.collegeName.trim(),
    },
    theme: {
      color: '#FF1744',
    },
    modal: {
      ondismiss: () => {
        if (!settled) {
          settled = true;
          onCancelled();
        }
      },
    },
    handler: (rawResponse: unknown) => {
      if (settled) return;
      settled = true;

      const resp = rawResponse as Partial<RazorpaySuccessPayload> | null;
      if (
        !resp?.razorpay_payment_id ||
        !resp?.razorpay_order_id ||
        !resp?.razorpay_signature
      ) {
        onPaymentFailed('Incomplete payment response received from Razorpay.');
        return;
      }

      onSuccessCallback({
        razorpay_payment_id: resp.razorpay_payment_id,
        razorpay_order_id: resp.razorpay_order_id,
        razorpay_signature: resp.razorpay_signature,
      });
    },
  });

  rzp.on('payment.failed', (rawError: unknown) => {
    if (settled) return;
    settled = true;

    const errObj = rawError as { error?: { description?: string; reason?: string } } | null;
    const description =
      errObj?.error?.description ||
      errObj?.error?.reason ||
      'Your payment could not be completed. Please try again.';
    onPaymentFailed(description);
  });

  rzp.open();
}
