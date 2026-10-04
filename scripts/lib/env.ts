import { setGlobalDispatcher, ProxyAgent } from "undici";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — fall back to whatever is already in process.env
}

// Node's global fetch (unlike npm/curl/browsers) does not read HTTP_PROXY /
// HTTPS_PROXY on its own — without this, requests fail with DNS ENOTFOUND
// on networks that only route external traffic through a local proxy
// (common on corporate machines).
const proxyUrl =
  process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy;
if (proxyUrl) {
  console.log(`Routing requests through proxy: ${proxyUrl}`);
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

export const USER_AGENT = "BarHudking/2.0 (personal Bangalore places app)";
