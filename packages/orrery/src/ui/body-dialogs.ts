import type { BodyKind } from "@cpluspatch/orbit";
import { iconSvg } from "@cpluspatch/ui";
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { dialogClasses } from "@cpluspatch/ui/components/dialog.ts";
import { newBody, slugId, subtreeIds } from "../adding.ts";
import { aMin } from "../editing.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";

/** The Add body and Remove dialogs and how to open them. */
export type BodyDialogs = {
    openAdd: () => void;
    /** Does nothing unless a body other than the root is selected. */
    openRemove: () => void;
    destroy: () => void;
};

// Lucide's trash-2 (ISC); @cpluspatch/ui only ships the icons its components draw.
const TRASH =
    '<svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" data-icon="lucide:trash-2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 11v6m4-6v6m5-11v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

const KINDS: [BodyKind, string][] = [
    ["planet", "Planet"],
    ["dwarf", "Dwarf planet"],
    ["moon", "Moon"],
    ["spacecraft", "Spacecraft"],
];

/** A new body's semi-major axis in km around a parent of `radius` metres. */
const defaultA = (radius: number): string =>
    String(Number(((3 * radius) / 1000).toPrecision(6)));

const dialog = (
    id: string,
    size: "sm" | "md",
    title: string,
    ...form: HTMLElement[]
): { element: HTMLDialogElement; title: HTMLElement; close: HTMLElement } => {
    const heading = h(
        "h2",
        { class: "dialog__title", id: `${id}-title` },
        title,
    );
    const close = h("button", {
        type: "button",
        class: buttonClasses({
            variant: "ghost",
            tone: "neutral",
            size: "icon",
            class: "dialog__close",
        }).join(" "),
        "aria-label": "Close",
    });
    close.innerHTML = iconSvg("x");

    const element = h(
        "dialog",
        {
            id,
            class: dialogClasses({ size }).join(" "),
            "aria-labelledby": `${id}-title`,
        },
        h("div", { class: "dialog__header" }, heading, close),
        h("form", { method: "dialog", class: "dialog__form" }, ...form),
    );

    return { element, title: heading, close };
};

const cancelButton = (): HTMLButtonElement =>
    h(
        "button",
        {
            type: "button",
            class: buttonClasses({ variant: "outline", tone: "neutral" }).join(
                " ",
            ),
        },
        "Cancel",
    );

/** Builds the Add body and Remove dialogs in `root`. */
export const createBodyDialogs = (
    root: HTMLElement,
    world: World,
): BodyDialogs => {
    const abort = new AbortController();
    const { signal } = abort;

    const control = (
        name: string,
        label: string,
        attributes: Record<string, string>,
        wide = false,
    ) => {
        const input = h("input", {
            id: `orrery-add-${name}`,
            class: "field input",
            ...attributes,
        });

        return {
            input,
            row: h(
                "div",
                { class: `orrery__field${wide ? " orrery__field--wide" : ""}` },
                h("label", { for: input.id }, label),
                input,
            ),
        };
    };
    const choice = (name: string, label: string) => {
        const select = h("select", {
            id: `orrery-add-${name}`,
            class: "select",
        });

        return {
            select,
            row: h(
                "div",
                { class: "orrery__field" },
                h("label", { for: select.id }, label),
                select,
            ),
        };
    };
    const number = (name: string, label: string, min: string, max?: string) =>
        control(name, label, {
            type: "number",
            step: "any",
            min,
            ...(max === undefined ? {} : { max }),
            required: "",
        });

    const name = control(
        "name",
        "Name",
        { type: "text", required: "", autofocus: "", autocomplete: "off" },
        true,
    );
    const kind = choice("kind", "Kind");
    const parent = choice("parent", "Parent");
    const radius = number("radius", "Radius (km)", "0.001");
    const mass = number("mass", "Mass (kg)", "0");
    const a = number("a", "Semi-major axis (km)", "0");
    const e = number("e", "Eccentricity", "0", "0.9999");
    const inclination = number("i", "Inclination (°)", "0", "180");

    for (const [value, label] of KINDS) {
        kind.select.append(h("option", { value }, label));
    }

    const errorText = h("span");
    const error = h(
        "div",
        {
            class: `${alertClasses({ variant: "destructive" }).join(" ")} orrery__form-error`,
            role: "alert",
        },
        h(
            "div",
            { class: "content" },
            h(
                "span",
                { class: "visually-hidden" },
                alertPrefix("destructive") ?? "",
            ),
            " ",
            errorText,
        ),
    );
    error.hidden = true;

    const addCancel = cancelButton();
    const add = dialog(
        "orrery-add-body",
        "md",
        "Add body",
        h(
            "div",
            { class: "dialog__body" },
            h(
                "div",
                { class: "orrery__form-grid" },
                name.row,
                kind.row,
                parent.row,
                radius.row,
                mass.row,
                a.row,
                e.row,
                inclination.row,
            ),
            error,
        ),
        h(
            "div",
            { class: "dialog__footer" },
            addCancel,
            h(
                "button",
                { type: "submit", class: buttonClasses().join(" ") },
                "Add body",
            ),
        ),
    );

    const removeText = h("p");
    const removeCancel = cancelButton();
    removeCancel.setAttribute("autofocus", "");
    const confirm = h(
        "button",
        {
            type: "submit",
            class: buttonClasses({ tone: "destructive" }).join(" "),
        },
        "Remove",
    );
    confirm.insertAdjacentHTML("afterbegin", TRASH);
    const remove = dialog(
        "orrery-remove-body",
        "sm",
        "Remove body?",
        h("div", { class: "dialog__body" }, removeText),
        h("div", { class: "dialog__footer" }, removeCancel, confirm),
    );

    root.append(add.element, remove.element);

    // Once the user types an a, a new parent no longer changes it.
    let aTouched = false;
    let removing: string | null = null;

    const radiusOf = (id: string): number =>
        world.scenario.bodies.find((body) => body.id === id)?.radius ?? 0;

    // The form refuses an orbit inside the parent, so the world's error rarely shows.
    const setParent = (id: string) => {
        const r = radiusOf(id);

        a.input.min = String(aMin(r) / 1000);
        if (!aTouched) a.input.value = defaultA(r);
    };

    a.input.addEventListener("input", () => (aTouched = true), { signal });
    parent.select.addEventListener(
        "change",
        () => setParent(parent.select.value),
        { signal },
    );

    const submitAdd = () => {
        const owner = world.scenario.bodies.find(
            (body) => body.id === parent.select.value,
        );
        if (!owner) return;

        const body = newBody(
            {
                id: slugId(
                    name.input.value.trim(),
                    new Set(world.scenario.bodies.map(({ id }) => id)),
                ),
                name: name.input.value.trim(),
                kind:
                    KINDS.find(([value]) => value === kind.select.value)?.[0] ??
                    "moon",
                parent: owner,
                radiusKm: radius.input.valueAsNumber,
                massKg: mass.input.valueAsNumber,
                aKm: a.input.valueAsNumber,
                e: e.input.valueAsNumber,
                iDeg: inclination.input.valueAsNumber,
            },
            world.clock.t,
        );

        try {
            world.addBody(body);
        } catch (failure) {
            errorText.textContent =
                failure instanceof Error ? failure.message : String(failure);
            error.hidden = false;
            return;
        }

        add.element.close();
        world.select(body.id);
    };

    add.element.addEventListener(
        "submit",
        (event) => {
            event.preventDefault();
            submitAdd();
        },
        { signal },
    );
    remove.element.addEventListener(
        "submit",
        (event) => {
            event.preventDefault();
            // A hash link or Import may have replaced the scenario since it opened.
            const id = removing;
            if (id !== null && world.scenario.bodies.some((b) => b.id === id)) {
                world.removeBody(id);
            }
            removing = null;
            remove.element.close();
        },
        { signal },
    );
    for (const [dialogParts, cancel] of [
        [add, addCancel],
        [remove, removeCancel],
    ] as const) {
        const close = () => dialogParts.element.close();

        dialogParts.close.addEventListener("click", close, { signal });
        cancel.addEventListener("click", close, { signal });
    }

    const openAdd = () => {
        const initial = world.selected ?? world.focused;

        parent.select.replaceChildren(
            ...world.order.map((body) =>
                h("option", { value: body.id }, body.name),
            ),
        );
        parent.select.value = initial;
        name.input.value = "";
        kind.select.value = "moon";
        radius.input.value = "100";
        mass.input.value = "0";
        aTouched = false;
        setParent(initial);
        e.input.value = "0";
        inclination.input.value = "0";
        error.hidden = true;

        add.element.showModal();
    };

    const openRemove = () => {
        const body = world.scenario.bodies.find(
            (candidate) => candidate.id === world.selected,
        );
        if (!body || body.parent === null) return;

        const others = subtreeIds(world.scenario, body.id).length - 1;
        const text = "This can't be undone.";

        removing = body.id;
        remove.title.textContent = `Remove ${body.name}?`;
        removeText.textContent =
            others === 0
                ? text
                : `This also removes ${others} ${others === 1 ? "body" : "bodies"} that orbit it. ${text}`;

        remove.element.showModal();
    };

    return {
        openAdd,
        openRemove,
        destroy: () => {
            abort.abort();
            add.element.remove();
            remove.element.remove();
        },
    };
};
