import { assertAlmostEquals, assertEquals, assertThrows } from "@std/assert";
import { parseOmmCsv, satelliteGroup } from "./celestrak.ts";

const HEADER =
    "OBJECT_NAME,OBJECT_ID,EPOCH,MEAN_MOTION,ECCENTRICITY,INCLINATION,RA_OF_ASC_NODE,ARG_OF_PERICENTER,MEAN_ANOMALY,EPHEMERIS_TYPE,CLASSIFICATION_TYPE,NORAD_CAT_ID,ELEMENT_SET_NO,REV_AT_EPOCH,BSTAR,MEAN_MOTION_DOT,MEAN_MOTION_DDOT";
const ROW =
    "CALSPHERE 1,1964-063C,2026-11-23T11:58:32.413728,13.76775695,.0027448,90.2245,75.4735,167.7147,321.6163,0,U,900,999,9334,.46921E-3,.472E-5,0";

const rad = (degrees: number): number => (degrees * Math.PI) / 180;

Deno.test("a row gives its elements in radians and its epoch in unix ms", () => {
    const [record] = parseOmmCsv(`${HEADER}\n${ROW}\n`);

    assertEquals(record.name, "CALSPHERE 1");
    assertEquals(record.norad, 900);
    assertEquals(record.epoch, Date.UTC(2026, 10, 23, 11, 58, 32, 413));
    assertEquals(record.meanMotion, 13.76775695);
    assertEquals(record.eccentricity, 0.0027448);
    assertAlmostEquals(record.inclination, rad(90.2245), 1e-12);
    assertAlmostEquals(record.raan, rad(75.4735), 1e-12);
    assertAlmostEquals(record.argp, rad(167.7147), 1e-12);
    assertAlmostEquals(record.m0, rad(321.6163), 1e-12);
});

Deno.test("columns are found by name, in any order", () => {
    const text = [
        "NORAD_CAT_ID,MEAN_ANOMALY,ARG_OF_PERICENTER,RA_OF_ASC_NODE,INCLINATION,ECCENTRICITY,MEAN_MOTION,EPOCH,OBJECT_NAME",
        "25544,10,20,30,51.6,.0005,15.5,2026-11-23T00:00:00,ISS (ZARYA)",
    ].join("\r\n");

    const [record] = parseOmmCsv(text);

    assertEquals(record.name, "ISS (ZARYA)");
    assertEquals(record.norad, 25544);
    assertEquals(record.epoch, Date.UTC(2026, 10, 23));
    assertEquals(record.meanMotion, 15.5);
    assertAlmostEquals(record.m0, rad(10), 1e-12);
});

Deno.test("a missing column throws", () => {
    const header = HEADER.replace("MEAN_MOTION,", "");

    assertThrows(() => parseOmmCsv(`${header}\n`), Error, "MEAN_MOTION");
});

Deno.test("a quoted field throws", () => {
    const row = ROW.replace("CALSPHERE 1", '"CALSPHERE 1"');

    assertThrows(() => parseOmmCsv(`${HEADER}\n${row}\n`), Error, "Quoted");
});

Deno.test("a row with the wrong field count throws", () => {
    const row = ROW.split(",").slice(0, 10).join(",");

    assertThrows(() => parseOmmCsv(`${HEADER}\n${row}\n`), Error, "fields");
});

Deno.test("a number that isn't finite throws", () => {
    const row = ROW.replace("13.76775695", "fast");
    const empty = ROW.replace("13.76775695", "");

    assertThrows(
        () => parseOmmCsv(`${HEADER}\n${row}\n`),
        Error,
        "MEAN_MOTION",
    );
    assertThrows(
        () => parseOmmCsv(`${HEADER}\n${empty}\n`),
        Error,
        "MEAN_MOTION",
    );
});

Deno.test("satellites are grouped by name prefix", () => {
    assertEquals(satelliteGroup("STARLINK-1007"), "starlink");
    assertEquals(satelliteGroup("STARLINK-32603 [DTC]"), "starlink");
    assertEquals(satelliteGroup("ONEWEB-0012"), "oneweb");
    assertEquals(satelliteGroup("KUIPER-00001"), "constellation");
    assertEquals(satelliteGroup("TIANQI-12"), "constellation");
    assertEquals(satelliteGroup("GONETS-M 21"), "constellation");
    assertEquals(satelliteGroup("IRIDIUM 106"), "constellation");
    assertEquals(satelliteGroup("HULIANWANG DIGUI-01"), "constellation");
    assertEquals(satelliteGroup("ISS (ZARYA)"), "other");
});

Deno.test("a prefix followed by a letter isn't a match", () => {
    assertEquals(satelliteGroup("TIANQIN 1 (CAS-1)"), "other");
    assertEquals(satelliteGroup("STARLINKX"), "other");
    assertEquals(satelliteGroup("IRIDIUM"), "constellation");
});

Deno.test("an epoch that isn't a date throws", () => {
    const row = ROW.replace(/,\d{4}-\d\d-\d\dT[^,]*,/, ",yesterday,");

    assertThrows(() => parseOmmCsv(`${HEADER}\n${row}\n`), Error, "EPOCH");
});

Deno.test("a header with no rows gives no records", () => {
    assertEquals(parseOmmCsv(`${HEADER}\n`), []);
});
