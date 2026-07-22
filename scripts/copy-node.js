import fs from 'fs';
import path from 'path';

const nodePath = process.execPath;
const isMac = process.platform === 'darwin';
const destPath = path.join(process.cwd(), isMac ? 'bundled-node-mac' : 'bundled-node.exe');

try {
  fs.copyFileSync(nodePath, destPath);
  console.log(`✅ Copied node from ${nodePath} to ${destPath}`);
} catch (err) {
  console.error('❌ Failed to copy node:', err.message);
  process.exit(1);
}
