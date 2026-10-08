/**
 * Gravity gun sounds, played through the Web Audio API.
 * Adapted from https://www.half-life.com/en/halflife2/20th
 */

export type SoundName =
    | "holdloop"
    | "select"
    | "weaponswitch"
    | "pickup"
    | "open"
    | "close"
    | "drop"
    | "dryfire";

interface Sound {
    url: string;
    volume: number;
    loop?: boolean;
    /** Sounds this one cuts off when it starts. */
    stops?: SoundName[];
}

// Literal `new URL(..., import.meta.url)` calls, so the bundler emits the files
const SOUNDS: Record<SoundName, Sound> = {
    holdloop: {
        url: new URL("./assets/audio/physcannon_hold_loop.mp3", import.meta.url)
            .href,
        volume: 0.2,
        loop: true,
    },
    select: {
        url: new URL("./assets/audio/physcannon_select.mp3", import.meta.url)
            .href,
        volume: 0.3,
    },
    weaponswitch: {
        url: new URL("./assets/audio/physcannon_return.mp3", import.meta.url)
            .href,
        volume: 0.3,
    },
    pickup: {
        url: new URL("./assets/audio/physcannon_pickup.mp3", import.meta.url)
            .href,
        volume: 0.3,
    },
    open: {
        url: new URL(
            "./assets/audio/physcannon_claws_open.mp3",
            import.meta.url,
        ).href,
        volume: 0.3,
        stops: ["close"],
    },
    close: {
        url: new URL(
            "./assets/audio/physcannon_claws_close.mp3",
            import.meta.url,
        ).href,
        volume: 0.3,
        stops: ["open"],
    },
    drop: {
        url: new URL("./assets/audio/physcannon_drop.mp3", import.meta.url)
            .href,
        volume: 0.3,
    },
    dryfire: {
        url: new URL("./assets/audio/physcannon_dryfire.mp3", import.meta.url)
            .href,
        volume: 0.3,
    },
};

/**
 * A one-shot sound still loading after this long is dropped instead of
 * played late, out of sync with what triggered it.
 */
const STALE_AFTER_MS = 500;

class Track {
    private readonly buffer: Promise<AudioBuffer | null>;
    private readonly gain: GainNode;
    private source: AudioBufferSourceNode | null = null;
    /** Bumped by every play and stop, so a pending play knows it was superseded. */
    private request = 0;

    constructor(
        private readonly context: AudioContext,
        private readonly sound: Sound,
    ) {
        this.gain = context.createGain();
        this.gain.gain.value = sound.volume;
        this.gain.connect(context.destination);
        this.buffer = this.load();
    }

    private async load(): Promise<AudioBuffer | null> {
        try {
            const response = await fetch(this.sound.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await this.context.decodeAudioData(
                await response.arrayBuffer(),
            );
        } catch (error) {
            console.warn(`destructor: couldn't load ${this.sound.url}`, error);
            return null;
        }
    }

    async play(): Promise<void> {
        const request = ++this.request;
        const requestedAt = performance.now();
        const buffer = await this.buffer;

        if (!buffer || request !== this.request) return;
        if (
            !this.sound.loop &&
            performance.now() - requestedAt > STALE_AFTER_MS
        ) {
            return;
        }

        this.source?.stop();
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = this.sound.loop ?? false;
        source.connect(this.gain);
        source.addEventListener("ended", () => {
            if (this.source === source) this.source = null;
        });
        source.start();
        this.source = source;
    }

    stop(): void {
        this.request++;
        this.source?.stop();
        this.source = null;
    }
}

export class SoundEffects {
    private readonly context = new AudioContext();
    private readonly tracks = new Map<SoundName, Track>();

    constructor() {
        for (const [name, sound] of Object.entries(SOUNDS)) {
            this.tracks.set(name as SoundName, new Track(this.context, sound));
        }
    }

    play(name: SoundName): void {
        // A context created before any user gesture starts suspended. Every
        // play comes from a mouse or touch handler, so resuming here works.
        if (this.context.state === "suspended") void this.context.resume();

        for (const other of SOUNDS[name].stops ?? []) {
            this.stop(other);
        }
        void this.tracks.get(name)?.play();
    }

    stop(name: SoundName): void {
        this.tracks.get(name)?.stop();
    }
}
