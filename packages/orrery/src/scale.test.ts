import { AU } from "@cpluspatch/orbit";
import { assertAlmostEquals, assertEquals } from "@std/assert";
import { kmPerPx, scaleBar } from "./scale.ts";

const AU_KM = AU / 1000;

Deno.test("the bar is the largest 1, 2 or 5 times a power of ten of at least 0.6 of the target", () => {
    // 7,000 km: 5,000 km is over 0.6 of it (4,200), 2,000 km is under.
    assertEquals(scaleBar(100, 70, null).label, "5,000 km");
    // 10,000 km: 5,000 km is under 0.6 of it (6,000), so the next step up wins.
    assertEquals(scaleBar(100, 100, null).label, "10,000 km");
    // 8,000 km: 5,000 km is over 0.6 of it (4,800), so it stays.
    assertEquals(scaleBar(100, 80, null).label, "5,000 km");
    assertEquals(scaleBar(4, 70, null).label, "200 km");
});

Deno.test("the bar's width is its length over the km per pixel", () => {
    // 1,750 km target, so the bar is 2,000 km.
    const { px } = scaleBar(25, 70, null);

    assertEquals(px, 80);
});

Deno.test("km labels switch to million from 1e7 and billion from 1e9", () => {
    assertEquals(scaleBar(1e5, 100, "km").label, "10 million km");
    assertEquals(scaleBar(5e4, 100, "km").label, "5,000,000 km");
    assertEquals(scaleBar(1e6, 100, "km").label, "100 million km");
    assertEquals(scaleBar(2e7, 100, "km").label, "2 billion km");
    assertEquals(scaleBar(1e3, 100, "km").label, "100,000 km");
});

Deno.test("the unit is km below 0.1 AU and AU from there", () => {
    assertEquals(
        scaleBar((0.05 * AU_KM) / 70, 70, null).label.endsWith(" km"),
        true,
    );
    assertEquals(
        scaleBar((0.2 * AU_KM) / 70, 70, null).label.endsWith(" AU"),
        true,
    );
});

Deno.test("AU labels show whole and fractional lengths", () => {
    assertEquals(scaleBar(AU_KM / 70, 70, null).label, "1 AU");
    assertEquals(scaleBar((20 * AU_KM) / 70, 70, null).label, "20 AU");
    assertEquals(scaleBar((0.5 * AU_KM) / 70, 70, null).label, "0.5 AU");
});

Deno.test("a chosen unit overrides the default one", () => {
    const perPx = (0.5 * AU_KM) / 70;

    assertEquals(scaleBar(perPx, 70, "km").label, "50 million km");
    assertEquals(scaleBar(1e5, 70, "AU").label, "0.05 AU");
});

Deno.test("an AU bar is as wide as its length in AU over the AU per pixel", () => {
    const { px } = scaleBar((0.5 * AU_KM) / 70, 70, "AU");

    assertAlmostEquals(px, 70, 1e-9);
});

Deno.test("km per pixel is the frustum's height at the focus over the viewport height", () => {
    // A 90 degree view at 500 km spans 1,000 km, which 500 px show at 2 km each.
    assertAlmostEquals(kmPerPx(500, Math.PI / 2, 500), 2, 1e-9);
});
