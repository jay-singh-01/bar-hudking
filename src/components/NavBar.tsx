import { NavLink, useLocation } from "react-router-dom";
import Icon, { type IconName } from "./Icon";
import { live, useUserData } from "../lib/store";

const links: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/", label: "Discover", icon: "compass", end: true },
  { to: "/map", label: "Map", icon: "map" },
  { to: "/saved", label: "Saved", icon: "heart" },
  { to: "/me", label: "Me", icon: "user" },
];

function activeIndex(pathname: string) {
  if (pathname.startsWith("/map")) return 1;
  if (pathname.startsWith("/saved") || pathname.startsWith("/lists") || pathname.startsWith("/plans")) return 2;
  if (pathname.startsWith("/me")) return 3;
  if (pathname === "/" || pathname.startsWith("/collection")) return 0;
  return -1;
}

export default function NavBar() {
  const favCount = useUserData((d) => live(d.favorites).length);
  const active = activeIndex(useLocation().pathname);

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="relative mx-auto flex max-w-lg">
        {/* A short accent rule that slides to the active tab. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 flex w-1/4 justify-center transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.3,1.2,0.5,1)]"
          style={{ transform: `translateX(${Math.max(active, 0) * 100}%)`, opacity: active < 0 ? 0 : 1 }}
        >
          <span className="h-0.5 w-8 rounded-full bg-brand" />
        </span>
        {links.map(({ to, label, icon, end }, i) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={`relative flex flex-col items-center gap-1 pt-3 pb-2 text-[11px] font-medium transition-colors duration-300 ${
                active === i ? "text-ink" : "text-faint"
              }`}
            >
              <Icon name={icon} className="h-[21px] w-[21px]" strokeWidth={active === i ? 2 : 1.6} filled={active === i && icon === "heart"} />
              {label}
              {to === "/saved" && favCount > 0 && active !== i && (
                <span className="tabular absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-brand-2 px-1 text-center text-[10px] leading-4 text-white">
                  {favCount > 99 ? "99+" : favCount}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
