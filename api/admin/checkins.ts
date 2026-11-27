import {
  ApiHttpError,
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  readJsonBody,
  sendErrorResponse,
  sendJson,
} from '../_lib/httpUtils.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimit.js';
import { requireAuthorizedAdmin } from '../_lib/staffAuth.js';
import {
  getAdminCheckinReport,
  reverseTicketCheckin,
} from '../_lib/staffCheckinService.js';

export default async function handler(
  req: NodeHttpRequest,
  res: NodeHttpResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, ['GET', 'POST'])) {
    return;
  }

  try {
    const admin = await requireAuthorizedAdmin(req);
    const clientIp = getClientIp(req);

    enforceRateLimit({
      namespace: 'admin_checkins_manage',
      key: `${admin.userId}:${clientIp}`,
      maxRequests: 120,
      windowMs: 5 * 60 * 1000,
      errorMessage: 'Too many admin check-in requests. Please wait a moment and try again.',
    });

    const method = (req.method || 'GET').toUpperCase();

    if (method === 'GET') {
      const report = await getAdminCheckinReport();
      sendJson(res, 200, report);
      return;
    }

    const body = await readJsonBody(req);
    if (body.action !== 'reverse') {
      throw new ApiHttpError(
        400,
        'Unsupported check-in admin action. Expected action: "reverse".',
        'VALIDATION_ERROR'
      );
    }

    const ticketId = typeof body.ticketId === 'string' ? body.ticketId : '';
    const reason = typeof body.reason === 'string' ? body.reason : '';

    const result = await reverseTicketCheckin({
      ticketId,
      reason,
      admin,
    });

    sendJson(res, 200, result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
