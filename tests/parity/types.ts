export type RenderedCase = {
    /** `<group>/<story>`, as in the gallery manifest. */
    name: string;
    astro: string;
    svelte: string;
    /** Why the case can't be compared, if it can't. */
    skip?: string;
};
