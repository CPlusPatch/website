import type { offsetText } from "@cpluspatch/render";

/** How far the clock is from now. */
export type LiveOffset = NonNullable<ReturnType<typeof offsetText>>;

/** The accessible name and description of the Go live button. */
export const goLiveName = (
    flag: boolean,
    offset: LiveOffset | null,
    phone: boolean,
): { label: string; description: string } => {
    // The name is the visible text, for voice control. The long form goes in the description.
    const text =
        offset && `${phone ? offset.short : offset.full} ${offset.word}`;
    const label = flag ? "Now, go live" : text ? `Go live, ${text}` : "Go live";
    const description = offset
        ? `The clock is ${offset.spoken} ${offset.word}`
        : "";

    return { label, description };
};
