import { AU } from "@cpluspatch/orbit";
import { type AUnit, styleOf, TAG_STYLES, toMetres } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";

/** The longest name the Name field takes. */
export const NAME_MAX = 40;

/** The select's options: the tags the table offers, as a value and a label. */
export const KINDS: [string, string][] = Object.entries(TAG_STYLES)
    .filter(([, style]) => style.adder)
    .map(([tag, style]) => [tag, style.label]);

/** The kind in the options that `value` names. Throws for an unknown one. */
export const kindOf = (value: string): string => {
    const found = KINDS.find(([kind]) => kind === value);
    if (!found)
        throw new Error(`The Kind select holds an unknown kind, ${value}.`);

    return found[0];
};

/** Whether other bodies can orbit `body` in the form. Asteroids can, like Didymos. */
export const canParent = (body: Body): boolean => styleOf(body).canParent;

/** A new body's kind around `parent`: a planet around the root, else a moon. */
export const defaultKind = (parent: Body): string =>
    parent.orbit === undefined ? "planet" : "moon";

/** A new body's semi-major axis around `parent`, in metres. */
export const defaultA = (parent: Body): number =>
    parent.orbit === undefined ? AU : parent.mass.radius * 10;

/** `value` a power of ten up (`sign` 1) or down (`-1`), without float noise like 1.0000000000000001e+21. */
export const moveMass = (value: number, sign: 1 | -1): number =>
    Number((sign === 1 ? value * 10 : value / 10).toPrecision(12));

/** The text of `x` in a field, without float noise. */
export const text = (x: number): string => String(Number(x.toPrecision(10)));

/** The exact size of a semi-major axis that was set from `metres`, as the text it showed. */
export type ExactA = { metres: number; text: string };

/** The semi-major axis in metres of a field that holds `value`, or `exact` if it's unchanged. */
export const typedMetres = (
    value: string,
    valueAsNumber: number,
    unit: AUnit,
    exact: ExactA | null,
): number =>
    exact?.text === value ? exact.metres : toMetres(valueAsNumber, unit);
