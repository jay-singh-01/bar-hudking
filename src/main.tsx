import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { loadPlaces } from "./lib/places.ts";
import { initSync } from "./lib/sync.ts";
import { initInstallPrompt } from "./lib/install.ts";
import "./index.css";

// Splash (in index.html) stays until the catalogue is ready and its
// animation has played: the full ~3s on the first open of a session, a
// shorter beat when the app is reopened in the same session.
const SPLASH_KEY = "barhudking:splashSeen";
let seen = false;
try {
  seen = sessionStorage.getItem(SPLASH_KEY) === "1";
  sessionStorage.setItem(SPLASH_KEY, "1");
} catch {
  // ignore
}
const minSplashMs = seen ? 1600 : 3200;

function hideSplash() {
  const el = document.getElementById("splash");
  if (!el || el.classList.contains("splash-out")) return;
  setTimeout(() => {
    el.classList.add("splash-out");
    setTimeout(() => el.remove(), 800);
  }, Math.max(0, minSplashMs - performance.now()));
}

// Start fetching the catalogue before React renders anything. Errors are
// surfaced by usePlaces() with a retry button, so the splash hides either way.
loadPlaces().then(hideSplash, hideSplash);
setTimeout(hideSplash, 6000);
initSync();
initInstallPrompt();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
