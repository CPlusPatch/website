/** The item a key moves to in a menu of `count` items, from item `k` (or -1 for none). */
export const menuTarget = (
    key: string,
    k: number,
    count: number,
): number | undefined => {
    const last = count - 1;

    switch (key) {
        case "ArrowDown":
            return k === last ? 0 : k + 1;
        case "ArrowUp":
            return k <= 0 ? last : k - 1;
        case "Home":
            return 0;
        case "End":
            return last;
        default:
            return undefined;
    }
};
