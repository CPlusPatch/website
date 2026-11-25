import { dateText, h } from "@cpluspatch/render";
import type { Scenario } from "@cpluspatch/sim";
import { type SavedScenario, startTime } from "../../persistence.ts";
import { button } from "./buttons.ts";

/** The body count of a scenario, like "12 bodies". */
const bodyCount = ({ bodies }: Scenario): string =>
    `${bodies.length} ${bodies.length === 1 ? "body" : "bodies"}`;

/** The meta line of a saved scenario, like "12 bodies · 2026-11-22". */
const meta = ({ savedAt, scenario }: SavedScenario): string => {
    return `${bodyCount(scenario)} · ${dateText(startTime(scenario, savedAt))}`;
};

/** One row of a scenario list: its name, meta line and buttons. */
const row = (
    name: string,
    detail: string,
    ...buttons: HTMLButtonElement[]
): HTMLLIElement =>
    h(
        "li",
        { class: "orrery__scenarios-row" },
        h("div", {}, h("strong", {}, name), h("small", {}, detail)),
        ...buttons,
    );

/** Fills `list` with the built-in scenarios, in their order. */
export const renderBuiltIn = (
    list: HTMLElement,
    scenarios: readonly Scenario[],
): void => {
    const rows = scenarios.map((scenario, index) =>
        row(
            scenario.name,
            bodyCount(scenario),
            button("Load", "outline", {
                "data-action": "built-in",
                "data-index": String(index),
                "aria-label": `Load ${scenario.name}`,
            }),
        ),
    );

    list.replaceChildren(h("ul", { class: "orrery__scenarios-list" }, ...rows));
};

/** Fills `list` with the saved scenarios, newest first, or a note that there are none. */
export const renderSaved = (
    list: HTMLElement,
    saved: SavedScenario[],
): void => {
    if (saved.length === 0) {
        list.replaceChildren(
            h("p", { class: "orrery__scenarios-empty" }, "Nothing saved yet."),
        );

        return;
    }

    const rows = saved
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => b.entry.savedAt - a.entry.savedAt)
        .map(({ entry, index }) => {
            const { name } = entry.scenario;

            return row(
                name,
                meta(entry),
                button("Load", "outline", {
                    "data-action": "load",
                    "data-index": String(index),
                    "aria-label": `Load ${name}`,
                }),
                button(
                    "Delete",
                    "ghost",
                    {
                        "data-action": "delete",
                        "data-index": String(index),
                        "aria-label": `Delete ${name}`,
                    },
                    "orrery__scenarios-quiet orrery__orbit-quiet",
                ),
            );
        });

    list.replaceChildren(h("ul", { class: "orrery__scenarios-list" }, ...rows));
};
