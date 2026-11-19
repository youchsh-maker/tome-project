"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";

export type MapPoint = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  free: boolean;
  /** Free compartments per size, shown in the marker popup. */
  available: { Large: number; Medium: number; Small: number };
  href?: string;
  /** Popup link text; defaults to "Locker info". */
  linkLabel?: string;
};

/**
 * OpenStreetMap view of locker positions. Free lockers and full lockers use different marker styles.
 * The "overview" variant draws soft pastel tiles and a speech-bubble marker with the free count.
 */
export function LockerMap({
  points,
  label,
  variant = "default",
}: {
  points: MapPoint[];
  label: string;
  variant?: "default" | "overview";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const located = points.filter((p) => p.lat && p.lon);
    if (!el || located.length === 0) return;

    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled) return;
      map = L.map(el, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      for (const p of located) {
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = p.label;
        const { Large, Medium, Small } = p.available;
        popup.append(title, document.createElement("br"), `Free now: Large ${Large} · Medium ${Medium} · Small ${Small}`);
        if (p.href) {
          const link = document.createElement("a");
          link.href = p.href;
          link.textContent = p.linkLabel ?? "Locker info";
          popup.append(document.createElement("br"), link);
        }

        let marker: import("leaflet").Layer;
        if (variant === "overview") {
          const bubble = document.createElement("span");
          bubble.className = `locker-bubble ${p.free ? "locker-bubble-free" : "locker-bubble-full"}`;
          bubble.textContent = `🧳 ${Large + Medium + Small}`;
          marker = L.marker([p.lat, p.lon], {
            icon: L.divIcon({ html: bubble, className: "", iconSize: undefined, iconAnchor: [8, 8] }),
            title: p.label,
          });
        } else {
          marker = L.circleMarker([p.lat, p.lon], {
            radius: 9,
            className: p.free ? "locker-marker-free" : "locker-marker-full",
          });
        }
        marker.bindPopup(popup).bindTooltip(p.label).addTo(map);
      }

      if (variant === "overview") {
        // Start on central Seoul; bubbles show counts only once zoomed in enough to keep them apart.
        const m = map;
        const toggleCounts = () => el.classList.toggle("show-counts", m.getZoom() >= 13);
        m.on("zoomend", toggleCounts);
        m.setView([37.5565, 126.99], 11);
        toggleCounts();
      } else if (located.length === 1) map.setView([located[0].lat, located[0].lon], 17);
      else map.fitBounds(L.latLngBounds(located.map((p) => [p.lat, p.lon])), { padding: [32, 32], maxZoom: 17 });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, variant]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={ref}
        role="region"
        aria-label={label}
        className={
          variant === "overview"
            ? "locker-map-overview z-0 h-96 w-full overflow-hidden rounded-3xl border-2 border-primary/20 shadow-sm"
            : "z-0 h-64 w-full overflow-hidden rounded-xl border"
        }
      />
      <ul className="flex gap-4 text-xs text-muted-foreground" aria-label="Map legend">
        <li className="flex items-center gap-1.5">
          <span className={variant === "overview" ? "locker-legend-free size-3 rounded-full" : "size-3 rounded-full bg-primary"} />{" "}
          Free now
        </li>
        <li className="flex items-center gap-1.5">
          <span className={variant === "overview" ? "locker-legend-full size-3 rounded-full" : "size-3 rounded-full bg-muted-foreground/60"} />{" "}
          Full
        </li>
      </ul>
    </div>
  );
}
