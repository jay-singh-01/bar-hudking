import { Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import Explore from "./pages/Explore";
import Favorites from "./pages/Favorites";
import Visited from "./pages/Visited";
import { useAuth } from "./lib/AuthProvider";

export default function App() {
  const { loading, error } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center text-red-400">
        Couldn't start a session: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="mx-auto max-w-md">
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/visited" element={<Visited />} />
        </Routes>
      </div>
      <NavBar />
    </div>
  );
}
