"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

export type MallSelection = {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: "node" | "way" | "relation";
};

type Shop = {
  id: number;
  name: string;
  category: string;
  address: string;
  floor?: string;
  hours?: string;
  lat?: number;
  lon?: number;
  url?: string;
};

type AeonDirectoryShop = {
  id: number;
  name: string;
  category: string;
  floor: string;
  url: string;
  lat?: number;
  lon?: number;
};

type OverpassShop = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type Props = {
  mall: MallSelection | null;
};

function formatCategory(value: string) {
  return value.replaceAll("_", " ");
}

function isAeonBukitTinggiMall(mall: MallSelection | null) {
  const name = mall?.name.toLocaleLowerCase() ?? "";
  return name.includes("aeon") && name.includes("bukit tinggi");
}

function getShopDestination(shop: Shop, mall: MallSelection | null) {
  if (shop.url) {
    return { url: shop.url, label: `Open official details for ${shop.name}` };
  }

  if (!mall || shop.lat === undefined || shop.lon === undefined) return null;

  return {
    url: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${mall.lat}%2C${mall.lon}%3B${shop.lat}%2C${shop.lon}`,
    label: `Get directions to ${shop.name}`,
  };
}

function getShopArUrl(shop: Shop, mall: MallSelection | null) {
  if (!mall || shop.lat === undefined || shop.lon === undefined) return null;

  const params = new URLSearchParams({
    name: shop.name,
    floor: shop.floor ?? "",
    lat: String(shop.lat),
    lon: String(shop.lon),
    mallId: String(mall.id),
    mallType: mall.type,
    mallName: mall.name,
    mallLat: String(mall.lat),
    mallLon: String(mall.lon),
  });

  return `/navigation/ar?${params.toString()}`;
}

export default function ShopFinder({ mall }: Props) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadMessage, setLoadMessage] = useState("Loading shops...");
  const [isApproximate, setIsApproximate] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const status = mall ? loadStatus : "error";
  const message = mall
    ? loadMessage
    : "Choose a mall from the mall finder to search its shops.";

  useEffect(() => {
    if (!mall) return;

    const controller = new AbortController();
    const isAeonBukitTinggi = isAeonBukitTinggiMall(mall);
    const isPointMall = mall.type === "node";
    const selector = isPointMall
      ? `nwr(around:350,${mall.lat},${mall.lon})["shop"];`
      : `${mall.type}(${mall.id});map_to_area->.mall;nwr(area.mall)["shop"];`;
    const overpassQuery = `[out:json][timeout:25];${selector}out center tags 150;`;

    async function loadShops() {
      setLoadStatus("loading");
      setLoadMessage("Finding mapped shops...");
      setShops([]);
      setIsApproximate(isPointMall && !isAeonBukitTinggi);

      try {
        let foundShops: Shop[];

        if (isAeonBukitTinggi) {
          const response = await fetch("/api/malls/aeon-bukit-tinggi/shops", {
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error("AEON Mall's shop directory is temporarily unavailable.");
          }

          const data = (await response.json()) as {
            shops?: AeonDirectoryShop[];
          };
          foundShops = (data.shops ?? []).map((shop) => ({
            id: shop.id,
            name: shop.name,
            category: shop.category,
            address: shop.floor,
            floor: shop.floor,
            url: shop.url,
            lat: shop.lat,
            lon: shop.lon,
          }));
        } else {
          const response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams({ data: overpassQuery }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error("Shop listings are temporarily unavailable. Please try again.");
          }

          const data = (await response.json()) as { elements?: OverpassShop[] };
          foundShops = (data.elements ?? [])
            .map((element): Shop | null => {
              const lat = element.lat ?? element.center?.lat;
              const lon = element.lon ?? element.center?.lon;
              const tags = element.tags;
              const name = tags?.name ?? tags?.brand;
              const category = tags?.shop;

              if (
                lat === undefined ||
                lon === undefined ||
                !name ||
                !category ||
                category === "mall"
              ) {
                return null;
              }

              const street = [tags["addr:housenumber"], tags["addr:street"]]
                .filter(Boolean)
                .join(" ");

              return {
                id: element.id,
                name,
                category: formatCategory(category),
                address: street || tags["addr:place"] || "Address not listed",
                hours: tags.opening_hours,
                lat,
                lon,
              };
            })
            .filter((shop): shop is Shop => shop !== null);
        }

        foundShops.sort((first, second) => first.name.localeCompare(second.name));

        setShops(foundShops);
        setLoadStatus("ready");
        setLoadMessage(
          foundShops.length
            ? `${foundShops.length} ${isAeonBukitTinggi ? "officially listed" : "mapped"} shop${foundShops.length === 1 ? "" : "s"} found.`
            : "No shops are mapped here yet. Try another search term or mall.",
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadStatus("error");
        setLoadMessage(
          error instanceof Error
            ? error.message
            : "Something went wrong while loading shops.",
        );
      }
    }

    void loadShops();
    return () => controller.abort();
  }, [mall, retryCount]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedQuery(query.trim().toLocaleLowerCase());
  }

  const categoryOrder = [
    "Food & Beverages",
    "Fashion",
    "Accessories",
    "Specialty",
    "Services",
    "Entertainment",
    "Health & Beauty",
  ];
  const categories = Array.from(new Set(shops.map((shop) => shop.category))).sort(
    (first, second) => {
      const firstIndex = categoryOrder.indexOf(first);
      const secondIndex = categoryOrder.indexOf(second);

      if (firstIndex === -1 && secondIndex === -1) return first.localeCompare(second);
      if (firstIndex === -1) return 1;
      if (secondIndex === -1) return -1;
      return firstIndex - secondIndex;
    },
  );
  const activeCategory = categories.includes(selectedCategory) ? selectedCategory : "all";
  const categoryOptions = [
    { value: "all", label: "All shops", count: shops.length },
    ...categories.map((category) => ({
      value: category,
      label: category,
      count: shops.filter((shop) => shop.category === category).length,
    })),
  ];
  const filteredShops = shops.filter((shop) => {
    const matchesCategory = activeCategory === "all" || shop.category === activeCategory;
    const matchesQuery = `${shop.name} ${shop.category} ${shop.floor ?? ""}`
      .toLocaleLowerCase()
      .includes(submittedQuery);

    return matchesCategory && matchesQuery;
  });

  return (
    <main className="finder-page shop-page">
      <header className="finder-header">
        <Link className="finder-brand" href="/" aria-label="Arah home">
          <span className="finder-brand-mark" aria-hidden="true">a</span>
          <span>arah</span>
        </Link>
        <span className="finder-header-label">Shop finder</span>
        <Link className="finder-back" href="/navigation">Back to malls <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="shop-intro" aria-labelledby="shop-title">
        <p className="eyebrow">{mall ? "SHOPPING IN" : "MALL NOT SELECTED"}</p>
        <h1 id="shop-title">{mall?.name ?? "Choose a mall"}</h1>
        <p className="finder-subtitle">
          {isAeonBukitTinggiMall(mall)
            ? "Search AEON Mall's official directory by store, category, or floor."
            : isApproximate
              ? "Search mapped shops near this mall. This location is mapped as a point."
              : "Search stores by name or category inside this mall."}
        </p>
        <form className="place-search" onSubmit={handleSearch}>
          <label className="visually-hidden" htmlFor="shop-query">Search shops in this mall</label>
          <span className="search-symbol" aria-hidden="true">⌕</span>
          <input
            id="shop-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search shop or category"
            autoComplete="off"
          />
          <button type="submit">
            Search shops <span aria-hidden="true">↗</span>
          </button>
        </form>
      </section>

      <section className="shop-results" aria-label="Shops in selected mall">
        <div className="shop-results-heading">
          <div>
            <p className="eyebrow">DIRECTORY</p>
            <h2>
              {submittedQuery
                ? "Search results"
                : isAeonBukitTinggiMall(mall)
                  ? "Official shop directory"
                  : "All mapped shops"}
            </h2>
          </div>
          {status === "ready" && (
            <span className="result-count">
              {filteredShops.length} {filteredShops.length === 1 ? "shop" : "shops"}
            </span>
          )}
        </div>

        <p className={`finder-message ${status === "error" ? "is-error" : ""}`} role="status" aria-live="polite">
          {message}
        </p>

        {status === "ready" && shops.length > 0 && (
          <div className="shop-category-filters" role="group" aria-label="Filter shops by category">
            {categoryOptions.map((option) => (
              <button
                className={`shop-category-filter${activeCategory === option.value ? " is-active" : ""}`}
                type="button"
                key={option.value}
                aria-pressed={activeCategory === option.value}
                onClick={() => setSelectedCategory(option.value)}
              >
                <span>{option.label}</span>
                <span className="shop-category-count">{option.count}</span>
              </button>
            ))}
          </div>
        )}

        {status === "error" && mall && (
          <button className="shop-retry" type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
        )}

        {status === "ready" && filteredShops.length > 0 && (
          <ul className="shop-list">
            {filteredShops.map((shop) => {
              const destination = getShopDestination(shop, mall);
              const arUrl = getShopArUrl(shop, mall);

              return (
                <li className="shop-row" key={`${shop.id}-${shop.name}`}>
                  <span className="shop-category">{shop.category}</span>
                  <div className="shop-details">
                    <h3>
                      {arUrl ? <Link href={arUrl}>{shop.name}</Link> : shop.name}
                    </h3>
                    <p>{shop.floor ?? shop.address}{shop.hours ? ` · ${shop.hours}` : ""}</p>
                  </div>
                  <div className="shop-actions">
                    {destination && (
                      <a
                        className="shop-directions"
                        href={destination.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={destination.label}
                      >
                        ↗
                      </a>
                    )}
                    {arUrl && (
                      <Link className="shop-ar" href={arUrl} aria-label={`Start AR directions to ${shop.name}`}>
                        AR
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {status === "ready" && submittedQuery && filteredShops.length === 0 && shops.length > 0 && (
          <p className="shop-empty">No shops match “{query.trim()}”. Try a different name or category.</p>
        )}
      </section>

      <footer className="finder-footer">
        <span>ARAH <span className="footer-dot">/</span> MOVE WITH EASE</span>
        <a
          href={
            isAeonBukitTinggiMall(mall)
              ? "https://aeonmallmy.com/page/mall/aeon-mall-bukit-tinggi#shop-directory"
              : "https://www.openstreetmap.org/copyright"
          }
          target="_blank"
          rel="noreferrer"
        >
          {isAeonBukitTinggiMall(mall) ? "AEON Mall tenant directory" : "OpenStreetMap data"}
        </a>
      </footer>
    </main>
  );
}