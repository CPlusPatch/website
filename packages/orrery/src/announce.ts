import type { Body } from "@cpluspatch/orbit";
import type { SatelliteEvent } from "./view/scene.ts";
import type { WorldEvent } from "./world.ts";

/** What a screen reader says for a selection or focus change, or `null` for any other event. */
export const announcement = (
    event: WorldEvent,
    bodies: readonly Pick<Body, "id" | "name">[],
): string | null => {
    const name = (id: string) =>
        bodies.find((body) => body.id === id)?.name ?? id;

    if (event.type === "selection") {
        return event.id === null
            ? "Selection cleared."
            : `Selected ${name(event.id)}.`;
    }
    if (event.type === "focus") return `Focused on ${name(event.id)}.`;

    return null;
};

/**
 * What a screen reader says for a satellite change, or `null` when the world's event says it.
 * `name` is the satellite's, or `null` when it's gone.
 */
export const satelliteAnnouncement = (
    event: SatelliteEvent,
    name: string | null,
): string | null => {
    if (event.type === "selection") {
        return event.k === null
            ? "Selection cleared."
            : `Selected ${name ?? "satellite"}.`;
    }

    return event.k === null ? null : `Focused on ${name ?? "satellite"}.`;
};
