import type { Metadata } from "next";
import ArCamera, { type ArTarget } from "./ar-camera";

export const metadata: Metadata = {
  title: "AR Direction Test | Arah",
  description: "Test a camera compass direction to a selected shop.",
};

type SearchValue = string | string[] | undefined;

function firstValue(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ArPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchValue>>;
}) {
  const params = await searchParams;
  const name = firstValue(params.name)?.trim();
  const floor = firstValue(params.floor) ?? "";
  const lat = Number(firstValue(params.lat));
  const lon = Number(firstValue(params.lon));
  const target: ArTarget | null =
    name && Number.isFinite(lat) && Number.isFinite(lon)
      ? { name, floor, lat, lon }
      : null;

  const mallId = Number(firstValue(params.mallId));
  const mallType = firstValue(params.mallType);
  const mallName = firstValue(params.mallName);
  const mallLat = Number(firstValue(params.mallLat));
  const mallLon = Number(firstValue(params.mallLon));
  const backHref =
    Number.isInteger(mallId) &&
    mallId > 0 &&
    mallName &&
    Number.isFinite(mallLat) &&
    Number.isFinite(mallLon) &&
    (mallType === "node" || mallType === "way" || mallType === "relation")
      ? `/navigation/shops?${new URLSearchParams({
          id: String(mallId),
          type: mallType,
          name: mallName,
          lat: String(mallLat),
          lon: String(mallLon),
        }).toString()}`
      : "/navigation";

  return <ArCamera target={target} backHref={backHref} />;
}