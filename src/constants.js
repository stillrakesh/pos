// ❗ IMPORTANT: Live HTTPS websites (like Vercel) cannot talk to local HTTP Backend IPs (Mixed Content Error).
// To fix this, you must either:
// 1. Deploy your backend to a cloud service (Render/Railway) and set VITE_API_URL.
// 2. Use a tunnel like 'ngrok http 3000' and paste the HTTPS link here.

export const BASE_URL = import.meta.env.VITE_API_URL || "http://192.168.1.40:3000";
