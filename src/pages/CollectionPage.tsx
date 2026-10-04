import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import PlaceList from "../components/PlaceList";
import { PlaceCardSkeleton } from "../components/PlaceCard";
import SurpriseSheet from "../components/SurpriseSheet";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import { collectionById, sortPlaces } from "../lib/discover";
import { usePlaces } from "../lib/places";
import { useFilterContext } from "../lib/useFilterContext";
import { requestLocation } from "../lib/location";
import { haversineKm } from "../lib/geo";

export default function CollectionPage() {
  const { id = "" } = useParams();
  const collection = collectionById(id);
  const { index } = usePlaces();
  const ctx = useFilterContext();
  const [nearOnly, setNearOnly] = useState(false);
  const [surprise, setSurprise] = useState(false);

  const places = useMemo(() => {
    if (!index || !collection) return [];
    let list = index.places.filter(collection.test);
    if (nearOnly && ctx.coords) list = list.filter((p) => haversineKm(ctx.coords!, p) <= 5);
    return sortPlaces(list, collection.sort, ctx, "");
  }, [index, collection, ctx, nearOnly]);

  if (!collection) {
    return <EmptyState emoji="🤷" title="Collection not found" message="It may have been renamed." />;
  }

  return (
    <div className="pb-nav">
      <PageHeader title={collection.title} back />
      <div className={`mx-4 mb-4 overflow-hidden rounded-3xl bg-gradient-to-br p-5 ${collection.gradient}`}>
        <div className="text-5xl">{collection.emoji}</div>
        <p className="mt-2 text-white/90">{collection.blurb}</p>
        <p className="mt-1 text-sm font-semibold text-white">{places.length} places</p>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4">
        <button
          className={`chip ${nearOnly ? "chip-on" : ""}`}
          onClick={() => {
            if (!ctx.coords) requestLocation();
            setNearOnly(!nearOnly);
          }}
        >
          <Icon name="locate" className="h-4 w-4" /> Within 5 km
        </button>
        <button className="chip" onClick={() => setSurprise(true)}>
          <Icon name="dice" className="h-4 w-4" /> Pick one for me
        </button>
      </div>

      <div className="px-4">
        {!index ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <PlaceCardSkeleton key={i} />
            ))}
          </div>
        ) : places.length ? (
          <PlaceList places={places} coords={ctx.coords} memoryKey={`collection:${id}:${nearOnly}`} />
        ) : (
          <EmptyState emoji="🧭" title="Nothing nearby" message="None of these are within 5 km of you." />
        )}
      </div>

      {surprise && <SurpriseSheet candidates={places} coords={ctx.coords} onClose={() => setSurprise(false)} />}
    </div>
  );
}
