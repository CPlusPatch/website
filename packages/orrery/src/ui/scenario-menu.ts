import { solarSystem, unixMsToJ2000s } from "@cpluspatch/orbit";
import {
    encodeScenario,
    HASH_PREFIX,
    parseScenarioJson,
    startTime,
} from "../persistence.ts";
import type { World } from "../world.ts";
import { createBodyDialogs } from "./body-dialogs.ts";
import { h } from "./dom.ts";
import type { Notices } from "./notices.ts";

/** How long "Link copied." stays, in ms. */
const COPIED_MS = 4000;

/** The scenario as it is now, with the clock's time. */
const current = (world: World) => ({
    ...world.scenario,
    time: world.clock.t,
});

/** The file name for a scenario called `name`. */
const fileName = (name: string): string => {
    // Control characters and the ones most file systems refuse.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: that's the point
    const safe = name.replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "").trim();

    return `${safe || "scenario"}.orrery.json`;
};

const download = (filename: string, text: string): void => {
    const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
    );
    const link = h("a", { href: url, download: filename });

    // Firefox ignores a click on an anchor that isn't in the document.
    document.body.append(link);
    link.click();
    link.remove();
    // The download may not have started yet.
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * Wires the Scenario menu in `root` (the markup is in `src/pages/orbits.astro`).
 * Returns a function that unwires it.
 */
export const bindScenarioMenu = (
    root: HTMLElement,
    world: World,
    notices: Notices,
): (() => void) => {
    const menu = root.querySelector<HTMLElement>("#scenario");
    const file = root.querySelector<HTMLInputElement>("[data-orrery-file]");
    if (!menu || !file) return () => {};

    const abort = new AbortController();
    const { signal } = abort;
    const dialogs = createBodyDialogs(root, world);

    const removeItem = menu.querySelector<HTMLButtonElement>(
        '[data-orrery-action="remove-body"]',
    );
    // The root can't be removed.
    const updateRemove = () => {
        if (!removeItem) return;

        removeItem.disabled =
            world.selected === null ||
            world.scenario.bodies.find((body) => body.id === world.selected)
                ?.parent === null;
    };
    updateRemove();
    const off = world.on((event) => {
        if (event.type === "selection" || event.type === "scenario") {
            updateRemove();
        }
    });

    const reset = () => {
        world.load(solarSystem, unixMsToJ2000s(Date.now()));
    };

    const exportJson = () => {
        const scenario = current(world);

        download(fileName(scenario.name), JSON.stringify(scenario, null, 2));
    };

    const copyLink = async () => {
        const { origin, pathname, search } = location;
        const link = encodeScenario(current(world)).then(
            (payload) =>
                `${origin}${pathname}${search}${HASH_PREFIX}${payload}`,
        );

        try {
            // Safari only allows the write inside the click, so it gets the
            // pending text instead of waiting for it here.
            if (typeof ClipboardItem === "undefined") {
                await navigator.clipboard.writeText(await link);
            } else {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        "text/plain": link.then(
                            (text) => new Blob([text], { type: "text/plain" }),
                        ),
                    }),
                ]);
            }
            notices.show("success", "Link copied.", COPIED_MS);

            return;
        } catch (error) {
            console.warn("The Orrery couldn't copy the link.", error);
        }

        let url: string;
        try {
            url = await link;
        } catch {
            notices.show("destructive", "The link couldn't be made.");
            return;
        }

        const field = h("input", {
            type: "text",
            readonly: "",
            class: "field input",
            value: url,
            "aria-label": "Share link",
        });
        field.addEventListener("focus", () => field.select());

        notices.show("destructive", [
            h("p", {}, "The link couldn't be copied. Copy it by hand:"),
            field,
        ]);
    };

    const importFile = async () => {
        const [chosen] = file.files ?? [];
        if (!chosen) return;

        let text: string;
        try {
            text = await chosen.text();
        } catch {
            notices.show("destructive", "The file couldn't be read.");
            return;
        } finally {
            // So choosing the same file again still fires `change`.
            file.value = "";
        }

        const result = parseScenarioJson(text);
        if (!result.ok) {
            notices.show("destructive", [
                h("p", {}, "The file isn't a valid scenario:"),
                h(
                    "ul",
                    {},
                    ...result.errors.map((error) => h("li", {}, error)),
                ),
            ]);
            return;
        }

        world.load(result.scenario, startTime(result.scenario));
    };

    menu.addEventListener(
        "click",
        (event) => {
            const target =
                event.target instanceof Element ? event.target : null;
            const action = target?.closest<HTMLElement>("[data-orrery-action]")
                ?.dataset.orreryAction;
            if (!action) return;

            menu.hidePopover();

            if (action === "add-body") dialogs.openAdd();
            else if (action === "remove-body") dialogs.openRemove();
            else if (action === "reset") reset();
            else if (action === "import") file.click();
            else if (action === "export") exportJson();
            else if (action === "copy-link") void copyLink();
        },
        { signal },
    );
    file.addEventListener("change", () => void importFile(), { signal });

    return () => {
        abort.abort();
        off();
        dialogs.destroy();
    };
};
