export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

/**
 * Rotation (radians) and uniform scale of a 2D transform matrix. Skew and
 * non-uniform scale are lost, which is fine for the transforms pages use.
 */
export const decompose = ({
    m11,
    m12,
}: Pick<DOMMatrixReadOnly, "m11" | "m12">): {
    rotate: number;
    scale: number;
} => {
    const rotate = Math.atan2(m12, m11);
    // cos(rotate) is ~0 when m11 is, so divide by sin instead
    const scale =
        Math.abs(m11) < Number.EPSILON * 10
            ? m12 / Math.sin(rotate)
            : m11 / Math.cos(rotate);
    return { rotate, scale: Number.isNaN(scale) ? 0 : scale };
};

/**
 * CSS transform that puts a `size` element, laid out at the origin, on a body
 * at `position` turned by `angle`. `offset` is where the body's centre sits
 * relative to the element's, before scaling.
 */
export const bodyTransform = (
    position: Position,
    angle: number,
    size: Size,
    scale: number,
    offset: Position,
): string => {
    const css = [
        `translate(${position.x - size.width / 2}px, ${position.y - size.height / 2}px)`,
        `rotate(${angle}rad)`,
        `scale(${scale})`,
    ];
    if (offset.x !== 0 || offset.y !== 0) {
        css.push(`translate(${-offset.x}px, ${-offset.y}px)`);
    }
    return css.join(" ");
};
