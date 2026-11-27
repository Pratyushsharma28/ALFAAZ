import {
  getQueryParam,
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  sendErrorResponse,
  sendJson,
} from '../_lib/httpUtils.js';
import { verifyPublicTicketQr } from '../_lib/participantService.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimit.js';

export default async function handler(
  req: NodeHttpRequest,
  res: NodeHttpResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, ['GET'])) {
    return;
  }

  try {
    const clientIp = getClientIp(req);
    enforceRateLimit({
      namespace: 'ticket_qr_verify',
      key: clientIp,
      maxRequests: 60,
      windowMs: 5 * 60 * 1000,
      errorMessage: 'Too many ticket verification requests. Please wait a moment and try again.',
    });

    const ticketId = getQueryParam(req, 'ticketId') || getQueryParam(req, 'verify');
    const registrationId = getQueryParam(req, 'reg');
    const signature = getQueryParam(req, 'sig');

    const result = await verifyPublicTicketQr({
      ticketId,
      registrationId,
      signature,
    });

    sendJson(res, 200, result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
