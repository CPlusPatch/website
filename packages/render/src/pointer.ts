/** What the pointer does to the bodies under it. */
export type PointerActions = {
    /** The id of the body at a point in px of the canvas, or `null`. */
    pick: (x: number, y: number) => string | null;
    select: (id: string | null) => void;
    focus: (id: string) => void;
    hover: (id: string | null) => void;
};

/** The px a pointer may move between down and up and still count as a click. */
const CLICK_PX = 4;

/** Selects, focuses and hovers bodies on `canvas`. Returns a function that stops it. */
export const bindPointer = (
    canvas: HTMLElement,
    actions: PointerActions,
): (() => void) => {
    let down: { id: number; x: number; y: number } | null = null;
    let clicked = false;

    const at = (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();

        return actions.pick(
            event.clientX - rect.left,
            event.clientY - rect.top,
        );
    };

    const onDown = (event: PointerEvent) => {
        if (!event.isPrimary || event.button !== 0) return;

        down = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };

    const onUp = (event: PointerEvent) => {
        const start = down;
        down = null;
        clicked = false;

        // The controls also use this canvas, and a drag turns the camera.
        if (!start || start.id !== event.pointerId) return;
        if (
            Math.hypot(event.clientX - start.x, event.clientY - start.y) >=
            CLICK_PX
        ) {
            return;
        }

        clicked = true;
        actions.select(at(event));
    };

    const onMove = (event: PointerEvent) => {
        // Touch has no hover, and a drag isn't one.
        if (event.pointerType === "touch" || event.buttons !== 0) return;

        const id = at(event);
        canvas.style.cursor = id ? "pointer" : "";
        actions.hover(id);
    };

    const onLeave = () => {
        canvas.style.cursor = "";
        actions.hover(null);
    };

    const onCancel = () => {
        down = null;
    };

    const onDoubleClick = (event: MouseEvent) => {
        // The second click of a double-click may end a drag.
        if (!clicked) return;

        const id = at(event);
        if (!id) return;

        actions.select(id);
        actions.focus(id);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("dblclick", onDoubleClick);

    return () => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onCancel);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerleave", onLeave);
        canvas.removeEventListener("dblclick", onDoubleClick);
        canvas.style.cursor = "";
    };
};
