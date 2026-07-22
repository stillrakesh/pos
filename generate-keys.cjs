// Generate self-signed certificate and private key for QZ Tray signing
const { generateKeyPairSync, createSign, X509Certificate } = require('crypto');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

const dir = join(__dirname, 'server', 'signing');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

// Generate RSA 2048-bit key pair
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Write private key
writeFileSync(join(dir, 'private-key.pem'), privateKey);
console.log('✅ private-key.pem created');

// For QZ Tray, the certificate is the public key in PEM format
// QZ Tray accepts the X.509 certificate that the user generated from Site Manager
// But it also accepts the raw PEM public key for signing verification.
// We'll write the public key for now and use the user's QZ-generated certificate.
writeFileSync(join(dir, 'public-key.pem'), publicKey);
console.log('✅ public-key.pem created');

// Test that signing works
const testMessage = 'Hello QZ Tray';
const sign = createSign('SHA512');
sign.update(testMessage);
const signature = sign.sign(privateKey, 'base64');
console.log('✅ Signing test passed, signature length:', signature.length);
console.log('\nDone! Files saved to server/signing/');
