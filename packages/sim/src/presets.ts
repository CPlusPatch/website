import type { Rotation } from "./rotation/index.ts";
import type { Body, Scenario } from "./scenario.ts";

/** What a preset fills in on a body that doesn't set it. */
export type Preset = { rotation?: Rotation };

/** The presets by name. */
export type Presets = Readonly<Record<string, Preset>>;

/** The body with its missing components filled from its preset. Fields on the body win. */
export const expandBody = (body: Body, presets: Presets): Body => {
    const preset = body.preset === undefined ? undefined : presets[body.preset];

    if (!preset?.rotation || body.rotation) {
        return body;
    }

    return { ...body, rotation: preset.rotation };
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
