import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Convert ESM URL to path for __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const originalPackageJson = fs.readFileSync(packageJsonPath, 'utf8');
const packageData = JSON.parse(originalPackageJson);

const WIN7_ELECTRON_VERSION = '22.3.27';
const ORIGINAL_ELECTRON_VERSION = packageData.devDependencies.electron;

console.log(`Starting Windows 7 Build Process...`);
console.log(`Original Electron Version: ${ORIGINAL_ELECTRON_VERSION}`);
console.log(`Target Electron Version for Win7: ${WIN7_ELECTRON_VERSION}`);

try {
    // 1. Modify package.json to use Electron 22 and custom artifact name
    console.log('Configuring package.json for Windows 7...');
    packageData.devDependencies.electron = WIN7_ELECTRON_VERSION;

    // Ensure build.nsis exists
    if (!packageData.build) packageData.build = {};
    if (!packageData.build.nsis) packageData.build.nsis = {};

    // Set custom artifact name for Win 7
    packageData.build.nsis.artifactName = "${productName}-Win7-Setup-${version}.${ext}";

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2));

    // 2. Install dependencies (this fetches the older electron binary)
    console.log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    // 3. Build the application
    console.log('Building for Windows 7...');
    // Run builder without inline config args since we modified package.json
    execSync('npx electron-builder --win --x64', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    console.log('Windows 7 Build Complete!');

} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
} finally {
    // 4. Restore original package.json
    console.log('Restoring original configuration...');
    fs.writeFileSync(packageJsonPath, originalPackageJson);

    // 5. Restore dependencies
    console.log('Restoring original dependencies...');
    execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('Environment restored.');
}
