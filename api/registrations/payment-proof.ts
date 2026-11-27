import {
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  parseMultipartForm,
  sendErrorResponse,
  sendJson,
} from '../_lib/httpUtils.js';
import {
  MAX_PROOF_FILE_SIZE_BYTES,
  submitManualUpiPaymentProof,
} from '../_lib/registrationService.js';

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
    const { fields, file } = await parseMultipartForm(req, MAX_PROOF_FILE_SIZE_BYTES);
    const result = await submitManualUpiPaymentProof({ fields, file });
    sendJson(res, 201, result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
