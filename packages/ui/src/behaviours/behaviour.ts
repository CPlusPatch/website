/**
 * What every behaviour is built from. A behaviour binds the script half of
 * a component to markup that already exists, whoever rendered it, and
 * undoes itself on request:
 *
 *     const { init, initAll } = behaviour(".carousel", (root, signal) => {
 *         root.addEventListener("click", ..., { signal });
 *         return () => { ...undo what listeners can't... };
 *     });
 *
 * `setup` gets the root and an AbortSignal that is aborted on cleanup, to
 * pass as `{ signal }` to every listener (document ones included). It may
 * return a function for the rest: observers, timers, DOM it added.
 *
 * - `init(root)` binds one root and returns its cleanup. Calling it again
 *   on a root that is already bound is a no-op that returns the same
 *   cleanup, so it is safe to run on every render. Cleanup is one-shot,
 *   after which the root can be bound again.
 * - A behaviour that takes options gets them as the third argument of
 *   `setup`, and as the last argument of `init` and `initAll`. Options only
 *   count the first time a root is bound.
 * - `initAll(scope)` binds every root inside `scope` (and `scope` itself if
 *   it is one) and returns one cleanup for all of them.
 */

export interface Behaviour<E extends HTMLElement, O> {
    /** The CSS selector of the markup this binds to. */
    selector: string;
    init: (root: E, options?: O) => () => void;
    initAll: (scope?: ParentNode, options?: O) => () => void;
}

export const behaviour = <E extends HTMLElement = HTMLElement, O = never>(
    selector: string,
    setup: (
        root: E,
        signal: AbortSignal,
        options?: O,
    ) => undefined | (() => void),
): Behaviour<E, O> => {
    const bound = new WeakMap<E, () => void>();

    const init = (root: E, options?: O) => {
        const existing = bound.get(root);
        if (existing) return existing;

        const controller = new AbortController();
        let teardown: undefined | (() => void);
        let done = false;
        const cleanup = () => {
            if (done) return;
            done = true;
            controller.abort();
            teardown?.();
            bound.delete(root);
        };
        // Set first, so a setup that re-enters (calls init on its own root)
        // finds itself bound
        bound.set(root, cleanup);
        try {
            teardown = setup(root, controller.signal, options);
        } catch (error) {
            cleanup();
            throw error;
        }
        return cleanup;
    };

    const initAll = (scope: ParentNode = document, options?: O) => {
        const roots = [...scope.querySelectorAll<E>(selector)];
        if (scope instanceof HTMLElement && scope.matches(selector)) {
            roots.unshift(scope as E);
        }
        const cleanups = roots.map((root) => init(root, options));
        return () => {
            for (const cleanup of cleanups) cleanup();
        };
    };

    return { selector, init, initAll };
};
