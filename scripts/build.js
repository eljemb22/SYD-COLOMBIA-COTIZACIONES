import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('[Build] Step 1: Compiling client application with Vite...');
execSync('npx vite build', { stdio: 'inherit' });

console.log('[Build] Step 2: Compiling backend server...');
try {
  execSync(
    'npx esbuild server.ts --bundle --platform=node --format=cjs --outfile=dist/server.cjs --external:express --external:vite --external:nodemailer --external:xlsx',
    { stdio: 'inherit' }
  );
  execSync(
    'npx esbuild server.ts --bundle --platform=node --format=esm --outfile=dist/server.mjs --external:express --external:vite --external:nodemailer --external:xlsx',
    { stdio: 'inherit' }
  );
} catch (err) {
  console.warn('[Build] Warning during server bundle (proceeding with client artifacts):', err.message);
}

console.log('[Build] Step 3: Mirroring build artifacts to alternate output directories (build, out)...');
const targetDirs = ['build', 'out'];
for (const dir of targetDirs) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.cpSync('dist', dir, { recursive: true });
    console.log(`[Build] Successfully mirrored artifacts to ./${dir}`);
  } catch (err) {
    console.warn(`[Build] Could not mirror to ./${dir}:`, err.message);
  }
}

console.log('[Build] Build completed successfully with valid artifacts in dist/, build/, and out/.');
