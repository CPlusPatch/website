import type { Body } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { cardClasses } from "@cpluspatch/ui/components/card.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";

/** The body list's element and how to remove it. */
export type BodyList = {
    element: HTMLElement;
    /**
     * Moves keyboard focus to the row of `id`. While the row is out of sight, it goes to the
     * list's summary, or to the button of the dropdown that holds the list.
     */
    focusRow: (id: string) => void;
    /** Drops the card's frame and keeps the list open and without a summary, for a dropdown. */
    embed: (embedded: boolean) => void;
    destroy: () => void;
};

type Row = { select: HTMLElement; check: HTMLElement; focus: HTMLElement };

/** A tree of the bodies, each with buttons to select and to focus it. */
export const createBodyList = (world: World): BodyList => {
    const rows = new Map<string, Row>();
    const children = new Map<string | null, Body[]>();
    for (const body of world.order) {
        children.set(body.parent, [...(children.get(body.parent) ?? []), body]);
    }

    const row = (body: Body): HTMLElement => {
        const check = h("span", { hidden: "" });
        check.innerHTML = iconSvg("check");

        const select = h(
            "button",
            {
                type: "button",
                class: buttonClasses({
                    variant: "ghost",
                    tone: "neutral",
                    size: "sm",
                }).join(" "),
            },
            body.name,
            check,
        );
        const focus = h(
            "button",
            {
                type: "button",
                class: buttonClasses({
                    variant: "ghost",
                    tone: "neutral",
                    size: "sm",
                }).join(" "),
                "aria-label": `Focus ${body.name}`,
            },
            "Focus",
        );
        // In the narrow layout the list is in a popover, which gets out of the way.
        const closePopover = () =>
            element.closest<HTMLElement>("[popover]")?.hidePopover();
        select.addEventListener("click", () => {
            world.select(world.selected === body.id ? null : body.id);
            closePopover();
        });
        focus.addEventListener("click", () => {
            world.focus(body.id);
            closePopover();
        });
        rows.set(body.id, { select, check, focus });

        return h(
            "li",
            {},
            h("div", { class: "orrery__row" }, select, focus),
            list(body.id),
        );
    };

    const list = (parent: string | null): Node => {
        const bodies = children.get(parent) ?? [];
        if (bodies.length === 0) return document.createDocumentFragment();

        return h(
            "ul",
            { class: "orrery__tree" },
            ...bodies.map((body) => row(body)),
        );
    };

    const chevron = h("span");
    chevron.innerHTML = iconSvg("chevron-down");
    const summary = h("summary", {}, "Bodies", chevron);
    const details = h("details", { open: "" }, summary, list(null));
    const element = h(
        "nav",
        {
            class: `${cardClasses().join(" ")} orrery__body-list`,
            "aria-label": "Bodies",
        },
        details,
    );

    const show = () => {
        for (const [id, { select, check, focus }] of rows) {
            const selected = world.selected === id;
            select.setAttribute("aria-pressed", String(selected));
            check.hidden = !selected;
            focus.setAttribute("aria-pressed", String(world.focused === id));
        }
    };
    show();

    const off = world.on((event) => {
        if (event.type === "selection" || event.type === "focus") show();
    });

    return {
        element,
        focusRow: (id) => {
            const target = rows.get(id)?.select;
            if (target?.checkVisibility()) {
                target.focus();
            } else if (summary.checkVisibility()) {
                summary.focus();
            } else {
                element
                    .closest(".dropdown")
                    ?.querySelector<HTMLElement>(".dropdown__trigger")
                    ?.focus();
            }
        },
        embed: (embedded) => {
            element.classList.toggle("orrery__body-list--embedded", embedded);
            if (embedded) details.open = true;
        },
        destroy: () => {
            off();
            element.remove();
        },
    };
};
