/* global self, importScripts */
let pyodide, riverReady = false;

// Simple JS fallback: rolling mean/std (window W)
const W = 60;
const buf = [];
let sum = 0, sum2 = 0;
function jsPush(x) {
  buf.push(x);
  sum += x;
  sum2 += x * x;
  if (buf.length > W) {
    const y = buf.shift();
    sum -= y;
    sum2 -= y * y;
  }
  const n = buf.length;
  if (n < 10) return { anomaly: false, score: 0 };
  const mean = sum / n;
  const variance = Math.max(1e-9, sum2 / n - mean * mean);
  const std = Math.sqrt(variance);
  const z = std ? Math.abs((x - mean) / std) : 0;
  return { anomaly: z > 3, score: z };
}

async function initPy() {
  try {
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");
    pyodide = await loadPyodide();
    // Try to install river
    await pyodide.runPythonAsync(`
import micropip
try:
  await micropip.install('river')
  ok = True
except Exception as e:
  ok = False
ok
    `);
    const ok = pyodide.globals.get("ok");
    riverReady = !!ok;
    if (riverReady) {
      await pyodide.runPythonAsync(`
from river import anomaly
from river import preprocessing

# Example: Half-Space Trees with scaling
model = preprocessing.MinMaxScaler() | anomaly.HalfSpaceTrees(seed=42)

def push_val(x):
    # returns (is_anom, score)
    # model.score_one returns anomaly score; threshold heuristic
    s = model.score_one({'x': x})
    model.learn_one({'x': x})
    # Dynamic threshold heuristic; tune as needed
    return (s > 0.8, float(s))
      `);
    }
    self.postMessage({ type: "ready", river: riverReady });
  } catch (e) {
    riverReady = false;
    self.postMessage({ type: "ready", river: false, error: String(e) });
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg?.type === "init") {
    if (!pyodide) await initPy();
    return;
  }
  if (msg?.type === "tick") {
    const { value, ts, sensorId } = msg;
    if (riverReady) {
      try {
        const res = await pyodide.runPythonAsync(`push_val(${value})`);
        const [anom, score] = res.toJs ? res.toJs() : res;
        self.postMessage({ type: "result", ts, sensorId, value, anomaly: !!anom, score: Number(score) });
        return;
      } catch (e) {
        // fall through to JS
      }
    }
    const r = jsPush(value);
    self.postMessage({ type: "result", ts, sensorId, value, anomaly: r.anomaly, score: r.score });
  }
};
