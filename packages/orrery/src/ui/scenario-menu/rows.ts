import { dateText } from "@cpluspatch/render";
import type { Scenario } from "@cpluspatch/sim";
import { type SavedScenario, startTime } from "../../persistence.ts";

/** The body count of a scenario, like "12 bodies". */
export const bodyCount = ({ bodies }: Scenario): string =>
    `${bodies.length} ${bodies.length === 1 ? "body" : "bodies"}`;

/** The meta line of a saved scenario, like "12 bodies · 2026-11-22". */
export const savedMeta = ({ savedAt, scenario }: SavedScenario): string =>
    `${bodyCount(scenario)} · ${dateText(startTime(scenario, savedAt))}`;
