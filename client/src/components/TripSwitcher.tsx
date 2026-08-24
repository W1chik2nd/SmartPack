import type { TripPlan } from "../api";
import { useLang } from "../i18n/useLang";
import { adjacentTripId } from "../lib/trip-dashboard";

type Props = {
  trips: TripPlan[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function TripSwitcher({ trips, selectedId, onSelect }: Props) {
  const { t } = useLang();
  const found = trips.findIndex((trip) => trip.id === selectedId);
  const index = found < 0 ? 0 : found;
  const selected = trips[index] ?? null;

  function move(direction: -1 | 1) {
    const id = adjacentTripId(trips, selected?.id ?? null, direction);
    if (id) onSelect(id);
  }

  return (
    <div className="trip-switcher" role="group" aria-label={t("destination")}>
      <button
        type="button"
        className="trip-switch-button"
        onClick={() => move(-1)}
        disabled={trips.length < 2}
        aria-label={t("previousTrip")}
      >
        ‹
      </button>
      <div className="trip-switch-copy" aria-live="polite">
        <span>{t("destination")}</span>
        <strong title={selected?.placeName}>
          {selected?.placeName ?? t("noDestination")}
        </strong>
        {trips.length > 0 && (
          <small>
            {index + 1}/{trips.length}
          </small>
        )}
      </div>
      <button
        type="button"
        className="trip-switch-button"
        onClick={() => move(1)}
        disabled={trips.length < 2}
        aria-label={t("nextTrip")}
      >
        ›
      </button>
    </div>
  );
}
