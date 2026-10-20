// Page side of the benchmark. The driver (measure.mjs) calls window.bench(cfg) and reads the JSON it returns.
import { env, pipeline } from '/lib/transformers.web.js';

const params = new URLSearchParams(location.search);
const ISO = params.get('iso') === '1';

window.bench = async ({ device, queries, texts, rounds, threads }) => {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = '/models/';
  env.useBrowserCache = true; // the Cache API, as the product would use for the model
  env.useWasmCache = false;
  const asyncify = device === 'webgpu';
  const suffix = asyncify ? '.asyncify' : '';
  env.backends.onnx.wasm.wasmPaths = { mjs: `/ort/ort-wasm-simd-threaded${suffix}.mjs`, wasm: `/ort/ort-wasm-simd-threaded${suffix}.wasm` };
  env.backends.onnx.wasm.numThreads = ISO ? threads : 1;
  const out = { device, iso: ISO, threads: ISO ? threads : 1, crossOriginIsolated, hardwareConcurrency: navigator.hardwareConcurrency, webgpu: Boolean(navigator.gpu) };
  if (device === 'webgpu') {
    const a = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
    out.adapter = a ? (a.info ? `${a.info.vendor} ${a.info.architecture} ${a.info.description}`.trim() : 'adapter') : null;
    if (!a) return { ...out, error: 'no WebGPU adapter' };
  }
  const heap = () => (performance.memory ? performance.memory.usedJSHeapSize : null);
  out.heapBefore = heap();
  const t0 = performance.now();
  let extractor;
  try {
    extractor = await pipeline('feature-extraction', 'pinned', { dtype: 'q8', device });
  } catch (e) {
    return { ...out, error: String(e && e.message ? e.message : e) };
  }
  out.loadMs = performance.now() - t0;
  const embed = async (t) => {
    const r = await extractor(t, { pooling: 'mean', normalize: true });
    return r;
  };
  const s1 = performance.now();
  await embed(queries[0]);
  out.firstQueryMs = performance.now() - s1;
  const warm = [];
  for (let r = 0; r < rounds; r++) {
    for (const q of queries) {
      const s = performance.now();
      await embed(q);
      warm.push(performance.now() - s);
    }
  }
  warm.sort((a, b) => a - b);
  const pct = (p) => warm[Math.min(warm.length - 1, Math.floor(p * warm.length))];
  out.warm = { n: warm.length, p50: pct(0.5), p95: pct(0.95), max: warm[warm.length - 1], min: warm[0] };
  const vecs = [];
  const s2 = performance.now();
  for (const t of texts) {
    const r = await embed(t);
    vecs.push(Array.from(r.data));
  }
  out.cardEmbedMsEach = (performance.now() - s2) / texts.length;
  out.vecs = vecs;
  out.heapAfter = heap();
  return out;
};
window.benchReady = true;
