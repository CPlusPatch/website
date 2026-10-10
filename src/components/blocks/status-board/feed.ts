/**
 * The status feed, and what a <StatusBoard> shows from it. Used both to
 * render the board and by its script, so nothing here touches the DOM.
 */
import type { Tone } from "../../../lib/tone.ts";

/** Something a <StatusBoard> probes, like an HTTPS endpoint. */
export interface Probe {
    /** Its key in the feed's `probes`. */
    name: string;
    /** What is probed, like a domain or a metric. */
    target: string;
}

/** A server, and the probes run against what it hosts. */
export interface ProbeHost {
    name: string;
    /** What it does, beside its name. */
    about?: string;
    probes: Probe[];
}

/** The status feed, as the infrastructure publishes it. */
export interface StatusFeed {
    /** When it was written, in seconds since the epoch. */
    generatedAt: number;
    /** Whether each host is up, by name. */
    hosts: Record<string, boolean>;
    /** How many alerts are firing. */
    alerts: number;
    probes: Record<
        string,
        {
            /** The latest results, oldest first: true if it was up. */
            beats: boolean[];
            /** The latest response time, in milliseconds. */
            latency?: number;
        }
    >;
}

/** A tone, or the muted one for what isn't known. */
export type State = Tone | "neutral";

/** A probe's result: up, down, or null if there's none. */
export type Beat = boolean | null;

/** Seconds after which the feed is too old to show as live. */
const STALE_AFTER = 120;

export const isStale = (feed: StatusFeed, now = Date.now()) =>
    now / 1000 - feed.generatedAt > STALE_AFTER;

/** A <Status>'s tone: none for what isn't known, so it keeps the text's colour. */
export const statusTone = (state: State) =>
    state === "neutral" ? undefined : state;

/** The attribute a beat is drawn from. */
export const beatState = (beat: Beat) =>
    beat === null ? undefined : beat ? "up" : "down";

/** A probe's last `length` results, padded at the start with nulls. */
export const beatsOf = (
    feed: StatusFeed | undefined,
    name: string,
    length: number,
): Beat[] => {
    const beats = feed?.probes[name]?.beats.slice(-length) ?? [];
    return [...Array(length - beats.length).fill(null), ...beats];
};

/** Says a probe's timeline in words, for screen readers. */
export const describe = (beats: Beat[]) => {
    const known = beats.filter((beat) => beat !== null);
    if (!known.length) return "No results yet";
    const failed = known.filter((beat) => !beat).length;
    return `Last ${known.length} probes: ${known.length - failed} up, ${failed} down`;
};

/** What's shown beside a probe's timeline: its response time and state. */
export const stateOf = (
    feed: StatusFeed | undefined,
    name: string,
): { latency: string; label: string; tone: State } => {
    const probe = feed?.probes[name];
    const latest = probe?.beats.at(-1);
    if (!probe || latest === undefined) {
        return { latency: "—", label: "Unknown", tone: "neutral" };
    }
    if (!latest)
        return { latency: "timeout", label: "Down", tone: "destructive" };
    return {
        latency: probe.latency === undefined ? "—" : `${probe.latency} ms`,
        label: "Up",
        tone: "success",
    };
};

const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? "" : "s"}`;

/** An overview tile: its value, in `tone` if something's wrong. */
const tile = (value: string, wrong: boolean, tone: State = "destructive") => ({
    value,
    tone: wrong ? tone : ("success" as State),
});

/**
 * The overview's tiles and the headline, for the probes named. Without a
 * feed, they're unknown.
 */
export const summarise = (feed: StatusFeed | undefined, names: string[]) => {
    if (!feed) {
        const unknown = { value: "—", tone: "neutral" as State };
        return {
            tiles: { hosts: unknown, probes: unknown, alerts: unknown },
            headline: "Status unknown",
            tone: "neutral" as State,
        };
    }
    const hosts = Object.values(feed.hosts);
    const hostsDown = hosts.filter((up) => !up).length;
    const latest = names.map((name) => feed.probes[name]?.beats.at(-1));
    const up = latest.filter((beat) => beat === true).length;
    const down = latest.filter((beat) => beat === false).length;

    // The worst first
    const [headline, tone]: [string, State] = hostsDown
        ? [`${plural(hostsDown, "host")} down`, "destructive"]
        : down
          ? [`${plural(down, "endpoint")} down`, "destructive"]
          : feed.alerts
            ? [`${plural(feed.alerts, "alert")} firing`, "warning"]
            : ["All systems operational", "success"];

    return {
        tiles: {
            hosts: tile(
                `${hosts.length - hostsDown}/${hosts.length}`,
                hostsDown > 0,
            ),
            probes: tile(`${up}/${names.length}`, down > 0),
            alerts: tile(String(feed.alerts), feed.alerts > 0, "warning"),
        },
        headline,
        tone,
    };
};
