import { load } from "cheerio";

const DIRECTORY_URL =
  "https://aeonmallmy.com/page/mall/aeon-mall-bukit-tinggi";

const CATEGORY_LABELS: Record<string, string> = {
  accessories: "Accessories",
  entertainment: "Entertainment",
  fashion: "Fashion",
  fnb: "Food & Beverages",
  "health-beauty": "Health & Beauty",
  services: "Services",
  specialty: "Specialty",
};

export const revalidate = 3600;

export async function GET() {
  try {
    const response = await fetch(DIRECTORY_URL, {
      next: { revalidate },
    });

    if (!response.ok) {
      return Response.json(
        { error: "AEON Mall's directory is temporarily unavailable." },
        { status: 502 },
      );
    }

    const html = await response.text();
    const htmlDocument = load(html);
    const shops = htmlDocument(
      ".tenant[data-category][data-floor][data-name]",
    )
      .toArray()
      .flatMap((element) => {
        const card = htmlDocument(element);
        const category = card.attr("data-category");
        const floor = card.attr("data-floor");
        const name = card.attr("data-name");
        const tenantHref = card
          .find('a[href*="/page/tenant/"]')
          .first()
          .attr("href");

        if (!category || !floor || !name || !tenantHref) return [];

        const tenantUrl = new URL(tenantHref, DIRECTORY_URL);
        const tenantId = tenantUrl.pathname.match(/^\/page\/tenant\/(\d+)\/?$/)?.[1];

        if (tenantUrl.origin !== new URL(DIRECTORY_URL).origin || !tenantId) {
          return [];
        }

            const coordinatesByTenantId: Record<number, { lat: number; lon: number }> = {
          14810: { lat: 2.9939452, lon: 101.444546 }, // Padini
          14881: { lat: 3.00175582929425, lon: 101.44357676517059 },// UNIQLO
        };
        
        const coordinates = coordinatesByTenantId[Number(tenantId)] ?? {};
        return [{
          id: Number(tenantId),
          name,
          category: CATEGORY_LABELS[category] ?? category.replaceAll("-", " "),
          floor,
          url: tenantUrl.toString(),
          ...coordinates,
        }];
      });

    if (shops.length === 0) {
      return Response.json(
        { error: "The AEON Mall directory format changed; no shops were found." },
        { status: 502 },
      );
    }

    return Response.json({ mall: "AEON Mall Bukit Tinggi", shops });
  } catch {
    return Response.json(
      { error: "Could not load AEON Mall's shop directory." },
      { status: 502 },
    );
  }
}