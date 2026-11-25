/// <reference types="deno" />

import { isModel } from "@cpluspatch/sim";
import { assert, assertEquals } from "@std/assert";
import { PRESETS } from "./index.ts";

// The bodies that had a rotation model before rotation became data.
const WITH_ROTATION = [
    "sun",
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
    "moon",
    "io",
    "europa",
    "ganymede",
    "callisto",
    "mimas",
    "enceladus",
    "tethys",
    "dione",
    "rhea",
    "iapetus",
    "triton",
    "phobos",
    "charon",
    "ceres",
    "vesta",
    "kerbol",
    "moho",
    "eve",
    "gilly",
    "kerbin",
    "minmus",
    "dres",
    "jool",
    "eeloo",
    "mun",
    "ike",
    "duna",
    "laythe",
    "vall",
    "tylo",
    "bop",
    "pol",
];

Deno.test("every preset is a known model", () => {
    for (const id of Object.keys(PRESETS)) {
        assert(isModel(id), `${id} isn't a model`);
    }
});

Deno.test("the presets are the bodies that had a rotation model", () => {
    assertEquals(Object.keys(PRESETS).sort(), [...WITH_ROTATION].sort());
});
