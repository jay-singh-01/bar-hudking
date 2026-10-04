import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
import Toaster from "./components/Toaster";
import EmptyState from "./components/EmptyState";
import Discover from "./pages/Discover";
import PlaceDetail from "./pages/PlaceDetail";
import Saved from "./pages/Saved";
import ListDetail from "./pages/ListDetail";
import SharedList from "./pages/SharedList";
import CollectionPage from "./pages/CollectionPage";
import Me from "./pages/Me";

// Leaflet is the heaviest dependency; only load it when the map is opened.
const MapPage = lazy(() => import("./pages/MapPage"));

export default function App() {
  const location = useLocation();
  return (
    <div className="mx-auto min-h-screen max-w-lg">
      {/* Keyed by path so each screen eases in. The map is full-screen fixed,
          which a transformed parent would break, so it skips the animation. */}
      <div key={location.pathname} className={location.pathname === "/map" ? "" : "animate-page-in"}>
      <Routes location={location}>
        <Route path="/" element={<Discover />} />
        <Route
          path="/map"
          element={
            <Suspense fallback={<div className="skeleton fixed inset-0" />}>
              <MapPage />
            </Suspense>
          }
        />
        <Route path="/place/:id" element={<PlaceDetail />} />
        <Route path="/collection/:id" element={<CollectionPage />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/lists/:id" element={<ListDetail />} />
        <Route path="/shared" element={<SharedList />} />
        <Route path="/me" element={<Me />} />
        <Route path="*" element={<EmptyState emoji="🧭" title="Page not found" message="That link doesn't go anywhere." />} />
      </Routes>
      </div>
      <NavBar />
      <Toaster />
    </div>
  );
}
