import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import registrationsHandler from './api/registrations.js';
import paymentProofHandler from './api/registrations/payment-proof.js';
import paymentStatusHandler from './api/payments/razorpay/status.js';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  // Mount raw multipart endpoint BEFORE any JSON body parser
  app.all('/api/registrations/payment-proof', (req, res) => {
    void paymentProofHandler(req, res);
  });

  app.all('/api/registrations', (req, res) => {
    void registrationsHandler(req, res);
  });

  app.all('/api/payments/razorpay/status', (req, res) => {
    void paymentStatusHandler(req, res);
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
    app.get('/{*splat}', (_req, res) => {
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
