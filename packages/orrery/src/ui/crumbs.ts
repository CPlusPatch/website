import type { Body } from "@cpluspatch/orbit";
import { colorOf } from "../view/theme.ts";
import type { World } from "../world.ts";
import { showBodyMarker } from "./body-marker.ts";
import { h } from "./dom.ts";

/** The crumbs' element and how to remove it. */
export type Crumbs = {
    element: HTMLElement;
    /** Ends the path with a followed satellite, or drops it with `null`. */
    setSatellite: (crumb: { name: string; onClick: () => void } | null) => void;
    destroy: () => void;
};

/** The bodies from the root down to the one with `id`. */
export const focusPath = (bodies: readonly Body[], id: string): Body[] => {
    const byId = new Map(bodies.map((body) => [body.id, body]));
    const path: Body[] = [];

    for (
        let body = byId.get(id);
        body && !path.includes(body);
        body = body.parent === null ? undefined : byId.get(body.parent)
    ) {
        path.unshift(body);
    }

    return path;
};

/** The path from the root to the focused body, as buttons that move the focus. */
export const createCrumbs = (world: World): Crumbs => {
    const list = h("ol", { class: "orrery__crumb-list" });
    const element = h(
        "nav",
        { class: "orrery__crumbs", "aria-label": "Focus" },
        list,
    );

    let shown = "";
    let satellite: { name: string; onClick: () => void } | null = null;

    // The id can't be a body's, so a body crumb never takes the satellite's place.
    const SATELLITE_ID = "sat";

    const satelliteItem = (name: string): HTMLElement => {
        const marker = h("span", {
            class: "orrery__crumb-marker orrery__crumb-marker--satellite",
        });
        const button = h(
            "button",
            {
                type: "button",
                class: "orrery__crumb",
                "data-id": SATELLITE_ID,
                "aria-current": "location",
            },
            marker,
            h("span", { class: "orrery__crumb-label" }, name),
        );

        return h("li", {}, button);
    };

    const render = () => {
        const path = focusPath(world.scenario.bodies, world.focused);
        const key = JSON.stringify([
            path.map((body, at) => [
                body.id,
                body.name,
                body.kind,
                body.role,
                colorOf(body, path[at - 1]),
            ]),
            satellite?.name ?? null,
        ]);
        if (key === shown) return;
        shown = key;

        // Replacing the buttons would drop focus to <body>.
        const active = document.activeElement;
        const had =
            active instanceof HTMLElement && list.contains(active)
                ? active.dataset.id
                : undefined;

        list.replaceChildren(
            ...path.map((body, at) => {
                const marker = h("span", { class: "orrery__crumb-marker" });
                showBodyMarker(marker, body, path[at - 1]);

                const button = h(
                    "button",
                    {
                        type: "button",
                        class: "orrery__crumb",
                        "data-id": body.id,
                    },
                    marker,
                    h("span", { class: "orrery__crumb-label" }, body.name),
                );
                if (body.id === world.focused && !satellite) {
                    button.setAttribute("aria-current", "location");
                }

                return h("li", {}, button);
            }),
            ...(satellite ? [satelliteItem(satellite.name)] : []),
        );

        if (had === undefined) return;
        const target =
            list.querySelector<HTMLElement>(`[data-id="${CSS.escape(had)}"]`) ??
            list.querySelector<HTMLElement>("[aria-current]");
        target?.focus();
    };

    const onClick = (event: Event) => {
        const id =
            event.target instanceof Element
                ? event.target.closest<HTMLElement>("button")?.dataset.id
                : undefined;
        if (id === SATELLITE_ID) satellite?.onClick();
        else if (id !== undefined) world.focus(id);
    };
    list.addEventListener("click", onClick);

    const off = world.on((event) => {
        if (
            event.type === "focus" ||
            event.type === "scenario" ||
            event.type === "bodies" ||
            event.type === "body"
        ) {
            render();
        }
    });
    render();

    return {
        element,
        setSatellite: (crumb) => {
            satellite = crumb;
            render();
        },
        destroy: () => {
            off();
            list.removeEventListener("click", onClick);
            element.remove();
        },
    };
};
