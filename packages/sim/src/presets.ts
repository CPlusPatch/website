import type { Rotation } from "./rotation/index.ts";
import type { Body, Gravity, Scenario } from "./scenario.ts";

/** What a preset fills in on a body that doesn't set it. */
export type Preset = {
    rotation?: Rotation;
    gravity?: Gravity;
    /** Opaque to sim, like `Body.appearance`. Merged into the body's by key. */
    appearance?: unknown;
};

/** The presets by name. */
export type Presets = Readonly<Record<string, Preset>>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/** The appearance to set on the body, or `undefined` when the body's own stays as it is. */
const fillAppearance = (own: unknown, fromPreset: unknown): unknown => {
    if (fromPreset === undefined) return undefined;
    if (own === undefined) return fromPreset;

    return isPlainObject(own) && isPlainObject(fromPreset)
        ? { ...fromPreset, ...own }
        : undefined;
};

/** The body with its missing components filled from its preset. Fields on the body win, and appearance merges by key. */
export const expandBody = (body: Body, presets: Presets): Body => {
    const preset = body.preset === undefined ? undefined : presets[body.preset];

    const rotation = body.rotation ? undefined : preset?.rotation;
    const gravity = body.gravity ? undefined : preset?.gravity;

    const appearance = fillAppearance(body.appearance, preset?.appearance);

    if (!rotation && !gravity && appearance === undefined) {
        return body;
    }

    return {
        ...body,
        ...(rotation ? { rotation } : {}),
        ...(gravity ? { gravity } : {}),
        ...(appearance === undefined ? {} : { appearance }),
    };
};

/** The scenario with each body's missing components filled from its preset. Fields on the body win. */
export const expandPresets = (
    scenario: Scenario,
    presets: Presets,
): Scenario => {
    const bodies = scenario.bodies.map((body) => expandBody(body, presets));

    return bodies.every((body, i) => body === scenario.bodies[i])
        ? scenario
        : { ...scenario, bodies };
};
