import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Paths to your QZ files
const certPath = path.join(__dirname, '..', 'signing', 'digital-certificate.txt');
const keyPath = path.join(__dirname, '..', 'signing', 'private-key.pem');

// Route to serve the certificate to the frontend
router.get('/certificate', (req, res) => {
  try {
    if (fs.existsSync(certPath)) {
      const cert = fs.readFileSync(certPath, 'utf8');
      res.set('Content-Type', 'text/plain');
      res.send(cert);
    } else {
      console.error('Certificate file not found at:', certPath);
      res.status(404).send('');
    }
  } catch (err) {
    console.error('Error reading certificate:', err);
    res.status(500).send('');
  }
});

// Route to sign the print request using the private key
router.get('/sign', (req, res) => {
  try {
    const toSign = req.query.request;
    if (!toSign) return res.status(400).send('No request to sign');
    
    if (!fs.existsSync(keyPath)) {
      console.error('Private key file not found at:', keyPath);
      return res.status(404).send('');
    }

    const privateKey = fs.readFileSync(keyPath, 'utf8');
    const signer = crypto.createSign('SHA512');
    signer.update(toSign);
    const signature = signer.sign(privateKey, 'base64');
    
    res.set('Content-Type', 'text/plain');
    res.send(signature);
  } catch (err) {
    console.error('Error during signing:', err);
    res.status(500).send('');
  }
});

export default router;
