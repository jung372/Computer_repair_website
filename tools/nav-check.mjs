// Confirms the in-page 고객센터 link still scrolls to the footer after the
// landing-anchor guard. Usage: node build/nav-check.mjs <origin>
const PORT = process.env.CDP_PORT ?? "9222";
const origin = process.argv[2];

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const target = list.find((t) => t.type === "page");

const ws = await new Promise((resolve, reject) => {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.onopen = () => resolve(socket);
  socket.onerror = () => reject(new Error("ws error"));
});

let id = 0;
const pending = new Map();
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
// The query string forces a cross-document load, the way a messenger link opens.
await send("Page.navigate", { url: `${origin}/?cold=${process.argv[3] ?? "nav"}#contact` });
await wait(4500);
console.log("cold landing:", await evaluate(`JSON.stringify({hash:location.hash,search:location.search,scrollY:Math.round(scrollY)})`));

console.log("link found:", await evaluate(`!!document.querySelector('a[href="/#contact"]')`));
await evaluate(`document.querySelector('a[href="/#contact"]').click()`);
await wait(2500);
console.log("after 고객센터 click:", await evaluate(
  `JSON.stringify({hash:location.hash,scrollY:Math.round(scrollY),nearBottom:scrollY>document.documentElement.scrollHeight-innerHeight-100})`,
));
ws.close();
