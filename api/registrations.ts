import {
  handleCorsAndMethod,
  type NodeHttpRequest,
  type NodeHttpResponse,
  readJsonBody,
  sendErrorResponse,
  sendJson,
} from './_lib/httpUtils';
import {
  createOrReuseRegistration,
  validateRegistrationInput,
} from './_lib/registrationService';

export default async function handler(
  req: NodeHttpRequest,
  res: NodeHttpResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const validatedInput = validateRegistrationInput(body);
    const result = await createOrReuseRegistration(validatedInput);
    sendJson(res, 201, result);
  } catch (err) {
    sendErrorResponse(res, err);
  }
}
