/**
 * <TabList>: selects a tab on click or arrow key, and shows its panel.
 *
 * Root: `.tab-list`, holding `[role=tablist]` with one `[role=tab]` per tab.
 * Each tab's `aria-controls` is the id of its panel, which can be anywhere in
 * the document. The root gets `data-ready`, which the CSS waits for before
 * it shows the tabs.
 * A change fires a bubbling `tabchange` event on the root, with the tab's
 * `data-value` in `detail.value`.
 */
import { behaviour } from "./behaviour.ts";

/** Where a key moves the selection to: the arrows wrap, Home and End jump. */
export const nextTabIndex = (
    key: string,
    index: number,
    count: number,
): number | undefined => {
    if (count <= 0) return undefined;

    switch (key) {
        case "ArrowLeft":
            return (index - 1 + count) % count;
        case "ArrowRight":
            return (index + 1) % count;
        case "Home":
            return 0;
        case "End":
            return count - 1;
        default:
            return undefined;
    }
};

const tabs = behaviour(".tab-list", (root, signal) => {
    const tabList = root.querySelector<HTMLElement>("[role=tablist]");
    if (!tabList) return;

    const all = [...tabList.querySelectorAll<HTMLElement>("[role=tab]")];
    const panelOf = (tab: HTMLElement) => {
        const id = tab.getAttribute("aria-controls");
        return id ? document.getElementById(id) : null;
    };

    const select = (index: number) => {
        const picked = all[index];
        if (!picked) return;

        for (const tab of all) {
            const selected = tab === picked;
            tab.setAttribute("aria-selected", String(selected));
            tab.tabIndex = selected ? 0 : -1;

            const panel = panelOf(tab);
            if (panel) panel.hidden = !selected;
        }
    };

    root.toggleAttribute("data-ready", true);

    const change = (index: number) => {
        const picked = all[index];
        if (!picked || picked.getAttribute("aria-selected") === "true") return;

        select(index);
        root.dispatchEvent(
            new CustomEvent("tabchange", {
                bubbles: true,
                detail: { value: picked.dataset.value },
            }),
        );
    };

    tabList.addEventListener(
        "click",
        (event) => {
            const tab = (event.target as Element).closest<HTMLElement>(
                "[role=tab]",
            );
            if (tab) change(all.indexOf(tab));
        },
        { signal },
    );

    tabList.addEventListener(
        "keydown",
        (event) => {
            const tab = (event.target as Element).closest<HTMLElement>(
                "[role=tab]",
            );
            if (!tab) return;

            const next = nextTabIndex(event.key, all.indexOf(tab), all.length);
            if (next === undefined) return;

            event.preventDefault();
            all[next]?.focus();
            change(next);
        },
        { signal },
    );

    return () => root.removeAttribute("data-ready");
});

export const initTabList = tabs.init;
export const initTabLists = tabs.initAll;
