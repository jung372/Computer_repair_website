// Measures where a mobile viewport lands after opening a URL.
// Usage: node build/scroll-check.mjs <url> [url...]
const PORT = process.env.CDP_PORT ?? "9222";

async function targets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return res.json();
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(new Error(`ws error: ${e?.message ?? "unknown"}`));
  });
}

function rpc(ws) {
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result);
    } else if (data.method) {
      events.push(data.method);
    }
  };
  return {
    send(method, params = {}) {
      const msgId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    },
    events,
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await targets();
const page = list.find((t) => t.type === "page");
if (!page) throw new Error("no page target; is chrome running with --remote-debugging-port?");

for (const url of process.argv.slice(2)) {
  const ws = await connect(page.webSocketDebuggerUrl);
  const { send } = rpc(ws);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await send("Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  await send("Page.navigate", { url });
  await wait(4500);
  const { result } = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      hash: location.hash,
      scrollY: Math.round(window.scrollY),
      pageHeight: Math.round(document.documentElement.scrollHeight),
      viewport: window.innerHeight,
      atTop: window.scrollY < 5,
    })`,
    returnByValue: true,
  });
  console.log(url, "\n ", result.value);
  ws.close();
}
