/**
 * @module
 * The validators of the appearance fields that layers read, and what they share.
 */

/** Checks one field of an `appearance` object, which is present. Pushes its errors. */
export type FieldValidator = (
    path: string,
    value: unknown,
    errors: string[],
) => void;

// Same pattern as sim's, which keeps its copy for the version 1 and 2 migration.
export const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// Same wording as sim's scenario errors.
export const show = (value: unknown): string => {
    if (typeof value === "number") {
        return String(value);
    }

    if (value === null) {
        return "null";
    }

    return typeof value === "string" ? JSON.stringify(value) : typeof value;
};

export const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const isNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

const checkMap = (path: string, value: unknown, errors: string[]): void => {
    if (typeof value !== "string") {
        errors.push(`${path}: must be a string (got ${show(value)})`);
    }
};

export const checkPositive = (
    path: string,
    value: unknown,
    errors: string[],
): void => {
    if (!isNumber(value) || value <= 0) {
        errors.push(`${path}: must be a number above 0 (got ${show(value)})`);
    }
};

const checkUnit = (path: string, value: unknown, errors: string[]): void => {
    if (!isNumber(value) || value < 0 || value > 1) {
        errors.push(
            `${path}: must be a number from 0 to 1 (got ${show(value)})`,
        );
    }
};

const checkHex = (path: string, value: unknown, errors: string[]): void => {
    if (typeof value !== "string") {
        errors.push(`${path}: must be a string (got ${show(value)})`);
    } else if (!HEX_COLOR.test(value)) {
        errors.push(
            `${path}: must be a #rgb or #rrggbb colour (got ${show(value)})`,
        );
    }
};

/** A validator for a field that's an object, which checks each of its own fields. */
export const objectOf =
    (name: string, checks: Record<string, FieldValidator>): FieldValidator =>
    (path, value, errors) => {
        if (!isObject(value)) {
            errors.push(
                `${path}.${name}: must be an object (got ${show(value)})`,
            );

            return;
        }

        for (const [key, check] of Object.entries(checks)) {
            check(`${path}.${name}.${key}`, value[key], errors);
        }
    };

export const validateMap: FieldValidator = (path, value, errors) =>
    checkMap(`${path}.map`, value, errors);

export const validateGlow: FieldValidator = (path, value, errors) => {
    if (typeof value !== "boolean") {
        errors.push(`${path}.glow: must be true or false (got ${show(value)})`);
    }
};

export const validateAtmosphere = objectOf("atmosphere", {
    top: checkPositive,
    day: checkHex,
    twilight: checkHex,
    rim: checkUnit,
    haze: checkUnit,
});

export const validateClouds = objectOf("clouds", { map: checkMap });

export const validateNightSide = objectOf("nightSide", { map: checkMap });

export const validateRings: FieldValidator = (path, value, errors) => {
    objectOf("rings", {
        map: checkMap,
        inner: checkPositive,
        outer: checkPositive,
    })(path, value, errors);

    if (
        isObject(value) &&
        isNumber(value.inner) &&
        isNumber(value.outer) &&
        value.inner > 0 &&
        value.outer <= value.inner
    ) {
        errors.push(
            `${path}.rings.outer: must be more than inner (got ${value.outer})`,
        );
    }
};
