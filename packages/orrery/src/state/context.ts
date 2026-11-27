import { getContext, setContext } from "svelte";
import type { DocumentStore } from "./document.svelte.ts";
import type { ViewState } from "./view.svelte.ts";

const DOCUMENT = Symbol("orrery.document");
const VIEW = Symbol("orrery.view");
const ANNOUNCER = Symbol("orrery.announcer");

/** Gives the components below the current one these stores. */
export const setStores = (doc: DocumentStore, view: ViewState): void => {
    setContext(DOCUMENT, doc);
    setContext(VIEW, view);
};

/** Gives the components below the current one a function that says `text` to screen readers. */
export const setAnnouncer = (announce: (text: string) => void): void => {
    setContext(ANNOUNCER, announce);
};

const need = <T>(key: symbol, name: string): T => {
    const value = getContext<T | undefined>(key);
    if (value === undefined) {
        throw new Error(
            `No ${name} in context. Call setStores() or setAnnouncer() in a parent.`,
        );
    }

    return value;
};

/** The document store of the Orrery this component is mounted in. */
export const getDocument = (): DocumentStore =>
    need<DocumentStore>(DOCUMENT, "DocumentStore");

/** The view state of the Orrery this component is mounted in. */
export const getView = (): ViewState => need<ViewState>(VIEW, "ViewState");

/** Says a message to screen readers. */
export const getAnnouncer = (): ((text: string) => void) =>
    need<(text: string) => void>(ANNOUNCER, "announcer");
