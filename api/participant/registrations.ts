import {
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  sendErrorResponse,
  sendJson,
} from '../_lib/httpUtils.js';
import { requireAuthenticatedParticipant } from '../_lib/participantAuth.js';
import {
  deriveRequestOrigin,
  getParticipantPortalData,
} from '../_lib/participantService.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimit.js';

export default async function handler(
  req: NodeHttpRequest,
  res: NodeHttpResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, ['GET'])) {
    return;
  }

  try {
    const participant = await requireAuthenticatedParticipant(req);
    const clientIp = getClientIp(req);

    enforceRateLimit({
      namespace: 'participant_lookup',
      key: `${participant.userId}:${clientIp}`,
      maxRequests: 60,
      windowMs: 5 * 60 * 1000,
      errorMessage: 'Too many status refresh requests. Please wait a moment and try again.',
    });

    const data = await getParticipantPortalData({
      email: participant.email,
      requestOrigin: deriveRequestOrigin(req),
    });

    sendJson(res, 200, data);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
