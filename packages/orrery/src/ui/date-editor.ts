import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import {
    type DateParts,
    fromParts,
    PART_NAMES,
    type PartName,
    parsePasted,
    partsProblem,
    stepPart,
    toParts,
} from "../date-parts.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";

/** The date editor's element and how to drive it. */
export type DateEditor = {
    element: HTMLElement;
    /** Opens the editor, or closes it if it's open. */
    toggle: () => void;
    destroy: () => void;
};

/** What each part is called, and how many digits it takes. */
const SEGMENTS: Record<PartName, { label: string; digits: number }> = {
    y: { label: "Year", digits: 4 },
    mo: { label: "Month", digits: 2 },
    d: { label: "Day", digits: 2 },
    h: { label: "Hour", digits: 2 },
    mi: { label: "Minute", digits: 2 },
    s: { label: "Second", digits: 2 },
};

/** Keys that move on to the next part, as they do when typing a date. */
const NEXT_KEYS = ["-", ":", " ", "/"];

const J2000_TEXT = "2000-01-01 12:00";

/** A panel that sets the clock's date, and the clock holds while it's open. `opener` is the button that toggles it. */
export const createDateEditor = (
    world: World,
    opener: HTMLButtonElement,
): DateEditor => {
    const { clock } = world;

    const segments = {} as Record<PartName, HTMLInputElement>;
    for (const name of PART_NAMES) {
        const { label, digits } = SEGMENTS[name];
        segments[name] = h("input", {
            class: "orrery__date-part",
            "data-part": name,
            "aria-label": label,
            inputmode: "numeric",
            maxlength: String(digits),
            autocomplete: "off",
        });
    }

    const separator = (text: string) =>
        h("span", { class: "orrery__date-sep", "aria-hidden": "true" }, text);

    const error = h("p", {
        class: "orrery__stepper-error",
        id: "orrery-date-error",
    });
    error.hidden = true;

    const entry = h(
        "div",
        {
            class: "orrery__date-entry",
            role: "group",
            "aria-label": "Date and time, UTC",
            "aria-describedby": "orrery-date-error",
        },
        segments.y,
        separator("-"),
        segments.mo,
        separator("-"),
        segments.d,
        h("span", { class: "orrery__date-gap", "aria-hidden": "true" }),
        segments.h,
        separator(":"),
        segments.mi,
        separator(":"),
        segments.s,
        h("span", { class: "orrery__date-utc" }, "UTC"),
    );

    const outline = buttonClasses({
        variant: "outline",
        tone: "neutral",
        size: "sm",
    }).join(" ");
    const preset = (...children: (Node | string)[]) =>
        h("button", { type: "button", class: outline }, ...children);

    const now = preset("Now");
    const j2000 = preset(
        "J2000",
        h("small", { class: "orrery__date-iso" }, J2000_TEXT),
    );
    const reset = preset("Reset");

    const cancel = h(
        "button",
        {
            type: "button",
            class: buttonClasses({ variant: "outline", tone: "neutral" }).join(
                " ",
            ),
        },
        "Cancel",
    );
    const submit = h(
        "button",
        { type: "submit", class: buttonClasses().join(" ") },
        "Go to date",
    );

    const closeButton = h("button", {
        type: "button",
        class: buttonClasses({
            variant: "ghost",
            tone: "neutral",
            size: "icon-sm",
        }).join(" "),
        "aria-label": "Close",
    });
    closeButton.innerHTML = iconSvg("x");

    const form = h(
        "form",
        { class: "orrery__date-form", novalidate: "" },
        entry,
        error,
        h(
            "p",
            { class: "orrery__date-hint" },
            "Arrow keys step the part you're in.",
        ),
        h(
            "div",
            {
                class: "orrery__date-presets",
                role: "group",
                "aria-label": "Presets",
            },
            now,
            j2000,
            reset,
        ),
        h("div", { class: "orrery__date-actions" }, cancel, submit),
    );

    const element = h(
        "section",
        {
            id: "orrery-date-editor",
            class: "orrery__date-editor",
            "aria-labelledby": "orrery-date-title",
        },
        h(
            "div",
            { class: "orrery__inspector-head" },
            h(
                "h2",
                { class: "orrery__orbit-title", id: "orrery-date-title" },
                "Set the date",
            ),
            closeButton,
        ),
        form,
    );
    element.hidden = true;

    const fill = (parts: DateParts) => {
        for (const name of PART_NAMES) {
            const input = segments[name];
            const text = String(parts[name]);

            input.value =
                parts[name] >= 0
                    ? text.padStart(SEGMENTS[name].digits, "0")
                    : text;
            input.removeAttribute("aria-invalid");
        }
        error.hidden = true;
    };

    const read = (): DateParts => {
        const number = (name: PartName) =>
            /^\d+$/.test(segments[name].value)
                ? Number(segments[name].value)
                : Number.NaN;

        return {
            y: number("y"),
            mo: number("mo"),
            d: number("d"),
            h: number("h"),
            mi: number("mi"),
            s: number("s"),
        };
    };

    // The clock holds while the editor is open. `touched` means the user ran or held it since.
    let openedT = 0;
    let savedPaused = false;
    let touched = false;

    const open = () => {
        openedT = clock.t;
        fill(toParts(clock.t));
        savedPaused = clock.paused;
        touched = false;
        element.hidden = false;
        opener.setAttribute("aria-expanded", "true");
        if (!clock.paused) world.setClock({ paused: true });
        segments.d.focus();
    };

    const close = () => {
        if (element.hidden) return;

        // Hiding the editor would drop focus to <body>.
        const held = element.contains(document.activeElement);
        element.hidden = true;
        opener.setAttribute("aria-expanded", "false");
        if (!touched && clock.paused !== savedPaused) {
            world.setClock({ paused: savedPaused });
        }
        if (held) opener.focus();
    };

    const toggle = () => (element.hidden ? open() : close());

    const step = (name: PartName, by: number) => {
        const next = stepPart(read(), name, by);
        if (!next) return;

        fill(next);
        segments[name].select();
    };

    PART_NAMES.forEach((name, i) => {
        const input = segments[name];
        const before = segments[PART_NAMES[i - 1] ?? name];
        const after = segments[PART_NAMES[i + 1] ?? name];
        const first = i === 0;
        const last = i === PART_NAMES.length - 1;

        input.addEventListener("focus", () => input.select());
        input.addEventListener("keydown", (event) => {
            // Ctrl+- zooms the page out.
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                step(name, event.key === "ArrowUp" ? 1 : -1);
            } else if (
                event.key === "ArrowLeft" &&
                input.selectionStart === 0 &&
                !first
            ) {
                event.preventDefault();
                before.focus();
            } else if (
                event.key === "ArrowRight" &&
                input.selectionEnd === input.value.length &&
                !last
            ) {
                event.preventDefault();
                after.focus();
            } else if (
                event.key === "Backspace" &&
                input.value === "" &&
                !first
            ) {
                event.preventDefault();
                before.focus();
            } else if (NEXT_KEYS.includes(event.key) && !last) {
                event.preventDefault();
                after.focus();
            }
        });
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "");
            input.removeAttribute("aria-invalid");
            error.hidden = true;
            if (input.value.length === input.maxLength && !last) after.focus();
        });
        input.addEventListener("paste", (event) => {
            const parts = parsePasted(
                event.clipboardData?.getData("text") ?? "",
            );
            if (!parts) return;

            event.preventDefault();
            fill(parts);
        });
    });

    now.addEventListener("click", () =>
        fill(toParts(unixMsToJ2000s(Date.now()))),
    );
    j2000.addEventListener("click", () => fill(toParts(0)));
    reset.addEventListener("click", () => fill(toParts(openedT)));

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const parts = read();
        const problem = partsProblem(parts);
        if (problem) {
            const input = segments[problem.part];
            input.setAttribute("aria-invalid", "true");
            error.textContent = problem.message;
            error.hidden = false;
            input.focus();

            return;
        }

        world.setClock({ t: fromParts(parts) });
        close();
    });

    element.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        // The shortcut that clears the selection would also run.
        event.stopPropagation();
        close();
    });
    cancel.addEventListener("click", close);
    closeButton.addEventListener("click", close);

    const off = world.on((event) => {
        if (element.hidden) return;

        if (event.type === "scenario") close();
        else if (event.type === "clock" && !clock.paused) touched = true;
    });

    return {
        element,
        toggle,
        destroy: () => {
            off();
            close();
            element.remove();
        },
    };
};
