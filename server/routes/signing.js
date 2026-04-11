import { Router } from 'express';
import { signMessage, getCertificate, isSigningConfigured } from '../qzSigning.js';

const router = Router();

// GET /api/signing/certificate — Return the QZ Tray certificate
router.get('/certificate', (req, res) => {
  const cert = getCertificate();
  if (!cert) {
    return res.status(404).send('Certificate not configured');
  }
  res.type('text/plain').send(cert);
});

// GET /api/signing/sign — Sign a message for QZ Tray
router.get('/sign', (req, res) => {
  const { request } = req.query;
  if (!request) {
    return res.status(400).send('Missing "request" query parameter');
  }

  const signature = signMessage(request);
  if (!signature) {
    return res.status(500).send('Signing failed — private key not configured');
  }

  res.type('text/plain').send(signature);
});

// GET /api/signing/status — Check if signing is ready
router.get('/status', (req, res) => {
  res.json({
    configured: isSigningConfigured(),
    hasCertificate: !!getCertificate(),
    hasPrivateKey: isSigningConfigured()
  });
});

export default router;
