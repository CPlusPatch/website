import type { SatelliteEvent, SceneEvent } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";
import type { Departure } from "./state/scene.ts";

/** What a screen reader says for a selection or focus change, or `null` for any other event. */
export const announcement = (
    event: SceneEvent,
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

/** What a screen reader says when the clock leaves the lifetime of the focused or selected body. */
export const presenceAnnouncement = (
    departure: Departure,
    bodies: readonly Pick<Body, "id" | "name">[],
): string => {
    const names = departure.gone.map(
        (id) => bodies.find((body) => body.id === id)?.name ?? id,
    );
    const gone =
        names.length === 1
            ? `${names[0]} isn't there`
            : `${names.join(" and ")} aren't there`;
    const focus =
        departure.focused === null
            ? ""
            : ` Focused on ${bodies.find((body) => body.id === departure.focused)?.name ?? departure.focused}.`;

    return `${gone} at this date.${focus}${departure.deselected ? " Selection cleared." : ""}`;
};

/** What a screen reader says when the camera starts or stops chasing `name`. */
export const chaseAnnouncement = (chasing: boolean, name: string): string =>
    chasing ? `Chasing ${name}.` : `Orbiting ${name}.`;

/** What a screen reader says when C can't chase `name`, which orbits nothing. */
export const noChaseAnnouncement = (name: string): string =>
    `${name} orbits nothing, so it can't be chased.`;

/** What a screen reader says when F1 hides or shows the interface. */
export const bareAnnouncement = (bare: boolean): string =>
    bare
        ? "Interface, labels and orbits hidden. F1 shows them."
        : "Interface shown.";

/**
 * What a screen reader says for a satellite change, or `null` when the scene's event says it.
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

/** What a screen reader says after undo or redo, with the `label` of the edit or `null` if there was none. */
export const historyAnnouncement = (
    kind: "undo" | "redo",
    label: string | null,
): string => {
    if (label === null) {
        return kind === "undo" ? "Nothing to undo." : "Nothing to redo.";
    }

    return kind === "undo" ? `Undid ${label}.` : `Redid ${label}.`;
};
