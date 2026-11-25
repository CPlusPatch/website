import type { RoleKey } from "@cpluspatch/render";

/** In the order the legend lists them. */
export const ROLE_LABELS: Record<RoleKey, string> = {
    station: "Station",
    telescope: "Telescope",
    navigation: "Navigation",
    "earth-observation": "Earth observation",
    science: "Science",
    other: "Other",
};
