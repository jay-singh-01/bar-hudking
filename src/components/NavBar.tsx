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
  if (pathname.startsWith("/saved") || pathname.startsWith("/lists")) return 2;
  if (pathname.startsWith("/me")) return 3;
  if (pathname === "/" || pathname.startsWith("/collection")) return 0;
  return -1;
}

export default function NavBar() {
  const favCount = useUserData((d) => live(d.favorites).length);
  const active = activeIndex(useLocation().pathname);

  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line/70"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="relative mx-auto flex max-w-lg">
        {/* One pill that glides between tabs instead of each tab lighting up. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 left-0 flex w-1/4 justify-center transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
          style={{ transform: `translateX(${Math.max(active, 0) * 100}%)`, opacity: active < 0 ? 0 : 1 }}
        >
          <span className="h-8 w-14 rounded-full bg-brand/15" />
        </span>
        {links.map(({ to, label, icon, end }, i) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold transition-colors duration-300 ${
                active === i ? "text-brand" : "text-faint"
              }`}
            >
              <span className="flex h-8 items-center px-4">
                <Icon
                  name={icon}
                  className={`h-[22px] w-[22px] transition-transform duration-300 ${active === i ? "scale-110" : ""}`}
                  filled={active === i && icon === "heart"}
                />
              </span>
              {label}
              {to === "/saved" && favCount > 0 && active !== i && (
                <span className="absolute top-1.5 left-1/2 ml-2.5 min-w-4 animate-pop rounded-full bg-brand-2 px-1 text-center text-[10px] leading-4 text-white">
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
