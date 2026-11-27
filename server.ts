import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import registrationsHandler from './api/registrations.js';
import paymentProofHandler from './api/registrations/payment-proof.js';
import paymentStatusHandler from './api/payments/razorpay/status.js';
import participantOtpHandler from './api/participant/auth/request-otp.js';
import participantRegistrationsHandler from './api/participant/registrations.js';
import participantResubmitHandler from './api/participant/resubmit-proof.js';
import participantTicketHandler from './api/participant/ticket.js';
import ticketVerifyHandler from './api/tickets/verify.js';
import staffSessionHandler from './api/staff/session.js';
import staffCheckinHandler from './api/staff/checkin.js';
import adminStaffHandler from './api/admin/staff.js';
import adminCheckinsHandler from './api/admin/checkins.js';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  // Mount raw multipart endpoints BEFORE any JSON body parser
  app.all('/api/registrations/payment-proof', (req, res) => {
    void paymentProofHandler(req, res);
  });

  app.all('/api/participant/resubmit-proof', (req, res) => {
    void participantResubmitHandler(req, res);
  });

  app.all('/api/registrations', (req, res) => {
    void registrationsHandler(req, res);
  });

  app.all('/api/payments/razorpay/status', (req, res) => {
    void paymentStatusHandler(req, res);
  });

  app.all('/api/participant/auth/request-otp', (req, res) => {
    void participantOtpHandler(req, res);
  });

  app.all('/api/participant/registrations', (req, res) => {
    void participantRegistrationsHandler(req, res);
  });

  app.all('/api/participant/ticket', (req, res) => {
    void participantTicketHandler(req, res);
  });

  app.all('/api/tickets/verify', (req, res) => {
    void ticketVerifyHandler(req, res);
  });

  app.all('/api/staff/session', (req, res) => {
    void staffSessionHandler(req, res);
  });

  app.all('/api/staff/checkin', (req, res) => {
    void staffCheckinHandler(req, res);
  });

  app.all('/api/admin/staff', (req, res) => {
    void adminStaffHandler(req, res);
  });

  app.all('/api/admin/checkins', (req, res) => {
    void adminCheckinsHandler(req, res);
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ALFAAZ server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
