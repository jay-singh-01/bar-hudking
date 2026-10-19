import { useEffect, useState } from "react";
import Icon from "./Icon";

/** A quiet notice while the device is offline — everything saved still works. */
export default function OfflineBar() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 z-40 mx-auto flex max-w-lg animate-fade-up items-center justify-center gap-2 bg-ink px-4 py-2 text-[13px] text-bg"
      style={{ bottom: "calc(4.1rem + env(safe-area-inset-bottom))" }}
    >
      <Icon name="cloud" className="h-4 w-4" />
      You're offline — places and your saved data still work.
    </div>
  );
}
