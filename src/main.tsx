import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./lib/AuthProvider.tsx";
import { UserPlacesProvider } from "./lib/UserPlacesProvider.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <UserPlacesProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </UserPlacesProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
