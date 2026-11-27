import {
  getQueryParam,
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  sendErrorResponse,
  sendJson,
} from '../../_lib/httpUtils.js';
import { getRegistrationPaymentStatus } from '../../_lib/registrationService.js';

export default async function handler(
  req: NodeHttpRequest,
  res: NodeHttpResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, ['GET'])) {
    return;
  }

  try {
    const registrationId = getQueryParam(req, 'registrationId');
    const result = await getRegistrationPaymentStatus(registrationId);
    sendJson(res, 200, result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
