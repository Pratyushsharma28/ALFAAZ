import {
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  sendErrorResponse,
  sendJson,
} from '../_lib/httpUtils.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimit.js';
import { requireAuthorizedStaff } from '../_lib/staffAuth.js';
import { getStaffGateSummary } from '../_lib/staffCheckinService.js';

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
      namespace: 'staff_session',
      key: clientIp,
      maxRequests: 120,
      windowMs: 5 * 60 * 1000,
      errorMessage: 'Too many staff session requests. Please wait a moment and try again.',
    });

    const staff = await requireAuthorizedStaff(req);
    const summary = await getStaffGateSummary(staff);
    sendJson(res, 200, summary);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
