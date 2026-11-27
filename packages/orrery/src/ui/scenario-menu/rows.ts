import { dateText } from "@cpluspatch/render";
import type { Document, Scenario } from "@cpluspatch/sim";
import { type SavedScenario, startTime } from "../../persistence.ts";

/** A saved scenario with its position in the saved list. */
export type SavedRow = { entry: SavedScenario; index: number };

/** The body count of a scenario, like "12 bodies". */
export const bodyCount = ({ bodies }: Scenario): string =>
    `${bodies.length} ${bodies.length === 1 ? "body" : "bodies"}`;

/** The meta line of a saved scenario, like "12 bodies · 2026-11-22". */
export const savedMeta = ({ savedAt, doc }: SavedScenario): string =>
    `${bodyCount(doc.scenario)} · ${dateText(startTime(doc.scenario, savedAt))}`;

/** The saved scenarios, newest first, each with its index in `saved`. */
export const newestFirst = (saved: SavedScenario[]): SavedRow[] =>
    saved
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => b.entry.savedAt - a.entry.savedAt);

/** The saved list with `doc` added, its scenario called `name`. */
export const withSaved = (
    saved: SavedScenario[],
    doc: Document,
    name: string,
    savedAt: number,
): SavedScenario[] => [
    ...saved,
    { savedAt, doc: { ...doc, scenario: { ...doc.scenario, name } } },
];

/** The saved list without the entry at `index`. */
export const withoutSaved = (
    saved: SavedScenario[],
    index: number,
): SavedScenario[] => saved.filter((_, at) => at !== index);
