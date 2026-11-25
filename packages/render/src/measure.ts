/** Measures text in a font. */
export type Measure = {
    /** Reads the font again, once a web font has loaded. */
    refresh: () => void;
    width: (text: string) => number;
};

/** A measure for the font of `element`, which doesn't touch the layout. */
export const createMeasure = (element: HTMLElement): Measure => {
    const context = document.createElement("canvas").getContext("2d");
    let font = "";
    const refresh = () => {
        const style = getComputedStyle(element);
        font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    };
    refresh();

    return {
        refresh,
        width: (text: string): number => {
            if (!context) return text.length * 7;

            context.font = font;

            return context.measureText(text).width;
        },
    };
};
