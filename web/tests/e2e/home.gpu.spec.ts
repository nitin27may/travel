import { expect, test } from './fixtures';

// The chromium project launches with the Arc flags (playwright.config.ts GPU_ARGS). If the flags are lost, WebGL falls back to
// SwiftShader and every motion and map spec silently measures software rendering.
test('chromium renders WebGL on the GPU, not SwiftShader', async ({ page, site }) => {
  await page.goto(`${site.url}/`);
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  });
  expect(renderer).not.toBe('no-webgl');
  expect(renderer.toLowerCase()).not.toContain('swiftshader');
});
