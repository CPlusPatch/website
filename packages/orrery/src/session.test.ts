/// <reference types="deno" />
import { type Body, solarSystem } from "@cpluspatch/orbit";
import { assert, assertEquals } from "@std/assert";
import { Clock } from "./clock.ts";
import {
    encodeScenario,
    HASH_PREFIX,
    readSaved,
    type SavedStorage,
    STORAGE_KEY,
} from "./persistence.ts";
import { createSession } from "./session.ts";
import type { Notices } from "./ui/notices.ts";
import { World } from "./world.ts";

const memory = (): SavedStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();

    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
    };
};

const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const earthOnly = {
    ...solarSystem,
    bodies: solarSystem.bodies.filter(
        (body) => body.id === "sun" || body.id === "earth",
    ),
};

const setup = (hash = "", rebuildFn: () => void = () => {}) => {
    const world = new World(solarSystem, new Clock(0, 1, false));
    const storage = memory();
    const shown: string[] = [];
    const notices: Pick<Notices, "show"> = {
        show: (_variant, content) => {
            shown.push(String(content));
        },
    };
    const page = {
        hash: () => state.hash,
        stripHash: () => {
            state.hash = "";
            state.stripped++;
        },
        hidden: () => state.hidden,
        window: new EventTarget(),
        document: new EventTarget(),
    };
    const state = { hash, hidden: false, stripped: 0, rebuilt: 0 };
    const session = createSession({
        world,
        storage,
        notices,
        page,
        rebuild: () => {
            state.rebuilt++;
            rebuildFn();
        },
    });

    return { world, storage, shown, page, state, session };
};

const saved = (storage: SavedStorage) => {
    const result = readSaved(storage);

    return result?.ok ? result.scenario : null;
};

Deno.test("a change is saved after the delay, not at once", async () => {
    const { world, storage, session } = setup();

    world.setClock({ t: 42 });
    assertEquals(storage.getItem(STORAGE_KEY), null);

    await wait(600);

    assertEquals(saved(storage)?.time, 42);

    session.destroy();
});

Deno.test("a focus or a selection is not saved", () => {
    const { world, storage, session } = setup();

    world.focus("earth");
    world.select("earth");
    session.destroy();

    assertEquals(storage.getItem(STORAGE_KEY), null);
});

Deno.test("a change that is still pending is saved when the session is destroyed", () => {
    const { world, storage, session } = setup();

    world.setClock({ t: 7 });
    session.destroy();

    assertEquals(saved(storage)?.time, 7);
});

Deno.test("pagehide saves at once with the clock time", () => {
    const { world, storage, page, session } = setup();

    world.clock.set(99);
    page.window.dispatchEvent(new Event("pagehide"));

    assertEquals(saved(storage)?.time, 99);

    session.destroy();
});

Deno.test("visibilitychange saves at once only when the page is hidden", () => {
    const { world, storage, page, state, session } = setup();

    world.clock.set(5);
    page.document.dispatchEvent(new Event("visibilitychange"));
    assertEquals(storage.getItem(STORAGE_KEY), null);

    state.hidden = true;
    page.document.dispatchEvent(new Event("visibilitychange"));
    assertEquals(saved(storage)?.time, 5);

    session.destroy();
});

Deno.test("a scenario event calls rebuild, and other events don't", () => {
    const { world, state, session } = setup();

    world.focus("earth");
    world.setClock({ t: 1 });
    assertEquals(state.rebuilt, 0);

    world.load(earthOnly, 0);
    assertEquals(state.rebuilt, 1);

    session.destroy();
});

Deno.test("loading a valid link loads it, strips the hash and saves", async () => {
    const hash =
        HASH_PREFIX + (await encodeScenario({ ...earthOnly, time: 321 }));
    const { world, storage, state, session } = setup(hash);

    await session.loadHash();

    assertEquals(world.scenario.bodies.length, earthOnly.bodies.length);
    assertEquals(world.clock.t, 321);
    assertEquals(state.stripped, 1);
    assertEquals(state.hash, "");
    assertEquals(saved(storage)?.bodies.length, earthOnly.bodies.length);

    session.destroy();
});

Deno.test("loading a bad link shows a notice and leaves the world alone", async () => {
    const { world, storage, shown, state, session } = setup(
        `${HASH_PREFIX}garbage`,
    );

    await session.loadHash();

    assertEquals(world.scenario, solarSystem);
    assertEquals(shown, [
        "The shared link isn't a valid scenario, so nothing changed.",
    ]);
    assertEquals(state.stripped, 1);
    assertEquals(storage.getItem(STORAGE_KEY), null);

    session.destroy();
});

Deno.test("loading with no link does nothing", async () => {
    const { world, storage, shown, state, session } = setup("#other");

    await session.loadHash();

    assertEquals(world.scenario, solarSystem);
    assertEquals(shown, []);
    assertEquals(state.stripped, 0);
    assertEquals(storage.getItem(STORAGE_KEY), null);

    session.destroy();
});

Deno.test("a hashchange loads the link", async () => {
    const hash = HASH_PREFIX + (await encodeScenario(earthOnly));
    const { world, page, session } = setup(hash);

    const loaded = new Promise<void>((resolve) => {
        world.on((event) => {
            if (event.type === "scenario") resolve();
        });
    });
    page.window.dispatchEvent(new Event("hashchange"));
    await loaded;

    assertEquals(world.scenario.bodies.length, earthOnly.bodies.length);

    session.destroy();
});

Deno.test("a load that a newer scenario overtakes is dropped", async () => {
    const hash = HASH_PREFIX + (await encodeScenario(earthOnly));
    const { world, shown, session } = setup(hash);
    const newer = { ...earthOnly, name: "newer" };

    const loading = session.loadHash();
    world.load(newer, 0);
    await loading;

    assertEquals(world.scenario, newer);
    assertEquals(shown, []);

    session.destroy();
});

Deno.test("after destroy the listeners are gone and a pending load is dropped", async () => {
    const hash = HASH_PREFIX + (await encodeScenario(earthOnly));
    const { world, storage, page, state, session } = setup(hash);

    const loading = session.loadHash();
    session.destroy();
    await loading;

    assert(world.scenario.bodies.length > earthOnly.bodies.length);

    world.clock.set(8);
    page.window.dispatchEvent(new Event("pagehide"));
    state.hidden = true;
    page.document.dispatchEvent(new Event("visibilitychange"));
    state.hash = hash;
    page.window.dispatchEvent(new Event("hashchange"));
    await wait(50);
    world.setClock({ t: 9 });
    await wait(600);

    assertEquals(storage.getItem(STORAGE_KEY), null);
    assertEquals(state.rebuilt, 0);
    assert(world.scenario.bodies.length > earthOnly.bodies.length);
});

const rock = (id: string): Body => {
    const body = solarSystem.bodies.find(
        (candidate) => candidate.id === "moon",
    );
    if (!body?.elements) throw new Error("The scenario has no Moon.");

    return { ...body, id, name: id, parent: "earth" };
};

Deno.test("a rebuild that throws reloads the last scenario, keeps the focus and isn't saved", async () => {
    const { world, storage, shown, session } = setup("", () => {
        if (world.scenario.bodies.some((body) => body.id === "rock")) {
            throw new Error("no view");
        }
    });
    const written: string[] = [];
    storage.setItem = (_key, value) => {
        written.push(value);
    };
    world.focus("earth");

    world.addBody(rock("rock"));
    await wait(600);

    assertEquals(world.scenario, solarSystem);
    assertEquals(world.focused, "earth");
    assertEquals(shown, ["The model can't be drawn."]);
    assertEquals(written.length, 1);
    assertEquals(
        written.some((value) => value.includes('"rock"')),
        false,
    );

    session.destroy();
});

Deno.test("a failed rebuild keeps an orbit edited before it", () => {
    const { world, session } = setup("", () => {
        if (world.scenario.bodies.some((body) => body.id === "rock")) {
            throw new Error("no view");
        }
    });
    const moon = world.scenario.bodies.find((body) => body.id === "moon");
    if (!moon?.elements) throw new Error("The scenario has no Moon.");

    world.setElements("moon", { ...moon.elements, e: 0.2 });
    world.addBody(rock("rock"));

    const after = world.scenario.bodies.find((body) => body.id === "moon");
    assertEquals(after?.elements?.e, 0.2);

    session.destroy();
});

Deno.test("a rebuild that always throws shows the notice and doesn't loop", () => {
    const { world, state, shown, session } = setup("", () => {
        throw new Error("no view");
    });

    world.load(earthOnly, 0);

    assertEquals(state.rebuilt, 2);
    assertEquals(shown, ["The model can't be drawn."]);

    session.destroy();
});

Deno.test("a hashchange whose load rejects shows the invalid notice", async () => {
    const hash = HASH_PREFIX + (await encodeScenario(earthOnly));
    const { world, page, shown, session } = setup(hash);
    world.on((event) => {
        if (event.type === "scenario") throw new Error("listener");
    });
    let unhandled = false;
    const onUnhandled = (event: PromiseRejectionEvent) => {
        event.preventDefault();
        unhandled = true;
    };
    globalThis.addEventListener("unhandledrejection", onUnhandled);

    page.window.dispatchEvent(new Event("hashchange"));
    await wait(100);
    globalThis.removeEventListener("unhandledrejection", onUnhandled);

    assertEquals(shown, ["The shared link couldn't be opened."]);
    assertEquals(unhandled, false);

    session.destroy();
});
