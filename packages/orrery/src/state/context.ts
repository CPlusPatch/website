import { getContext } from "svelte";
import type { DocumentStore } from "./document.svelte.ts";
import type { ViewState } from "./view.svelte.ts";

const DOCUMENT = Symbol("orrery.document");
const VIEW = Symbol("orrery.view");

/** The context for `mount()` that gives components these stores. */
export const storeContext = (
    doc: DocumentStore,
    view: ViewState,
): Map<symbol, unknown> =>
    new Map<symbol, unknown>([
        [DOCUMENT, doc],
        [VIEW, view],
    ]);

const need = <T>(key: symbol, name: string): T => {
    const value = getContext<T | undefined>(key);
    if (value === undefined) {
        throw new Error(`No ${name} in context. Mount with storeContext().`);
    }

    return value;
};

/** The document store of the Orrery this component is mounted in. */
export const getDocument = (): DocumentStore =>
    need<DocumentStore>(DOCUMENT, "DocumentStore");

/** The view state of the Orrery this component is mounted in. */
export const getView = (): ViewState => need<ViewState>(VIEW, "ViewState");
