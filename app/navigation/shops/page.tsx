import ShopFinder, { type MallSelection } from "./shop-finder";

type SearchValue = string | string[] | undefined;

function firstValue(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchValue>>;
}) {
  const params = await searchParams;
  const id = Number(firstValue(params.id));
  const lat = Number(firstValue(params.lat));
  const lon = Number(firstValue(params.lon));
  const type = firstValue(params.type);
  const name = firstValue(params.name)?.trim();

  const mall: MallSelection | null =
    Number.isInteger(id) &&
    id > 0 &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Boolean(name) &&
    (type === "node" || type === "way" || type === "relation")
      ? { id, lat, lon, name: name!, type }
      : null;

  return <ShopFinder mall={mall} />;
}