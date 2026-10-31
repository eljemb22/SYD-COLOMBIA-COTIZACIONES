import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('[Build] Building frontend with Vite...');
try {
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('[Build] Build completed successfully.');
} catch (err) {
  console.error('[Build] Build failed:', err);
  process.exit(1);
}
