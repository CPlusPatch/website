/**
 * Every style, in the order the Display menu lists them. A style is the
 * shape, motion and type (corners, borders, transitions, fonts), picked apart
 * from the theme, which is only colour, so any theme goes with any style.
 *
 * Each value other than the first needs a matching stylesheet in this folder,
 * imported by styles.css, which switches on while its option is checked.
 */
export const STYLES = [
    { value: "poster", label: "Poster" },
    { value: "soft", label: "Soft" },
    { value: "print", label: "Print" },
    { value: "mono", label: "Mono" },
];
