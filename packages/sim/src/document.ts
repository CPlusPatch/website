import type { Burn, Elements } from "@cpluspatch/orbit";
import type { Scenario } from "./scenario.ts";

/**
 * A change to a body's orbit at time `t`, with `id` unique in the timeline. A body's orbit is its
 * scenario orbit until its first event, then the result of each event in time order.
 */
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
