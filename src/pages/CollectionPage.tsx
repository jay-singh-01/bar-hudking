import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import PlaceList from "../components/PlaceList";
import { PlaceCardSkeleton } from "../components/PlaceCard";
import SurpriseSheet from "../components/SurpriseSheet";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import PlacePhoto from "../components/PlacePhoto";
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
    let list = index.places.filter((p) => collection.test(p) && !ctx.hiddenIds.has(p.id));
    if (nearOnly && ctx.coords) list = list.filter((p) => haversineKm(ctx.coords!, p) <= 5);
    return sortPlaces(list, collection.sort, ctx, "");
  }, [index, collection, ctx, nearOnly]);

  if (!collection) {
    return <EmptyState icon="search" title="Collection not found" message="It may have been renamed." />;
  }

  return (
    <div className="pb-nav">
      <PageHeader title={collection.title} back />
      <div className="relative mx-4 mt-4 mb-4 h-40 overflow-hidden rounded-xl">
        {places[0] && <PlacePhoto place={places[0]} src={undefined} className="absolute inset-0 h-full w-full animate-ken-burns" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-display text-lg leading-snug text-white italic">{collection.blurb}</p>
          <p className="tabular mt-1 text-xs text-white/70">{places.length} places</p>
        </div>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4">
        <button
          className={`chip ${nearOnly ? "chip-on" : ""}`}
          onClick={() => {
            if (!ctx.coords) requestLocation();
            setNearOnly(!nearOnly);
          }}
        >
          <Icon name="locate" className="h-3.5 w-3.5" /> Within 5 km
        </button>
        <button className="chip" onClick={() => setSurprise(true)}>
          <Icon name="dice" className="h-3.5 w-3.5" /> Pick one for me
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
          <EmptyState icon="compass" title="Nothing nearby" message="None of these are within 5 km of you." />
        )}
      </div>

      {surprise && <SurpriseSheet candidates={places} coords={ctx.coords} onClose={() => setSurprise(false)} />}
    </div>
  );
}
