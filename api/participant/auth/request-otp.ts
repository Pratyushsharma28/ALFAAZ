import {
  ApiHttpError,
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  readJsonBody,
  sendErrorResponse,
  sendJson,
} from '../../_lib/httpUtils.js';
import { enforceRateLimit, getClientIp } from '../../_lib/rateLimit.js';

export default async function handler(
  req: NodeHttpRequest,
  res: NodeHttpResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, ['POST'])) {
    return;
  }

  try {
    const clientIp = getClientIp(req);
    enforceRateLimit({
      namespace: 'otp_ip',
      key: clientIp,
      maxRequests: 12,
      windowMs: 15 * 60 * 1000,
      errorMessage: 'Too many OTP verification requests from this network. Please wait a few minutes and try again.',
    });

    const body = await readJsonBody(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
      throw new ApiHttpError(400, 'Please enter a valid email address.', 'VALIDATION_ERROR');
    }

    enforceRateLimit({
      namespace: 'otp_email',
      key: email,
      maxRequests: 4,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Multiple verification emails were requested recently. Please check your inbox or wait a few minutes before resending.',
    });

    sendJson(res, 200, {
      allowed: true,
      cooldownSeconds: 60,
    });
  } catch (err) {
    if (err instanceof ApiHttpError && err.statusCode === 429) {
      res.setHeader('Retry-After', '60');
    }
    sendErrorResponse(res, err);
  }
}
