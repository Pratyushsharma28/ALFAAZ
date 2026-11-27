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
  authorizeStaffUser,
  listStaffUsers,
  updateStaffAccess,
} from '../_lib/staffCheckinService.js';

export default async function handler(
  req: NodeHttpRequest,
  res: NodeHttpResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, ['GET', 'POST', 'PATCH'])) {
    return;
  }

  try {
    const admin = await requireAuthorizedAdmin(req);
    const clientIp = getClientIp(req);

    enforceRateLimit({
      namespace: 'admin_staff_manage',
      key: `${admin.userId}:${clientIp}`,
      maxRequests: 120,
      windowMs: 5 * 60 * 1000,
      errorMessage: 'Too many admin staff requests. Please wait a moment and try again.',
    });

    const method = (req.method || 'GET').toUpperCase();

    if (method === 'GET') {
      const staffUsers = await listStaffUsers();
      sendJson(res, 200, { staffUsers });
      return;
    }

    const body = await readJsonBody(req);

    if (method === 'POST') {
      const email = typeof body.email === 'string' ? body.email : '';
      const fullName = typeof body.fullName === 'string' ? body.fullName : '';
      const initialPassword =
        typeof body.initialPassword === 'string' ? body.initialPassword : undefined;

      const staffUser = await authorizeStaffUser({
        email,
        fullName,
        initialPassword,
        admin,
      });

      sendJson(res, 200, {
        staffUser,
        message: `${staffUser.email} is now authorized for /staff-checkin.`,
      });
      return;
    }

    if (method === 'PATCH') {
      const userId = typeof body.userId === 'string' ? body.userId : '';
      const action = body.action === 'revoke' || body.action === 'reactivate' ? body.action : null;

      if (!action) {
        throw new ApiHttpError(
          400,
          'Action must be either "revoke" or "reactivate".',
          'VALIDATION_ERROR'
        );
      }

      const staffUser = await updateStaffAccess({ userId, action, admin });
      sendJson(res, 200, {
        staffUser,
        message:
          action === 'revoke'
            ? `Check-in access revoked for ${staffUser.email}.`
            : `Check-in access restored for ${staffUser.email}.`,
      });
      return;
    }
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
