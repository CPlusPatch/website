import { buttonClasses } from "@cpluspatch/ui/components/button.ts";

/** The classes of a small button in the dialog. */
export const classes = (
    variant: "solid" | "outline" | "ghost",
    className?: string,
): string =>
    buttonClasses({
        variant,
        tone: variant === "solid" ? "primary" : "neutral",
        size: "sm",
        class: className
            ? `orrery__small-button ${className}`
            : "orrery__small-button",
    }).join(" ");
