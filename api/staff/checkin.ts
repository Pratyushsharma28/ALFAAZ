import {
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  readJsonBody,
  sendErrorResponse,
  sendJson,
} from '../_lib/httpUtils.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimit.js';
import { requireAuthorizedStaff } from '../_lib/staffAuth.js';
import { performAtomicStaffCheckIn } from '../_lib/staffCheckinService.js';

export default async function handler(
  req: NodeHttpRequest,
  res: NodeHttpResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, ['POST'])) {
    return;
  }

  try {
    const staff = await requireAuthorizedStaff(req);
    const clientIp = getClientIp(req);

    enforceRateLimit({
      namespace: 'staff_checkin_scan',
      key: `${staff.userId}:${clientIp}`,
      maxRequests: 240,
      windowMs: 5 * 60 * 1000,
      errorMessage: 'Scan rate limit reached temporarily. Please wait a moment and try again.',
    });

    const body = await readJsonBody(req);
    const qrPayload = typeof body.qrPayload === 'string' ? body.qrPayload : undefined;
    const ticketId = typeof body.ticketId === 'string' ? body.ticketId : undefined;
    const registrationId = typeof body.registrationId === 'string' ? body.registrationId : undefined;
    const signature = typeof body.signature === 'string' ? body.signature : undefined;
    const manualCode = typeof body.manualCode === 'string' ? body.manualCode : undefined;
    const scanMethod = body.scanMethod === 'manual' ? 'manual' : 'qr';

    const result = await performAtomicStaffCheckIn({
      staff,
      qrPayload,
      ticketId,
      registrationId,
      signature,
      manualCode,
      scanMethod,
    });

    sendJson(res, 200, result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
