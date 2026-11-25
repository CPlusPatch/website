import type { Body, BodyKind, OrbitingBody, Scenario } from "@cpluspatch/orbit";
import { G, subtreeIds } from "@cpluspatch/orbit";
import { type AUnit, aMin, DEGREES, fieldError } from "./editing.ts";

/** What the Add body form collects, in the units it shows. */
export type NewBodyInput = {
    id: string;
    name: string;
    kind: BodyKind;
    parent: Body;
    radiusKm: number;
    massKg: number;
    aKm: number;
    e: number;
    iDeg: number;
};

/** A body id from `name`: lowercase letters, digits and hyphens, not in `taken`. */
export const slugId = (name: string, taken: ReadonlySet<string>): string => {
    const base =
        name
            .normalize("NFD")
            // Combining marks, so "é" becomes "e".
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "body";

    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

    return id;
};

/** The body for `input`, with its orbit set at time `t`. */
export const newBody = (input: NewBodyInput, t: number): OrbitingBody => ({
    id: input.id,
    name: input.name,
    kind: input.kind,
    parent: input.parent.id,
    mu: G * input.massKg,
    radius: input.radiusKm * 1000,
    elements: {
        a: input.aKm * 1000,
        e: input.e,
        i: input.iDeg / DEGREES,
        raan: 0,
        argp: 0,
        m0: 0,
        epoch: t,
    },
});

/** What removing body `id` takes with it, like `Moon goes with it.` or `Its 4 moons go with it.`, or `""` if it's alone. */
export const removalNote = (scenario: Scenario, id: string): string => {
    const below = subtreeIds(scenario, id)
        .slice(1)
        .flatMap((other) =>
            scenario.bodies.filter((body) => body.id === other),
        );
    const moons = below.every((body) => body.kind === "moon");

    if (below.length === 0) return "";
    if (below.length === 1) {
        return `${below[0]?.name} goes with it.`;
    }

    return `Its ${below.length} ${moons ? "moons" : "bodies"} go with it.`;
};

/** A field of the Add body form that can fail. */
export type AddField = "name" | "radius" | "mass" | "a" | "e" | "i";

/** What the Add body form holds. The semi-major axis is in metres, the rest as in `NewBodyInput`. */
export type AddInput = {
    name: string;
    parent: Body;
    radiusKm: number;
    massKg: number;
    aMetres: number;
    e: number;
    iDeg: number;
    /** The unit the limits of the semi-major axis are shown in. */
    unit: AUnit;
};

/** The message for each field of `input` that fails. Edit's `fieldError` words the orbit's. */
export const addErrors = (
    input: AddInput,
    scenario: Scenario,
): Partial<Record<AddField, string>> => {
    const errors: Partial<Record<AddField, string>> = {};
    const { parent } = input;
    const name = input.name.trim();

    if (name === "") {
        errors.name = "Enter a name.";
    } else {
        const taken = scenario.bodies.find(
            (body) => body.name.toLowerCase() === name.toLowerCase(),
        );
        if (taken) errors.name = `A body named ${taken.name} already exists.`;
    }

    if (!Number.isFinite(input.radiusKm)) errors.radius = "Enter a number.";
    else if (input.radiusKm <= 0) errors.radius = "Radius must be above 0 km.";

    if (!Number.isFinite(input.massKg)) errors.mass = "Enter a number.";
    else if (input.massKg <= 0) errors.mass = "Mass must be above 0 kg.";

    const a = fieldError("a", input.aMetres, {
        aMin: aMin(parent.radius),
        unit: input.unit,
    });
    const e = fieldError("e", input.e);
    const i = fieldError("i", input.iDeg / DEGREES);
    if (a !== null) errors.a = a;
    if (e !== null) errors.e = e;
    if (i !== null) errors.i = i;

    if (
        !errors.a &&
        !errors.e &&
        input.aMetres * (1 - input.e) <= parent.radius
    ) {
        errors.e = `Periapsis would be inside ${parent.name}.`;
    }

    return errors;
};
