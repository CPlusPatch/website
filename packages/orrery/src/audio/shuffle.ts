/**
 * The order to play `count` tracks in: each once, shuffled. `last` is the track that just ended,
 * and it doesn't come first.
 */
export const nextRound = (
    count: number,
    random: () => number,
    last?: number,
): number[] => {
    const order = Array.from({ length: count }, (_, k) => k);

    // Fisher-Yates
    for (let k = count - 1; k > 0; k--) {
        const j = Math.floor(random() * (k + 1));
        [order[k], order[j]] = [order[j] as number, order[k] as number];
    }

    if (count > 1 && order[0] === last) {
        [order[0], order[1]] = [order[1] as number, order[0] as number];
    }

    return order;
};
