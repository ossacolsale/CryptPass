const { CommonSymEnc } = require('../dist/Common');

self.onmessage = function (event) {
  const { n, samples } = event.data || {};
  if (![16384, 32768, 65536].includes(n) || !Number.isInteger(samples) || samples < 1 || samples > 5) {
    self.postMessage({ error: { message: 'Parametri del benchmark non validi.', phase: 'validate-input' } });
    return;
  }
  const params = { N: n, r: 8, p: 1 };
  // These fixed values are synthetic and are never supplied by the page user.
  const password = 'browser benchmark only';
  const salt = '42'.repeat(16);
  try {
    self.postMessage({ status: `Warm-up scrypt N=${n}…`, phase: 'warmup', n });
    CommonSymEnc.DeriveKey(password, salt, params);
    const times = [];
    for (let i = 0; i < samples; i++) {
      self.postMessage({ status: `Misura ${i + 1}/${samples}, scrypt N=${n}…`, phase: 'sample', sample: i + 1, n });
      const start = performance.now();
      CommonSymEnc.DeriveKey(password, salt, params);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    self.postMessage({ done: true, n, r: 8, p: 1, times,
      medianMs: times[Math.floor(times.length / 2)], minMs: times[0], maxMs: times[times.length - 1] });
  } catch (error) {
    self.postMessage({ error: {
      name: String(error && error.name || 'Error').slice(0, 120),
      message: String(error && error.message || error || 'Unknown worker error').slice(0, 1000),
      stack: String(error && error.stack || '').slice(0, 2500),
      phase: 'scrypt', n
    } });
  }
};
