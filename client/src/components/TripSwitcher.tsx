import type { TripPlan } from "../api";
import { useLang } from "../i18n/useLang";
import { adjacentTripId } from "../lib/trip-dashboard";

type Props = {
  trips: TripPlan[];
  selectedId: string | null;
  onSelect: (id: string, direction: -1 | 1) => void;
};

export default function TripSwitcher({ trips, selectedId, onSelect }: Props) {
  const { t } = useLang();
  if (trips.length < 2) return null;

  const found = trips.findIndex((trip) => trip.id === selectedId);
  const index = found < 0 ? 0 : found;
  const selected = trips[index] ?? null;

  function move(direction: -1 | 1) {
    const id = adjacentTripId(trips, selected?.id ?? null, direction);
    if (id) onSelect(id, direction);
  }

  return (
    <div className="trip-card-controls" role="group" aria-label={t("destination")}>
      <button
        type="button"
        className="trip-card-switch is-previous"
        onClick={() => move(-1)}
        aria-label={t("previousTrip")}
      >
        ‹
      </button>
      <button
        type="button"
        className="trip-card-switch is-next"
        onClick={() => move(1)}
        aria-label={t("nextTrip")}
      >
        ›
      </button>
    </div>
  );
}
