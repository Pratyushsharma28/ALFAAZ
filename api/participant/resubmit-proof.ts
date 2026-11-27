import {
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  parseMultipartForm,
  sendErrorResponse,
  sendJson,
} from '../_lib/httpUtils.js';
import { requireAuthenticatedParticipant } from '../_lib/participantAuth.js';
import { resubmitParticipantPaymentProof } from '../_lib/participantService.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimit.js';
import { MAX_PROOF_FILE_SIZE_BYTES } from '../_lib/registrationService.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NodeHttpRequest,
  res: NodeHttpResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, ['POST'])) {
    return;
  }

  try {
    const participant = await requireAuthenticatedParticipant(req);
    const clientIp = getClientIp(req);

    enforceRateLimit({
      namespace: 'participant_resubmit',
      key: `${participant.userId}:${clientIp}`,
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
      errorMessage: 'Too many proof upload attempts. Please wait a few minutes before trying again.',
    });

    const { fields, file } = await parseMultipartForm(req, MAX_PROOF_FILE_SIZE_BYTES);
    const result = await resubmitParticipantPaymentProof({
      verifiedEmail: participant.email,
      fields,
      file,
    });

    sendJson(res, 201, result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
