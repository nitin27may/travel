import os from 'node:os';
import path from 'node:path';

// One place for the GPU Chromium the specs that need WebGL launch by hand. macOS: the bundled Chromium on Metal; Linux: the Arc GPU through ANGLE's GL backend.
// GPU_CHROME overrides the executable.
const MAC = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const LINUX = path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
export const CHROME = process.env.GPU_CHROME ?? (process.platform === 'darwin' ? MAC : LINUX);
export const GPU_ARGS = ['--use-gl=angle', `--use-angle=${process.platform === 'darwin' ? 'metal' : 'gl'}`, '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
