/**
 * Matter.js internals that exist at runtime but that @types/matter-js leaves
 * out, typed in one place instead of with scattered @ts-expect-errors.
 */

import Matter from "matter-js";

interface MouseHandlers {
    mousedown(event: MouseEvent): void;
    mousemove(event: MouseEvent): void;
    mouseup(event: MouseEvent): void;
}

/**
 * The mouse listens on the container, which never gets pointer events (it
 * has pointer-events: none), so the gun feeds it the ones it wants it to see.
 */
export const mouseHandlers = (mouse: Matter.Mouse): MouseHandlers =>
    mouse as unknown as MouseHandlers;

/** Grab `bodies` with the constraint right away, without waiting a tick. */
export const grab = (
    constraint: Matter.MouseConstraint,
    bodies: Matter.Body[],
): void =>
    (
        Matter.MouseConstraint as unknown as {
            update(
                constraint: Matter.MouseConstraint,
                bodies: Matter.Body[],
            ): void;
        }
    ).update(constraint, bodies);

export const hasMoved = (body: Matter.Body): boolean => {
    const { anglePrev, positionPrev } = body as Matter.Body & {
        anglePrev: number;
        positionPrev: Matter.Vector;
    };
    return (
        body.angle !== anglePrev ||
        body.position.x !== positionPrev.x ||
        body.position.y !== positionPrev.y
    );
};
