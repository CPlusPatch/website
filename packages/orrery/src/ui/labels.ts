import type { RoleKey } from "@cpluspatch/render";
import type { BodyKind } from "@cpluspatch/sim";

export const KIND_LABELS: Record<BodyKind, string> = {
    star: "Star",
    planet: "Planet",
    dwarf: "Dwarf planet",
    moon: "Moon",
    asteroid: "Asteroid",
    comet: "Comet",
    spacecraft: "Spacecraft",
};

/** In the order the legend lists them. */
export const ROLE_LABELS: Record<RoleKey, string> = {
    station: "Station",
    telescope: "Telescope",
    navigation: "Navigation",
    "earth-observation": "Earth observation",
    science: "Science",
    other: "Other",
};
