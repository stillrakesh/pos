/**
 * TYDE POS — Data Backup Utility
 * ────────────────────────────────
 * Copies the /data folder to /backup/<timestamp>/
 */

import { existsSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

function backup() {
  const dataDir = join(ROOT, 'data');
  const backupRoot = join(ROOT, 'backup');
  
  if (!existsSync(dataDir)) {
    console.error('❌ Data directory not found at', dataDir);
    process.exit(1);
  }

  // Ensure backup root exists
  if (!existsSync(backupRoot)) {
    mkdirSync(backupRoot);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = join(backupRoot, timestamp);

  console.log(`🚀 Starting backup to ${targetDir}...`);

  try {
    mkdirSync(targetDir, { recursive: true });
    cpSync(dataDir, targetDir, { recursive: true });
    console.log('✅ Backup completed successfully!');
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  }
}

backup();
