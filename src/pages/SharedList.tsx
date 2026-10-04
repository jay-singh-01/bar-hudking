import { useMemo } from "react";
import { useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import PlaceList from "../components/PlaceList";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import { usePlaces } from "../lib/places";
import { parseSharedList } from "../lib/share";
import { createList } from "../lib/store";
import { useFilterContext } from "../lib/useFilterContext";
import { toast } from "../lib/toast";

export default function SharedList() {
  const { search } = useRouterLocation();
  const navigate = useNavigate();
  const shared = useMemo(() => parseSharedList(search), [search]);
  const { index } = usePlaces();
  const ctx = useFilterContext();

  const places = useMemo(
    () => (shared && index ? shared.placeIds.map((id) => index.byId.get(id)).filter((p) => !!p) : []),
    [shared, index],
  );

  if (!shared) {
    return <EmptyState emoji="🔗" title="Broken link" message="This shared list link is missing its places." action={{ label: "Go to Discover", onClick: () => navigate("/") }} />;
  }

  return (
    <div className="pb-nav">
      <PageHeader title={`${shared.emoji} ${shared.name}`} subtitle={shared.from ? `Shared by ${shared.from}` : "Shared list"} back />
      <div className="px-4">
        <div className="mb-4 rounded-3xl border border-brand/30 bg-brand/10 p-4">
          <p className="text-sm">
            {shared.from ? <strong>{shared.from}</strong> : "Someone"} shared {places.length} place{places.length === 1 ? "" : "s"} with you.
          </p>
          <button
            className="btn-primary mt-3 w-full"
            onClick={() => {
              const id = createList(shared.name, shared.emoji, places.map((p) => p.id));
              toast("Saved to your lists");
              navigate(`/lists/${id}`, { replace: true });
            }}
          >
            <Icon name="download" className="h-4 w-4" /> Save to my lists
          </button>
        </div>
        {index && <PlaceList places={places} coords={ctx.coords} memoryKey={`shared:${search}`} />}
      </div>
    </div>
  );
}
