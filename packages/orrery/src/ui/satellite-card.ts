import {
    formatAngle,
    formatDistance,
    formatDuration,
    h,
    setText,
    type View,
} from "@cpluspatch/render";
import type { SatelliteFacts } from "@cpluspatch/sim";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import { SNAPSHOT_DATE } from "../catalogue-snapshot.ts";
import { FOCUS_ICON, iconButton } from "./inspector/actions.ts";
import { LABELS } from "./satellite-menu.ts";

/** The satellite card's element and how to remove it. */
export type SatelliteCard = {
    element: HTMLElement;
    destroy: () => void;
};

/** How often the altitude refreshes while the card is shown, in ms. */
const REFRESH_MS = 250;

const CLASS_NAMES: Record<SatelliteFacts["orbitClass"], string> = {
    leo: "low Earth orbit",
    meo: "medium Earth orbit",
    geo: "geosynchronous orbit",
    heo: "highly elliptical orbit",
};

const km = (value: number): string => formatDistance(value * 1000, "km");

/** The card for the selected catalogue satellite. `restoreFocus` runs before it hides with focus in it. */
export const createSatelliteCard = (
    satellite: View["satellite"],
    restoreFocus: () => void,
): SatelliteCard => {
    const close = h("button", {
        type: "button",
        class: buttonClasses({
            variant: "ghost",
            tone: "neutral",
            size: "icon-sm",
        }).join(" "),
        "aria-label": "Clear selection",
    });
    close.innerHTML = iconSvg("x");
    close.addEventListener("click", () => satellite.select(null));

    const marker = h("span", {
        class: "orrery__orbit-marker orrery__satellite-ring",
    });
    const title = h("h2", { class: "orrery__orbit-title" });
    const content = h("div", { class: "orrery__inspector-body" });
    const element = h(
        "section",
        {
            class: `${cardClasses().join(" ")} orrery__inspector orrery__satellite-card`,
            "aria-label": "Selected satellite",
        },
        h("div", { class: "orrery__inspector-head" }, marker, title, close),
        content,
    );
    element.hidden = true;

    let shown: number | null = null;
    let altitude: HTMLElement | null = null;
    let focusButton: HTMLButtonElement | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;

    const syncFocus = () => {
        if (!focusButton) return;

        const on = shown !== null && satellite.focused() === shown;
        focusButton.setAttribute("aria-pressed", String(on));
        const label = focusButton.querySelector(".orrery__orbit-button-label");
        if (label) setText(label, on ? "Focused" : "Focus");
    };

    const render = () => {
        const k = satellite.selected();
        const facts = k === null ? null : satellite.facts(k);
        const hadFocus = element.contains(document.activeElement);

        altitude = null;
        focusButton = null;
        content.replaceChildren();

        if (k === null || !facts) {
            // Hiding the focused close button would drop focus to <body>.
            if (hadFocus) restoreFocus();
            shown = null;
            element.hidden = true;
            clearInterval(timer);
            timer = undefined;

            return;
        }

        shown = k;
        element.hidden = false;
        timer ??= setInterval(refresh, REFRESH_MS);
        title.textContent = facts.name;

        const list = h("dl", { class: "orrery__readouts" });
        const row = (label: string, value: string): HTMLElement => {
            const dd = h("dd", { class: "orrery__readout" }, value);
            list.append(h("dt", {}, label), dd);

            return dd;
        };
        altitude = row("Altitude", km(facts.altitudeKm));
        row("Perigee", km(facts.perigeeKm));
        row("Apogee", km(facts.apogeeKm));
        row("Period", formatDuration(facts.periodS));
        row("Inclination", formatAngle(facts.inclination));

        focusButton = iconButton(
            "Focus",
            "orrery__orbit-button orrery__orbit-focus",
            FOCUS_ICON,
            () => satellite.focus(k),
        );
        content.append(
            h(
                "p",
                { class: "orrery__orbit-meta" },
                `${LABELS[facts.group]}, ${CLASS_NAMES[facts.orbitClass]}`,
            ),
            list,
            h(
                "p",
                { class: "orrery__satellite-source" },
                `Orbits from CelesTrak, ${SNAPSHOT_DATE}.`,
            ),
            h(
                "div",
                { class: "orrery__orbit-actions" },
                h("div", { class: "orrery__orbit-buttons" }, focusButton),
            ),
        );
        syncFocus();

        // The card re-rendered under the focus, so the next thing to do with it gets it.
        if (hadFocus && !element.contains(document.activeElement)) {
            focusButton.focus();
        }
    };

    const refresh = () => {
        if (shown === null || !altitude) return;

        const facts = satellite.facts(shown);
        // The view clears the selection of a satellite that's gone.
        if (!facts) return;

        setText(altitude, km(facts.altitudeKm));
    };

    render();

    const off = satellite.on((event) => {
        if (event.type === "selection") render();
        else syncFocus();
    });

    return {
        element,
        destroy: () => {
            off();
            clearInterval(timer);
            element.remove();
        },
    };
};
