import {
  getQueryParam,
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  sendErrorResponse,
} from '../_lib/httpUtils.js';
import { requireAuthenticatedParticipant } from '../_lib/participantAuth.js';
import {
  deriveRequestOrigin,
  getVerifiedTicketPdfForParticipant,
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
      namespace: 'participant_ticket_pdf',
      key: `${participant.userId}:${clientIp}`,
      maxRequests: 30,
      windowMs: 5 * 60 * 1000,
      errorMessage: 'Too many ticket download requests. Please try again shortly.',
    });

    const registrationId = getQueryParam(req, 'registrationId');
    const { pdfBuffer, fileName } = await getVerifiedTicketPdfForParticipant({
      registrationId,
      verifiedEmail: participant.email,
      requestOrigin: deriveRequestOrigin(req),
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.end(pdfBuffer);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
