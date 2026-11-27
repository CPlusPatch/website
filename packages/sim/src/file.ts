import { type DocumentResult, withTimeline } from "./commands.ts";
import type { Document, TimelineEvent } from "./document.ts";
import {
    type Scenario,
    type ValidateOptions,
    validateScenario,
} from "./scenario.ts";

/** The object to write for `doc`: its scenario, plus `timeline` when there are events. */
export const documentFile = (
    doc: Document,
): Scenario & { timeline?: TimelineEvent[] } =>
    doc.timeline.length > 0
        ? { ...doc.scenario, timeline: doc.timeline }
        : doc.scenario;

/** Checks `input` as a saved file: a scenario with an optional `timeline`. A missing one means no events. */
export const validateDocument = (
    input: unknown,
    options: ValidateOptions,
): DocumentResult => {
    const result = validateScenario(input, options);
    if (!result.ok) return result;

    const { timeline = [] } = input as { timeline?: unknown };

    return withTimeline(result.scenario, timeline, options.presets ?? {});
};
