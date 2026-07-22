import crypto from 'crypto';

// Certificate and Key stored as strings for Vercel reliability
const QZ_CERT = `-----BEGIN CERTIFICATE-----
MIIECzCCAvOgAwIBAgIGAZ1+3Ey1MA0GCSqGSIb3DQEBCwUAMIGiMQswCQYDVQQG
EwJVUzELMAkGA1UECAwCTlkxEjAQBgNVBAcMCUNhbmFzdG90YTEbMBkGA1UECgwS
UVogSW5kdXN0cmllcywgTExDMRswGQYDVQQLDBJRWiBJbmR1c3RyaWVzLCBMTEMx
HDAaBgkqhkiG9w0BCQEWDXN1cHBvcnRAcXouaW8xGjAYBgNVBAMMEVFaIFRyYXkg
RGVtbyBDZXJ0MB4XDTI2MDQxMDIzMjQyMFoXDTQ2MDQxMDIzMjQyMFowgaIxCzAJ
BgNVBAYTAlVTMQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0b3RhMRswGQYD
VQQKDBJRWiBJbmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMs
IExMQzEcMBoGCSqGSIb3DQEJARYNc3VwcG9ydEBxei5pbzEaMBgGA1UEAwwRUVog
VHJheSBEZW1vIENlcnQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC0
1Y9NS1+vKC5RX69yLtbLX6wWw4V8xXCDpBZfHZyvvR1tbHPf+UblxTTCXHzr0h9i
es/bhY+nhL1r0cZ81hW5BeADvo9IJO9Ic4FBo9Ksx9BiH/r9vToHkTZBdCJ1d4yV
51Kg62EEDE7m83TLPdChy1hmwSZgULOVlu8lJ8M8VoR/eGf/cbwyty+/d/3xpWSO
Tq0ljp/nQb0qQGTVx8rHILtWHKig2X42oNfsCp/2ce1JE1nDTVrZVlXQIe5bozO4
3E/utXwSPZkrYABaQn+ko/pAdLwi/yDnk0qUndyFLLOytmnkjHTtMjTgxeOLYuqV
Vaz5yWZtdqcJNuW1rbchAgMBAAGjRTBDMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYD
VR0PAQH/BAQDAgEGMB0GA1UdDgQWBBSqPWQt6aFT3p3UeMa5grxplLF+eDANBgkq
hkiG9w0BAQsFAAOCAQEAMDDCvir85Kx41rVvbI7UKffcSde3Qn69pBhfaEOh+soj
xjUvb6Xf6O+Ppst3oZsWVCCZ6dFmnTLcb2OzbTujDBJWGuW1pO88Mg63jxHIJJ8x
zID4B6O4M3BBXSM9CThKCPUinjMPAynokmlHWPZeGSL0jb4BNlMV5h44PdTVJC6v
8RijSMDRIbrUfFW5VPC85O4jtYi0dg4aIU9bOLuf52+wj99LtbFGB3lUQvynMP+k
d6dkqhBTSjpGNiAeeH5y3sk+fqMFxcGfBeA8aeodlHZTXsgJ3KOfwZz8EDamOJ/u
8QlDRqOyBOPK9xWs6gQboVwGUjjnpUC6gFvNschsCg==
-----END CERTIFICATE-----`;

const QZ_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC01Y9NS1+vKC5R
X69yLtbLX6wWw4V8xXCDpBZfHZyvvR1tbHPf+UblxTTCXHzr0h9ies/bhY+nhL1r
0cZ81hW5BeADvo9IJO9Ic4FBo9Ksx9BiH/r9vToHkTZBdCJ1d4yV51Kg62EEDE7m
83TLPdChy1hmwSZgULOVlu8lJ8M8VoR/eGf/cbwyty+/d/3xpWSOTq0ljp/nQb0q
QGTVx8rHILtWHKig2X42oNfsCp/2ce1JE1nDTVrZVlXQIe5bozO43E/utXwSPZkr
YABaQn+ko/pAdLwi/yDnk0qUndyFLLOytmnkjHTtMjTgxeOLYuqVVaz5yWZtdqcJ
NuW1rbchAgMBAAECggEAHdVNuvbAZmk+mvYqP7Ayh4LVJTxEfX0lPtKHTlHYU7Xj
cPX/d+fsJmQOfDI9+bnEq76PJCw4su5XQb5t/JJlKw0pE/UQNlrBjzZfELEyRIcC
fe3AvrPFKxJt3QaH2NFMRD7RhvLOIpjVO4zWq+Ea1lZx0yHybtlhh0BLW9nff8iO
zGnORD/I0g58rwRsESQNIoayz5gSSFcCPG+bC9nAbW+vnGYcRTJfo1BgJcARkUqF
bpS9w+TPcHDAghy0B4TSZHnTQ3ZXaAOeDAEyERGMVUBwN63UD2ypSACpTeYp9kEU
tMiPW0aMo1I6L/tY+LJVPeVfjLP1eH9TgdB3AOzf8QKBgQDwf4WWry1g/8KsUfpE
uEEVpux8VQiv68sZYLL6B8ZXX/U/j/Gk2Vm3tnjkaGqpPFl7majsI02PMHFl6/3Q
orofchxk7GO3mYk3Q45ZVaf3u7rbRs6X2tMfYiRYmskUP4NvRhE8vN8BhrgeX0Pf
vmHp8GLKDsAn+nOM1qj9hCgxHwKBgQDAfYTkHLJJ6xZChBm7XZFuSVE0vPHcpttx
yzas7MRzhFZ08/d6FoTetNBzy5lZqo+edO2wAFpCTR29iFa8Koq0BUzaHsn7ECsZ
di9156GyFYAl4t7Iw0b7QTJM1iNlAa6wul8uxNmupOrZ7yUtSFUPCOZx+aINwfsl
iR6al+fPvwKBgQCnW7Z047aqd5DbJbkJNUdlb+HFq879zRJquJYT1HE7wHUEJIE9
/Fqos3xxRhBjcLG8h3O7z91bNZTUHmNkWrk2xMvpl27VBy0rngFjPW5DwQoJKb7+
gbLFdiBg4GXph0FJn/LC15RAlaVuzVCIVQ4CI9w7TASATZM3gPHcaakmdQKBgCye
7CdU359y934D0VM1pXjDVie7hPV5WHVQfiQn3oJIsyH5S+zpO3PExm2RTMMUXqaE
xHSAIGwuJC7DZBfKZMzGTcJiUL/6R4NneikCwODfSw19QdeYLOQhgN9+5EWN1kjx
aw8UYsGxSR+r6BpPIiiSD5lsHLzDssxItOdxPzNRAoGAVK6LB/tOlUClq/jFiM2b
gDSf4s8PryHu2RBzewdRg0pZctx4NaI5817Yn3j4O4f/51PVHH9TqHFePoFDaa1h
DCcbY+O4ZukSaI0Qjtr70mz7lao1Ljw/50uxSHj+ImhiKf2KbQ1dL4fdMOgJJlKw
5K4h6TDrs33JipuRqJID+JQ=
-----END PRIVATE KEY-----`;

export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Purely check the URL path without extra modules
  const url = req.url || '';
  
  if (url.includes('/certificate')) {
    return res.status(200).send(QZ_CERT);
  }

  if (url.includes('/sign')) {
    // Vercel pre-parses query params into req.query
    const toSign = req.query.request;
    if (!toSign) return res.status(400).send('No request to sign');

    try {
      const signer = crypto.createSign('SHA512');
      signer.update(toSign);
      const signature = signer.sign(QZ_KEY, 'base64');
      return res.status(200).send(signature);
    } catch (err) {
      console.error('Signing error:', err);
      return res.status(500).send('Error during signing');
    }
  }

  return res.status(404).send('Not Found');
}
