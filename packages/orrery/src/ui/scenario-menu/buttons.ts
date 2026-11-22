import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { h } from "../dom.ts";

/** A small button of the dialog. */
export const button = (
    label: string,
    variant: "solid" | "outline" | "ghost",
    attributes: Record<string, string> = {},
    className?: string,
): HTMLButtonElement =>
    h(
        "button",
        {
            type: "button",
            class: buttonClasses({
                variant,
                tone: variant === "solid" ? "primary" : "neutral",
                size: "sm",
                class: className
                    ? `orrery__small-button ${className}`
                    : "orrery__small-button",
            }).join(" "),
            ...attributes,
        },
        label,
    );

/** A button that asks to be pressed twice, and what to put back when it's disarmed. */
type Armed = { button: HTMLButtonElement; label: string; aria: string | null };

/** The press-twice state of the dialog's buttons. */
export type Arming = {
    /** Turns `target` into a Confirm button and shows `message`. */
    arm: (
        target: HTMLButtonElement,
        message: string,
        aria?: string | null,
    ) => void;
    /** Puts the armed button back as it was, if there is one. */
    disarm: () => void;
    /** The button waiting for its second press. */
    armed: () => HTMLButtonElement | null;
};

/** Arms and disarms buttons, reporting through `setStatus`. */
export const createArming = (
    setStatus: (...content: (Node | string)[]) => void,
): Arming => {
    let armed: Armed | null = null;

    const arm = (
        target: HTMLButtonElement,
        message: string,
        aria: string | null = null,
    ) => {
        armed = {
            button: target,
            label: target.textContent ?? "",
            aria: target.getAttribute("aria-label"),
        };
        target.textContent = "Confirm";
        if (aria !== null) target.setAttribute("aria-label", aria);
        setStatus(message);
    };

    const disarm = () => {
        if (!armed) return;

        armed.button.textContent = armed.label;
        if (armed.aria !== null) {
            armed.button.setAttribute("aria-label", armed.aria);
        }
        armed = null;
    };

    return { arm, disarm, armed: () => armed?.button ?? null };
};
