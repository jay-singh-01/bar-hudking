import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Explore", end: true },
  { to: "/favorites", label: "Favorites" },
  { to: "/visited", label: "Visited" },
];

export default function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-around">
        {links.map(({ to, label, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-sm font-medium ${
                  isActive ? "text-brand" : "text-slate-400"
                }`
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
