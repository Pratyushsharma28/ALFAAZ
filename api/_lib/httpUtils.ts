import type { IncomingMessage, ServerResponse } from 'node:http';
import Busboy from 'busboy';

export type NodeHttpRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, unknown>;
};

export type NodeHttpResponse = ServerResponse;

export class ApiHttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, message: string, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiHttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface ParsedUploadedFile {
  fieldName: string;
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ParsedMultipartPayload {
  fields: Record<string, string>;
  file: ParsedUploadedFile | null;
}

function getRequestHost(req: NodeHttpRequest): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host || '';
  return hostHeader.split(',')[0].trim().toLowerCase();
}

function getAllowedOrigins(req: NodeHttpRequest): Set<string> {
  const allowed = new Set<string>();
  const host = getRequestHost(req);
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  for (const origin of configured) {
    allowed.add(origin);
  }

  return allowed;
}

export function handleCorsAndMethod(
  req: NodeHttpRequest,
  res: NodeHttpResponse,
  allowedMethods: readonly string[]
): boolean {
  const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  const allowedOrigins = getAllowedOrigins(req);

  if (originHeader && allowedOrigins.has(originHeader)) {
    res.setHeader('Access-Control-Allow-Origin', originHeader);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', [...allowedMethods, 'OPTIONS'].join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    if (originHeader && !allowedOrigins.has(originHeader)) {
      sendJson(res, 403, {
        error: 'FORBIDDEN_ORIGIN',
        message: 'Cross-origin request is not allowed.',
      });
      return false;
    }
    res.statusCode = 204;
    res.end();
    return false;
  }

  if (originHeader && !allowedOrigins.has(originHeader)) {
    sendJson(res, 403, {
      error: 'FORBIDDEN_ORIGIN',
      message: 'Cross-origin request is not allowed.',
    });
    return false;
  }

  const method = (req.method || 'GET').toUpperCase();
  if (!allowedMethods.includes(method)) {
    res.setHeader('Allow', allowedMethods.join(', '));
    sendJson(res, 405, {
      error: 'METHOD_NOT_ALLOWED',
      message: `Method ${method} is not allowed on this endpoint.`,
    });
    return false;
  }

  return true;
}

export function sendJson(res: NodeHttpResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function sendErrorResponse(res: NodeHttpResponse, err: unknown): void {
  if (err instanceof ApiHttpError) {
    sendJson(res, err.statusCode, {
      error: err.code,
      message: err.message,
    });
    return;
  }

  const statusCode =
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    typeof (err as { statusCode?: unknown }).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 500;

  const message =
    err instanceof Error && err.message
      ? err.message
      : 'An unexpected server error occurred.';

  sendJson(res, statusCode, {
    error: statusCode === 503 ? 'BACKEND_NOT_CONFIGURED' : 'INTERNAL_ERROR',
    message,
  });
}

export async function readJsonBody(
  req: NodeHttpRequest,
  maxBytes = 64 * 1024
): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }

  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      throw new ApiHttpError(400, 'Invalid JSON request body.', 'INVALID_JSON');
    }
    throw new ApiHttpError(400, 'Request body must be a JSON object.', 'INVALID_JSON');
  }

  const rawBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        reject(new ApiHttpError(413, 'Request payload is too large.', 'PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () =>
      reject(new ApiHttpError(400, 'Unable to read request body.', 'INVALID_BODY'))
    );
  });

  if (rawBuffer.length === 0) {
    throw new ApiHttpError(400, 'Request body cannot be empty.', 'EMPTY_BODY');
  }

  try {
    const parsed = JSON.parse(rawBuffer.toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ApiHttpError(400, 'Request body must be a JSON object.', 'INVALID_JSON');
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ApiHttpError) throw err;
    throw new ApiHttpError(400, 'Invalid JSON request body.', 'INVALID_JSON');
  }
}

export function getQueryParam(req: NodeHttpRequest, key: string): string {
  if (req.query && key in req.query) {
    const raw = req.query[key];
    if (Array.isArray(raw)) return (raw[0] ?? '').trim();
    if (typeof raw === 'string') return raw.trim();
  }

  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    return (parsed.searchParams.get(key) ?? '').trim();
  } catch {
    return '';
  }
}

export function parseMultipartForm(
  req: NodeHttpRequest,
  maxFileSizeBytes: number
): Promise<ParsedMultipartPayload> {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return Promise.reject(
      new ApiHttpError(
        400,
        'Content-Type must be multipart/form-data to upload payment proof.',
        'INVALID_CONTENT_TYPE'
      )
    );
  }

  return new Promise<ParsedMultipartPayload>((resolve, reject) => {
    let settled = false;
    const fail = (err: ApiHttpError) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    let busboy: Busboy.Busboy;
    try {
      busboy = Busboy({
        headers: req.headers,
        limits: {
          fields: 25,
          fieldSize: 16 * 1024,
          files: 1,
          fileSize: maxFileSizeBytes,
        },
      });
    } catch {
      fail(new ApiHttpError(400, 'Malformed multipart upload headers.', 'INVALID_MULTIPART'));
      return;
    }

    const fields: Record<string, string> = {};
    let uploadedFile: ParsedUploadedFile | null = null;
    let fileLimitExceeded = false;

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (fieldName, stream, info) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('limit', () => {
        fileLimitExceeded = true;
        stream.resume();
      });

      stream.on('end', () => {
        if (fileLimitExceeded) {
          return;
        }
        uploadedFile = {
          fieldName,
          originalFilename: info.filename || 'payment-proof',
          mimeType: (info.mimeType || '').toLowerCase(),
          buffer: Buffer.concat(chunks),
        };
      });
    });

    busboy.on('filesLimit', () => {
      fail(
        new ApiHttpError(
          400,
          'Only one payment proof file can be uploaded per submission.',
          'TOO_MANY_FILES'
        )
      );
    });

    busboy.on('error', () => {
      fail(
        new ApiHttpError(
          400,
          'Unable to parse uploaded payment proof form data.',
          'INVALID_MULTIPART'
        )
      );
    });

    busboy.on('finish', () => {
      if (settled) return;
      if (fileLimitExceeded) {
        fail(
          new ApiHttpError(
            413,
            'Uploaded file exceeds the maximum allowed size of 10 MB.',
            'FILE_TOO_LARGE'
          )
        );
        return;
      }
      settled = true;
      resolve({ fields, file: uploadedFile });
    });

    req.pipe(busboy);
  });
}

export function detectProofFileType(
  buffer: Buffer,
  originalFilename: string,
  claimedMime: string
): { ext: 'jpg' | 'png' | 'pdf'; mimeType: 'image/jpeg' | 'image/png' | 'application/pdf' } {
  if (buffer.length === 0) {
    throw new ApiHttpError(400, 'Uploaded payment proof file is empty.', 'EMPTY_FILE');
  }

  const lowerName = originalFilename.toLowerCase();
  const hasJpgExt = lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');
  const hasPngExt = lowerName.endsWith('.png');
  const hasPdfExt = lowerName.endsWith('.pdf');

  if (!hasJpgExt && !hasPngExt && !hasPdfExt) {
    throw new ApiHttpError(
      400,
      'Only JPG, JPEG, PNG, or PDF payment proof files are allowed.',
      'INVALID_FILE_TYPE'
    );
  }

  const isJpegMagic =
    buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPngMagic =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isPdfMagic =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d;

  if (isJpegMagic && hasJpgExt && (!claimedMime || claimedMime === 'image/jpeg' || claimedMime === 'image/jpg')) {
    return { ext: 'jpg', mimeType: 'image/jpeg' };
  }
  if (isPngMagic && hasPngExt && (!claimedMime || claimedMime === 'image/png')) {
    return { ext: 'png', mimeType: 'image/png' };
  }
  if (isPdfMagic && hasPdfExt && (!claimedMime || claimedMime === 'application/pdf')) {
    return { ext: 'pdf', mimeType: 'application/pdf' };
  }

  // Fallback check if browser sent generic application/octet-stream or slightly mismatched image extension vs magic bytes
  if (isJpegMagic && (hasJpgExt || hasPngExt)) {
    return { ext: 'jpg', mimeType: 'image/jpeg' };
  }
  if (isPngMagic && (hasPngExt || hasJpgExt)) {
    return { ext: 'png', mimeType: 'image/png' };
  }
  if (isPdfMagic && hasPdfExt) {
    return { ext: 'pdf', mimeType: 'application/pdf' };
  }

  throw new ApiHttpError(
    400,
    'The uploaded file content does not match a valid JPG, PNG, or PDF file.',
    'INVALID_FILE_CONTENT'
  );
}
