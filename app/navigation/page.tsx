"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Coordinates = {
  lat: number;
  lon: number;
  label: string;
};

type Mall = {
  id: number;
  type: "node" | "way" | "relation";
  name: string;
  lat: number;
  lon: number;
  distance: number;
};

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: { name?: string; brand?: string };
};

function distanceBetween(first: Coordinates, second: Coordinates) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(second.lat - first.lat);
  const longitudeDifference = radians(second.lon - first.lon);
  const arc =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(first.lat)) *
      Math.cos(radians(second.lat)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function formatDistance(distance: number) {
  return distance < 1
    ? `${Math.round(distance * 1000)} m`
    : `${distance.toFixed(1)} km`;
}

function getMallShopsUrl(mall: Mall) {
  const params = new URLSearchParams({
    id: String(mall.id),
    type: mall.type,
    name: mall.name,
    lat: String(mall.lat),
    lon: String(mall.lon),
  });

  return `/navigation/shops?${params.toString()}`;
}

export default function Navigation() {
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [malls, setMalls] = useState<Mall[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("Search an area or use your current location to get started.");

  async function loadNearbyMalls(lat: number, lon: number, label: string) {
    const currentLocation = { lat, lon, label };
    setOrigin(currentLocation);
    setStatus("loading");
    setMessage("Looking for malls nearby...");
    setMalls([]);

    try {
      const overpassQuery = `[out:json][timeout:20];nwr(around:15000,${lat},${lon})["shop"="mall"];out center tags 40;`;
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ data: overpassQuery }),
      });

      if (!response.ok) {
        throw new Error("Nearby places are temporarily unavailable. Please try again.");
      }

      const data = (await response.json()) as { elements?: OverpassElement[] };
      const nearby = (data.elements ?? [])
        .map((element) => {
          const mallLat = element.lat ?? element.center?.lat;
          const mallLon = element.lon ?? element.center?.lon;
          const name = element.tags?.name ?? element.tags?.brand;

          if (mallLat === undefined || mallLon === undefined || !name) return null;

          const distance = distanceBetween(currentLocation, {
            lat: mallLat,
            lon: mallLon,
            label: name,
          });

          return {
            id: element.id,
            type: element.type,
            name,
            lat: mallLat,
            lon: mallLon,
            distance,
          };
        })
        .filter((mall): mall is Mall => mall !== null)
        .sort((first, second) => first.distance - second.distance);

      setMalls(nearby);
      setStatus("ready");
      setMessage(
        nearby.length
          ? `${nearby.length} mall${nearby.length === 1 ? "" : "s"} found within 15 km.`
          : "No mapped malls found within 15 km. Try searching another area.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const searchTerm = query.trim();
    if (!searchTerm) {
      setStatus("error");
      setMessage("Enter a place or address to search.");
      return;
    }

    setStatus("loading");
    setMessage("Finding that place...");

    try {
      const params = new URLSearchParams({
        q: searchTerm,
        format: "jsonv2",
        limit: "1",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Place search is temporarily unavailable. Please try again.");
      }

      const places = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
      const place = places[0];

      if (!place) {
        setStatus("error");
        setMessage("We couldn't find that place. Try a nearby town or address.");
        return;
      }

      await loadNearbyMalls(Number(place.lat), Number(place.lon), place.display_name);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("Location is not available in this browser. Search for a place instead.");
      return;
    }

    setStatus("loading");
    setMessage("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void loadNearbyMalls(coords.latitude, coords.longitude, "Your current location");
      },
      () => {
        setStatus("error");
        setMessage("Location access was unavailable. Search for a place instead.");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 },
    );
  }

  const nearestMall = malls[0];
  const mapPoint = nearestMall ?? origin;
  const mapUrl = mapPoint
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapPoint.lon - 0.09}%2C${mapPoint.lat - 0.06}%2C${mapPoint.lon + 0.09}%2C${mapPoint.lat + 0.06}&layer=mapnik&marker=${mapPoint.lat}%2C${mapPoint.lon}`
    : null;

  return (
    <main className="finder-page">
      <header className="finder-header">
        <Link className="finder-brand" href="/" aria-label="Arah home">
          <span className="finder-brand-mark" aria-hidden="true">a</span>
          <span>arah</span>
        </Link>
        <span className="finder-header-label">Mall finder</span>
        <Link className="finder-back" href="/">Back to home <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="finder-intro" aria-labelledby="finder-title">
        <p className="eyebrow">ARAH</p>
        <h1 id="finder-title">A good day starts <em>somewhere.</em></h1>
        <p className="finder-subtitle">Find a mall nearby, wherever you happen to be.</p>

        <form className="place-search" onSubmit={handleSearch}>
          <label className="visually-hidden" htmlFor="place-query">Search by city, area, or address</label>
          <span className="search-symbol" aria-hidden="true">⌕</span>
          <input
            id="place-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="City, neighbourhood, or address"
            autoComplete="street-address"
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Searching..." : "Find malls"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <button className="location-button" type="button" onClick={handleLocate} disabled={status === "loading"}>
          <span aria-hidden="true">◎</span> Use my current location
        </button>
      </section>

      <section className="finder-results" aria-label="Nearby mall results">
        <div className="results-panel">
          <div className="results-heading">
            <div>
              <p className="eyebrow">NEAR YOU</p>
              <h2>{nearestMall ? "Closest malls" : "Your nearby list"}</h2>
            </div>
            {malls.length > 0 && <span className="result-count">{malls.length} places</span>}
          </div>

          <p className={`finder-message ${status === "error" ? "is-error" : ""}`} role="status" aria-live="polite">
            {message}
          </p>

          {nearestMall && origin && (
            <div className="nearest-mall">
              <div className="nearest-mall-heading">
                <span>NEAREST MALL</span>
                <span>{formatDistance(nearestMall.distance)} away</span>
              </div>
              <h3>
                <Link href={getMallShopsUrl(nearestMall)}>{nearestMall.name}</Link>
              </h3>
              <Link className="nearest-mall-shops" href={getMallShopsUrl(nearestMall)}>
                Find shops in this mall <span aria-hidden="true">→</span>
              </Link>
              <a
                href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.lat}%2C${origin.lon}%3B${nearestMall.lat}%2C${nearestMall.lon}`}
                target="_blank"
                rel="noreferrer"
              >
                Get directions <span aria-hidden="true">↗</span>
              </a>
            </div>
          )}

          {malls.length > 1 && (
            <>
              <p className="nearby-list-label">Other malls nearby</p>
            <ol className="mall-list">
              {malls.slice(1).map((mall, index) => (
                <li className="mall-row" key={`${mall.id}-${mall.name}`}>
                  <span className="mall-number">{String(index + 2).padStart(2, "0")}</span>
                  <Link className="mall-name" href={getMallShopsUrl(mall)}>{mall.name}</Link>
                  <span className="mall-distance">{formatDistance(mall.distance)}</span>
                  <a
                    className="mall-directions"
                    href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin?.lat}%2C${origin?.lon}%3B${mall.lat}%2C${mall.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Get directions to ${mall.name}`}
                  >
                    ↗
                  </a>
                </li>
              ))}
            </ol>
            </>
          )}

          {origin && (
            <p className="origin-label">
              <span aria-hidden="true">◎</span> {origin.label}
            </p>
          )}
        </div>

        <div className="map-panel">
          <div className="map-heading">
            <span>MAP VIEW</span>
            {mapPoint && <span>15 KM RADIUS</span>}
          </div>
          {mapUrl ? (
            <iframe
              className="map-frame"
              title="OpenStreetMap showing your location and nearest mall"
              src={mapUrl}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="map-empty">
              <span className="map-empty-mark" aria-hidden="true">+</span>
              <p>Your map will appear here</p>
              <span>Search a place or share your location</span>
            </div>
          )}
          <div className="map-credit">Map data © OpenStreetMap contributors</div>
        </div>
      </section>

      <footer className="finder-footer">
        <span>ARAH <span className="footer-dot">/</span> MOVE WITH EASE</span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap data
        </a>
      </footer>
    </main>
  );
}