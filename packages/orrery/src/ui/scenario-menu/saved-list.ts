import { j2000sToUnixMs } from "@cpluspatch/orbit";
import { type SavedScenario, startTime } from "../../persistence.ts";
import { h } from "../dom.ts";
import { button } from "./buttons.ts";

/** The meta line of a saved scenario, like "12 bodies · 2026-11-22". */
const meta = ({ savedAt, scenario }: SavedScenario): string => {
    const count = scenario.bodies.length;
    const date = new Date(j2000sToUnixMs(startTime(scenario, savedAt)))
        .toISOString()
        .slice(0, 10);

    return `${count} ${count === 1 ? "body" : "bodies"} · ${date}`;
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

            return h(
                "li",
                { class: "orrery__scenarios-row" },
                h(
                    "div",
                    {},
                    h("strong", {}, name),
                    h("small", {}, meta(entry)),
                ),
                button("Load", "outline", {
                    "data-action": "load",
                    "data-index": String(index),
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
