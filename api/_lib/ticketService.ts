import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { ApiHttpError } from './httpUtils.js';

export interface VerifiedTicketPayload {
  ticketId: string;
  registrationId: string;
  registrationCode: string;
  participantOrTeamName: string;
  fullName: string;
  entryTypeLabel: string;
  categoriesDisplay: string;
  participantCount: number;
  amountPaidInr: number;
  verifiedAtIso: string;
  qrVerificationUrl: string;
}

function getTicketSigningKey(): string {
  const dedicated = (process.env.TICKET_SIGNING_SECRET ?? '').trim();
  const baseSecret = dedicated || (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!baseSecret) {
    throw new ApiHttpError(
      503,
      'Ticket signing configuration is unavailable on the server.',
      'BACKEND_NOT_CONFIGURED'
    );
  }
  return createHash('sha256')
    .update(`alfaaz-ticket-hmac-v1:${baseSecret}`)
    .digest('hex');
}

export function deriveTicketId(registrationId: string, existingTicketId?: string): string {
  if (existingTicketId && existingTicketId.trim().length >= 6) {
    return existingTicketId.trim().toUpperCase();
  }
  const digest = createHmac('sha256', getTicketSigningKey())
    .update(`ticket-id:${registrationId}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
  return `ALF-TKT-${digest}`;
}

export function signTicketVerificationToken(ticketId: string, registrationId: string): string {
  return createHmac('sha256', getTicketSigningKey())
    .update(`verify:${ticketId}:${registrationId}`)
    .digest('hex')
    .slice(0, 24);
}

export function verifyTicketSignature(params: {
  ticketId: string;
  registrationId: string;
  signature: string;
}): boolean {
  const { ticketId, registrationId, signature } = params;
  if (!ticketId || !registrationId || !signature || !/^[a-f0-9]{16,64}$/i.test(signature)) {
    return false;
  }

  const expected = signTicketVerificationToken(ticketId, registrationId);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signature.toLowerCase(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function buildVerifiedTicketUrls(params: {
  registrationId: string;
  existingTicketId?: string;
  requestOrigin: string;
}): {
  ticketId: string;
  signature: string;
  qrVerificationUrl: string;
} {
  const ticketId = deriveTicketId(params.registrationId, params.existingTicketId);
  const signature = signTicketVerificationToken(ticketId, params.registrationId);

  const cleanOrigin = params.requestOrigin.replace(/\/+$/, '');
  const query = new URLSearchParams({
    ticketId,
    reg: params.registrationId,
    sig: signature,
  });

  return {
    ticketId,
    signature,
    qrVerificationUrl: `${cleanOrigin}/verify-ticket?${query.toString()}`,
  };
}

function sanitizePdfText(raw: string): string {
  // Replace non-WinAnsi glyphs that Helvetica standard font cannot encode
  return raw
    .replace(/₹/g, 'INR ')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/·/g, '|')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateConfirmedTicketPdf(
  ticket: VerifiedTicketPayload
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`ALFAAZ UNFILTERED Pass - ${ticket.ticketId}`);
  pdfDoc.setAuthor('ALFAAZ UNFILTERED · Quad AI Bengaluru');
  pdfDoc.setSubject('Confirmed Event Entry Pass');

  // Crisp landscape pass layout (A5 landscape proportions, high readability & print friendly)
  const pageWidth = 640;
  const pageHeight = 360;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const bgBlack = rgb(0.02, 0.02, 0.024);
  const panelBg = rgb(0.055, 0.055, 0.068);
  const crimson = rgb(1, 0.09, 0.267);
  const lime = rgb(0.784, 0.953, 0.42);
  const offWhite = rgb(0.918, 0.906, 0.878);
  const muted = rgb(0.62, 0.61, 0.59);
  const borderLine = rgb(0.22, 0.21, 0.22);

  // Full dark editorial canvas + outer frame
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: bgBlack,
  });

  page.drawRectangle({
    x: 14,
    y: 14,
    width: pageWidth - 28,
    height: pageHeight - 28,
    color: panelBg,
    borderColor: borderLine,
    borderWidth: 1,
  });

  // Left crimson accent bar
  page.drawRectangle({
    x: 14,
    y: 14,
    width: 7,
    height: pageHeight - 28,
    color: crimson,
  });

  // Top header bar
  page.drawText('QUAD AI SOCIAL & CULTURAL TEAM PRESENTS', {
    x: 34,
    y: pageHeight - 40,
    size: 8,
    font: fontMono,
    color: lime,
  });

  page.drawText('ALFAAZ - UNFILTERED', {
    x: 34,
    y: pageHeight - 66,
    size: 24,
    font: fontBold,
    color: offWhite,
  });

  page.drawText('18 DECEMBER 2026 | QUAD AI, BENGALURU | OFFICIAL ENTRY PASS', {
    x: 34,
    y: pageHeight - 84,
    size: 8.5,
    font: fontMono,
    color: muted,
  });

  // Verified status pill on top right
  page.drawRectangle({
    x: pageWidth - 196,
    y: pageHeight - 62,
    width: 164,
    height: 24,
    color: rgb(0.05, 0.14, 0.07),
    borderColor: lime,
    borderWidth: 1,
  });
  page.drawText('VERIFIED & PAID PASS', {
    x: pageWidth - 181,
    y: pageHeight - 54,
    size: 9,
    font: fontMono,
    color: lime,
  });

  // Horizontal divider
  page.drawLine({
    start: { x: 34, y: pageHeight - 98 },
    end: { x: pageWidth - 32, y: pageHeight - 98 },
    thickness: 0.75,
    color: borderLine,
  });

  // Left details column (rows)
  const drawField = (label: string, value: string, x: number, y: number, highlightLime = false) => {
    page.drawText(label.toUpperCase(), {
      x,
      y,
      size: 7.5,
      font: fontMono,
      color: muted,
    });
    page.drawText(sanitizePdfText(value).slice(0, 42) || '-', {
      x,
      y: y - 14,
      size: 11.5,
      font: fontBold,
      color: highlightLime ? lime : offWhite,
    });
  };

  drawField('Ticket ID', ticket.ticketId, 34, 232, true);
  drawField('Registration Code', ticket.registrationCode, 235, 232, false);

  drawField('Participant / Team Name', ticket.participantOrTeamName, 34, 186, false);
  drawField('Registered Lead', ticket.fullName, 235, 186, false);

  drawField('Pass Tier', ticket.entryTypeLabel, 34, 140, false);
  drawField('Category', ticket.categoriesDisplay, 235, 140, false);

  drawField('Participants', `${ticket.participantCount} Member(s)`, 34, 94, false);
  drawField('Amount Paid', `INR ${ticket.amountPaidInr}`, 235, 94, true);

  // Vertical dashed divider separating QR stub
  const stubX = 434;
  for (let yPos = 28; yPos < pageHeight - 106; yPos += 10) {
    page.drawLine({
      start: { x: stubX, y: yPos },
      end: { x: stubX, y: yPos + 5 },
      thickness: 0.8,
      color: borderLine,
    });
  }

  // Generate QR PNG with white quiet zone for reliable scanning
  const qrPngBuffer = await QRCode.toBuffer(ticket.qrVerificationUrl, {
    type: 'png',
    width: 320,
    margin: 2,
    color: {
      dark: '#050505',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
  const qrImage = await pdfDoc.embedPng(qrPngBuffer);

  const qrSize = 148;
  const qrX = stubX + (pageWidth - 14 - stubX - qrSize) / 2;
  const qrY = 102;

  page.drawRectangle({
    x: qrX - 6,
    y: qrY - 6,
    width: qrSize + 12,
    height: qrSize + 12,
    color: rgb(1, 1, 1),
  });

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  page.drawText('SCAN AT ENTRY GATE', {
    x: qrX + 16,
    y: 80,
    size: 8,
    font: fontMono,
    color: offWhite,
  });

  page.drawText(sanitizePdfText(ticket.ticketId), {
    x: qrX + 14,
    y: 66,
    size: 8.5,
    font: fontMono,
    color: lime,
  });

  // Footer note
  const verifiedFormatted = ticket.verifiedAtIso
    ? new Date(ticket.verifiedAtIso).toISOString().slice(0, 10)
    : 'Verified';
  page.drawText(
    sanitizePdfText(
      `Verified Date: ${verifiedFormatted} | Carry a valid College / Photo ID at check-in.`
    ),
    {
      x: 34,
      y: 34,
      size: 7.5,
      font: fontRegular,
      color: muted,
    }
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
