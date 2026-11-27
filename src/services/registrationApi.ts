import {
  BackendPaymentProofSubmissionResult,
  BackendPaymentVerificationResult,
  BackendRazorpayOrderResult,
  BackendRegistrationResult,
  ENTRY_PASS_OPTIONS,
  normalizeIndianMobile,
  RazorpaySuccessPayload,
  RegistrationFormData,
} from '../types/registration';

/**
 * ============================================================================
 * BACKEND INTEGRATION CONFIGURATION
 * ============================================================================
 * Set VITE_API_BASE_URL in your environment (e.g. https://api.yourdomain.com)
 * to connect the ALFAAZ registration flow to your backend API.
 *
 * SECURITY BOUNDARY:
 * - Razorpay Key Secret MUST remain exclusively on the backend.
 * - Order creation, amount calculation, and Razorpay signature verification
 *   MUST happen server-side.
 * - Never trust client-side payment callbacks without backend verification.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/**
 * TODO (Backend Integration):
 * Update these endpoint paths to match your backend router if needed.
 * They are intentionally centralized here so no form component hardcodes URLs.
 */
export const REGISTRATION_API_ENDPOINTS = {
  submitRegistration: '/api/registrations',
  submitPaymentProof: '/api/registrations/payment-proof',
  createRazorpayOrder: '/api/payments/razorpay/create-order',
  verifyRazorpayPayment: '/api/payments/razorpay/verify',
  checkPaymentStatus: '/api/payments/razorpay/status',
} as const;

export class RegistrationApiError extends Error {
  readonly code: 'BACKEND_NOT_CONFIGURED' | 'NETWORK_ERROR' | 'API_ERROR';
  readonly statusCode?: number;

  constructor(
    message: string,
    code: 'BACKEND_NOT_CONFIGURED' | 'NETWORK_ERROR' | 'API_ERROR',
    statusCode?: number
  ) {
    super(message);
    this.name = 'RegistrationApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isBackendConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

function buildUrl(path: string): string {
  if (!isBackendConfigured()) {
    throw new RegistrationApiError(
      'Backend API URL is not configured yet. Set VITE_API_BASE_URL to connect your registration and Razorpay backend.',
      'BACKEND_NOT_CONFIGURED'
    );
  }
  return `${API_BASE_URL}${path}`;
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const url = buildUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RegistrationApiError(
      'Unable to reach the registration server. Please check your internet connection and try again.',
      'NETWORK_ERROR'
    );
  }

  let parsedBody: Record<string, unknown> | null = null;
  try {
    parsedBody = (await response.json()) as Record<string, unknown>;
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    const serverMessage =
      typeof parsedBody?.message === 'string'
        ? parsedBody.message
        : typeof parsedBody?.error === 'string'
          ? parsedBody.error
          : `Server returned an unexpected error (${response.status}).`;

    throw new RegistrationApiError(serverMessage, 'API_ERROR', response.status);
  }

  if (!parsedBody) {
    throw new RegistrationApiError(
      'Received an empty or invalid JSON response from the backend.',
      'API_ERROR',
      response.status
    );
  }

  return parsedBody as unknown as TResponse;
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  const url = buildUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new RegistrationApiError(
      'Unable to reach the payment verification server. Please check your connection and try again.',
      'NETWORK_ERROR'
    );
  }

  let parsedBody: Record<string, unknown> | null = null;
  try {
    parsedBody = (await response.json()) as Record<string, unknown>;
  } catch {
    parsedBody = null;
  }

  if (!response.ok || !parsedBody) {
    const serverMessage =
      typeof parsedBody?.message === 'string'
        ? parsedBody.message
        : `Unable to verify payment status (${response.status}).`;

    throw new RegistrationApiError(serverMessage, 'API_ERROR', response.status);
  }

  return parsedBody as unknown as TResponse;
}

/**
 * 1. Submit registration data to the backend.
 * Note: The backend must calculate/validate the payable amount from entryType
 * rather than trusting any client-supplied amount.
 */
export async function submitRegistration(
  formData: RegistrationFormData,
  idempotencyKey: string
): Promise<BackendRegistrationResult> {
  const selectedPass = ENTRY_PASS_OPTIONS[formData.entryType];

  const payload = {
    idempotencyKey,
    entryType: formData.entryType,
    expectedFeeInr: selectedPass.price,
    fullName: formData.fullName.trim(),
    email: formData.email.trim(),
    mobileNumber: normalizeIndianMobile(formData.mobileNumber),
    collegeName: formData.collegeName.trim(),
    city: formData.city.trim(),
    categories: formData.categories,
    teamOrIndividualName: formData.teamOrIndividualName.trim(),
    participantCount: Number(formData.participantCount),
    participantNames: formData.participantNames.trim(),
    teamLeaderName: formData.teamLeaderName.trim(),
    emergencyContactNumber: normalizeIndianMobile(formData.emergencyContactNumber),
  };

  return postJson<BackendRegistrationResult>(
    REGISTRATION_API_ENDPOINTS.submitRegistration,
    payload
  );
}

/**
 * 2A. Upload UPI payment proof (screenshot or PDF) & UTR linked to registrationId.
 * Uses XMLHttpRequest so real upload progress (0–100%) is surfaced to the UI.
 * Never resolves on HTTP error, network error, or empty/invalid JSON response.
 */
export function submitPaymentProofWithProgress(params: {
  registrationId: string;
  entryType: RegistrationFormData['entryType'];
  utr: string;
  proofFile: File;
  idempotencyKey: string;
  onProgress?: (percent: number) => void;
}): Promise<BackendPaymentProofSubmissionResult> {
  let url: string;
  try {
    url = buildUrl(REGISTRATION_API_ENDPOINTS.submitPaymentProof);
  } catch (err) {
    return Promise.reject(err);
  }

  const selectedPass = ENTRY_PASS_OPTIONS[params.entryType];
  const body = new FormData();
  body.append('registrationId', params.registrationId);
  body.append('entryType', params.entryType);
  body.append('expectedFeeInr', String(selectedPass.price));
  body.append('utr', params.utr.trim());
  body.append('idempotencyKey', params.idempotencyKey);
  body.append('proof', params.proofFile);

  return new Promise<BackendPaymentProofSubmissionResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
        params.onProgress?.(percent);
      }
    };

    xhr.onerror = () => {
      reject(
        new RegistrationApiError(
          'Unable to upload payment proof to the backend server. Please check your connection and try again.',
          'NETWORK_ERROR'
        )
      );
    };

    xhr.onabort = () => {
      reject(
        new RegistrationApiError(
          'Payment proof upload was aborted before completion.',
          'NETWORK_ERROR'
        )
      );
    };

    xhr.onload = () => {
      let parsedBody: Record<string, unknown> | null = null;
      try {
        parsedBody = xhr.responseText
          ? (JSON.parse(xhr.responseText) as Record<string, unknown>)
          : null;
      } catch {
        parsedBody = null;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const serverMessage =
          typeof parsedBody?.message === 'string'
            ? parsedBody.message
            : typeof parsedBody?.error === 'string'
              ? parsedBody.error
              : `Payment proof upload failed (${xhr.status}).`;

        reject(new RegistrationApiError(serverMessage, 'API_ERROR', xhr.status));
        return;
      }

      if (!parsedBody || typeof parsedBody.registrationId !== 'string') {
        reject(
          new RegistrationApiError(
            'Received an invalid confirmation response while saving payment proof.',
            'API_ERROR',
            xhr.status
          )
        );
        return;
      }

      params.onProgress?.(100);
      resolve(parsedBody as unknown as BackendPaymentProofSubmissionResult);
    };

    xhr.send(body);
  });
}

/**
 * 2B. Create (or retrieve existing unpaid) Razorpay order on the backend.
 * Kept ready for Razorpay payment gateway integration.
 */
export async function createRazorpayOrder(params: {
  registrationId: string;
  entryType: RegistrationFormData['entryType'];
  idempotencyKey: string;
}): Promise<BackendRazorpayOrderResult> {
  return postJson<BackendRazorpayOrderResult>(
    REGISTRATION_API_ENDPOINTS.createRazorpayOrder,
    params
  );
}

/**
 * 3. Verify Razorpay payment signature & status on the backend.
 * Registration confirmation is shown ONLY after the backend validates
 * the HMAC signature and returns status === 'confirmed'.
 */
export async function verifyRazorpayPayment(params: {
  registrationId: string;
  payment: RazorpaySuccessPayload;
}): Promise<BackendPaymentVerificationResult> {
  return postJson<BackendPaymentVerificationResult>(
    REGISTRATION_API_ENDPOINTS.verifyRazorpayPayment,
    {
      registrationId: params.registrationId,
      razorpay_payment_id: params.payment.razorpay_payment_id,
      razorpay_order_id: params.payment.razorpay_order_id,
      razorpay_signature: params.payment.razorpay_signature,
    }
  );
}

/**
 * 4. Check backend-verified / admin-approved / webhook-confirmed payment status.
 */
export async function checkPaymentStatus(params: {
  registrationId: string;
  orderId?: string;
}): Promise<BackendPaymentVerificationResult> {
  const query = new URLSearchParams({
    registrationId: params.registrationId,
    ...(params.orderId ? { orderId: params.orderId } : {}),
  });

  return getJson<BackendPaymentVerificationResult>(
    `${REGISTRATION_API_ENDPOINTS.checkPaymentStatus}?${query.toString()}`
  );
}
