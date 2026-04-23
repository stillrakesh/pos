import fs from 'fs';
import path from 'path';

const nodePath = process.execPath;
const destPath = path.join(process.cwd(), 'bundled-node.exe');

try {
  fs.copyFileSync(nodePath, destPath);
  console.log('✅ Copied node.exe from ' + nodePath + ' to ' + destPath);
} catch (err) {
  console.error('❌ Failed to copy node.exe:', err.message);
  process.exit(1);
}
