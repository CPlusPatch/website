/**
 * @module
 * The bookkeeping behind the loading bar of a view.
 */

/** The files done of the files started, for the sky and the maps. */
export type LoadingProgress = {
    /** Sets how much of the sky has arrived, from 0 to 1. */
    sky: (fraction: number) => void;
    /** Marks the sky as settled, whether it arrived or failed. */
    skyDone: () => void;
    /** Sets the maps `done` of `total` started. */
    maps: (done: number, total: number) => void;
    /** Marks the first frame as drawn. The maps of that frame are started by then. */
    drawn: () => void;
    /** Whether `destroy` has been called. */
    destroyed: () => boolean;
    /** Stops reports and resolves `ready`. */
    destroy: () => void;
    /** Resolves once the first frame is drawn and the sky and every map asked for by then have settled. */
    ready: Promise<void>;
    /** Reports the current state to `onLoading` and resolves `ready` if it's all done. */
    report: () => void;
};

/**
 * The progress of the files a view loads. `sky` is whether the sky is fetched, which counts as one file.
 * `onLoading` hears the files done of the total, and how full the bar is, from 0 to 1.
 */
export const createLoadingProgress = ({
    sky,
    onLoading,
}: {
    sky: boolean;
    onLoading?: (done: number, total: number, fill: number) => void;
}): LoadingProgress => {
    const skyTotal = sky ? 1 : 0;
    let skyDone = 0;
    let skyFraction = 0;
    let mapsDone = 0;
    let mapsTotal = 0;
    let drawn = false;
    let destroyed = false;
    const { promise: ready, resolve: resolveReady } =
        Promise.withResolvers<void>();
    const report = () => {
        // The sky and maps of a destroyed view can still settle.
        if (destroyed) return;

        const total = skyTotal + mapsTotal;
        if (total > 0) {
            onLoading?.(
                skyDone + mapsDone,
                total,
                (skyFraction + mapsDone) / total,
            );
        }
        // The maps of the first frame are started by then.
        if (drawn && skyDone === skyTotal && mapsDone === mapsTotal) {
            resolveReady();
        }
    };

    return {
        sky: (fraction) => {
            skyFraction = fraction;
            report();
        },
        skyDone: () => {
            skyDone = skyTotal;
            skyFraction = 1;
            report();
        },
        maps: (done, total) => {
            mapsDone = done;
            mapsTotal = total;
            report();
        },
        drawn: () => {
            if (drawn) return;

            drawn = true;
            report();
        },
        destroyed: () => destroyed,
        destroy: () => {
            // A view that goes before it's ready doesn't hold the reveal.
            destroyed = true;
            resolveReady();
        },
        ready,
        report,
    };
};
