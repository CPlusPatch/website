import type { Burn } from "./burn.ts";
import type { Elements } from "./kepler.ts";
import type { Scenario } from "./scenario.ts";

/** A change to a body's orbit at time `t`. Always empty in a `Document` until timeline events land. */
export type TimelineEvent =
    | { type: "burn"; id: string; bodyId: string; t: number; dv: Burn }
    | {
          type: "set-orbit";
          id: string;
          bodyId: string;
          t: number;
          elements: Elements;
      };

/** What the editor edits: a scenario and the events that change it over time. */
export type Document = {
    scenario: Scenario;
    timeline: TimelineEvent[];
};

/** A document with `scenario` and no events. */
export const documentOf = (scenario: Scenario): Document => ({
    scenario,
    timeline: [],
});
