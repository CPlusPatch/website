/**
 * `deno run gallery:diff [--ref <commit>] [--out <dir>] [--strict]`
 *
 * Builds the gallery at a git ref (HEAD by default) and in the working
 * tree, then says which stories changed: their HTML, and what each group's
 * page looks like in light and dark, wide and phone-sized. Writes a report
 * to <out>/index.html (.gallery-diff by default) and a summary to the
 * console. Exits 0 whatever changed, unless --strict.
 *
 * Nothing is kept between runs: the ref is checked out into a worktree
 * inside <out>, built there, and removed at the end.
 */
import { spawn, spawnSync } from "node:child_process";
import {
    copyFileSync,
    existsSync,
    linkSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Page } from "@playwright/test";
import { showAll } from "./fixtures.ts";

const { values: args } = parseArgs({
    options: {
        ref: { type: "string", default: "HEAD" },
        out: { type: "string", default: ".gallery-diff" },
        strict: { type: "boolean", default: false },
    },
});

interface Story {
    id: string;
    group: string;
    tags: string[];
}

const git = (...a: string[]) => {
    const run = spawnSync("git", a, { encoding: "utf8" });
    if (run.status !== 0) throw new Error(run.stderr.trim() || `git ${a[0]}`);
    return run.stdout.trim();
};

/** Runs a command, quietly; prints its output only if it fails. */
const run = (cmd: string, a: string[], cwd: string) =>
    new Promise<void>((done, fail) => {
        // The same for both builds: the movie only comes from CI.
        const env = { ...process.env };
        delete env.PUBLIC_MOVIE_URL;
        const child = spawn(cmd, a, { cwd, env });
        let output = "";
        child.stdout.on("data", (d) => {
            output += d;
        });
        child.stderr.on("data", (d) => {
            output += d;
        });
        child.on("error", fail);
        child.on("close", (code) => {
            if (code === 0) return done();
            process.stderr.write(output);
            fail(new Error(`${cmd} ${a.join(" ")} failed in ${cwd}`));
        });
    });

/** Hard links a folder's files into another, or copies them across disks. */
const linkTree = (from: string, to: string) => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
        const [a, b] = [join(from, entry.name), join(to, entry.name)];
        if (entry.isDirectory()) linkTree(a, b);
        else {
            try {
                linkSync(a, b);
            } catch {
                copyFileSync(a, b);
            }
        }
    }
};

const root = git("rev-parse", "--show-toplevel");
let sha: string;
try {
    sha = git("rev-parse", "--verify", "--quiet", `${args.ref}^{commit}`);
} catch {
    console.error(`gallery:diff: ${args.ref} is not a commit`);
    process.exit(2);
}
const out = resolve(root, args.out);
const tree = join(out, "ref-tree");
const dists = { ref: join(tree, "dist"), head: join(root, "dist") };

// Only what an earlier run wrote, never the folder itself.
const clean = () => {
    if (existsSync(tree)) {
        spawnSync("git", ["worktree", "remove", "--force", tree]);
        rmSync(tree, { recursive: true, force: true });
    }
    spawnSync("git", ["worktree", "prune"]);
};
clean();
for (const old of ["index.html", "html", "shots"]) {
    rmSync(join(out, old), { recursive: true, force: true });
}
mkdirSync(out, { recursive: true });

/** HTML and screenshot results, for the report and the summary. */
interface Changed {
    id: string;
    diff: string;
}
interface Shot {
    id: string;
    changed: boolean;
    pixels: number;
    size?: string;
}

/**
 * A story's HTML, down to what it renders: the <main> it sits in, without
 * script bodies, build hashes or Astro's scoping attributes, one tag a line.
 */
function storyHtml(dist: string, story: Story) {
    const file = join(dist, "gallery/story", story.id, "index.html");
    if (!existsSync(file)) return undefined;
    const page = readFileSync(file, "utf8");
    const main = page.match(/<main id="main"[\s\S]*<\/main>/)?.[0] ?? page;
    return main
        .replaceAll(/(<script\b[^>]*>)[\s\S]*?<\/script>/g, "$1…</script>")
        .replaceAll(
            // name.HASH.ext, and name.HASH_VARIANT.ext for optimised images
            /(\/_astro\/[^"'\s?)]*?)\.[\w-]{8}(?:_[\w-]+)?\.(\w+)/g,
            "$1.#.$2",
        )
        .replaceAll(/\s*data-astro-cid-\w+(="[^"]*")?/g, "")
        .replaceAll(/\s+/g, " ")
        .replaceAll(/>\s*</g, ">\n<");
}

function compareHtml(before: Story[], after: Story[]) {
    const old = new Map(before.map((s) => [s.id, s]));
    const now = new Set(after.map((s) => s.id));
    const html: Changed[] = [];
    const dir = join(out, "html");
    mkdirSync(dir, { recursive: true });
    for (const story of after) {
        // A live story shows whatever its feed had when it was built.
        if (!old.has(story.id) || story.tags.includes("live")) continue;
        const a = storyHtml(dists.ref, story);
        const b = storyHtml(dists.head, story);
        if (a === b || a === undefined || b === undefined) continue;
        const name = story.id.replace("/", "--");
        const [fa, fb] = [join(dir, `${name}.ref`), join(dir, `${name}.head`)];
        writeFileSync(fa, `${a}\n`);
        writeFileSync(fb, `${b}\n`);
        const diff = spawnSync(
            "diff",
            ["-u", "--label", args.ref, "--label", "working tree", fa, fb],
            { encoding: "utf8" },
        ).stdout;
        rmSync(fa);
        rmSync(fb);
        html.push({ id: story.id, diff });
    }
    return {
        html,
        added: after.filter((s) => !old.has(s.id)).map((s) => s.id),
        removed: before.filter((s) => !now.has(s.id)).map((s) => s.id),
    };
}

/** The looks each group is pictured in. */
const LOOKS = [
    { scheme: "light", width: "desktop", px: 1280 },
    { scheme: "dark", width: "desktop", px: 1280 },
    { scheme: "light", width: "phone", px: 512 },
    { scheme: "dark", width: "phone", px: 512 },
];

/**
 * Each build is served from disk under its own made-up origin; anything
 * else, and all media, is refused, so neither side waits on the network
 * or on how far a video got.
 */
const ORIGINS = {
    ref: "http://ref.gallery.test",
    head: "http://head.gallery.test",
};

async function compareShots(before: Story[], after: Story[]) {
    const groups = [...new Set(after.map((s) => s.group))].filter((g) =>
        before.some((s) => s.group === g),
    );
    // Hidden, not removed, so the stories around them stay put.
    const hide = [...before, ...after]
        .filter((s) => s.tags.includes("live"))
        .map((s) => `[data-story="${s.id}"]`);
    const css = hide.length
        ? `${hide.join(", ")} { visibility: hidden !important; }`
        : "";

    const browser = await chromium.launch();
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.route("**/*", (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const side = (Object.keys(ORIGINS) as (keyof typeof ORIGINS)[]).find(
            (k) => ORIGINS[k] === url.origin,
        );
        if (!side || request.resourceType() === "media") {
            return route.abort("blockedbyclient");
        }
        let file = join(dists[side], decodeURIComponent(url.pathname));
        if (!file.startsWith(dists[side] + sep))
            return route.fulfill({ status: 404 });
        if (existsSync(file) && statSync(file).isDirectory()) {
            file = join(file, "index.html");
        }
        if (!existsSync(file)) return route.fulfill({ status: 404 });
        return route.fulfill({ path: file });
    });

    const shoot = async (
        page: Page,
        side: keyof typeof ORIGINS,
        path: string,
        px: number,
    ) => {
        await page.setViewportSize({ width: px, height: 800 });
        await page.goto(`${ORIGINS[side]}${path}`);
        if (css) await page.addStyleTag({ content: css });
        await showAll(page);
        // Lazy images in boxes that aren't shown (a closed <details>, a
        // slide off to the side) never load by themselves.
        await page.evaluate(async () => {
            await document.fonts.ready;
            const images = [...document.images];
            for (const img of images) img.loading = "eager";
            await Promise.race([
                Promise.all(images.map((img) => img.decode().catch(() => {}))),
                new Promise((done) => setTimeout(done, 5000)),
            ]);
        });
        return page.screenshot({
            fullPage: true,
            animations: "disabled",
            caret: "hide",
            mask: [page.locator("video, canvas")],
        });
    };

    const shotsDir = join(out, "shots");
    mkdirSync(shotsDir, { recursive: true });
    const jobs = groups.flatMap((group) =>
        LOOKS.map((look) => ({ group, look })),
    );
    const results: Shot[] = [];
    const worker = async () => {
        const page = await context.newPage();
        for (let job = jobs.shift(); job; job = jobs.shift()) {
            const { group, look } = job;
            const path = `/gallery/story/${group}/?scheme=${look.scheme}`;
            const a = await shoot(page, "ref", path, look.px);
            const b = await shoot(page, "head", path, look.px);
            const id = `${group} ${look.scheme} ${look.width}`;
            if (a.equals(b)) {
                results.push({ id, changed: false, pixels: 0 });
                continue;
            }
            const result = await pixelDiff(page, a, b);
            results.push({
                id,
                ...result,
                changed: result.pixels > 0 || !!result.size,
            });
            if (result.pixels > 0 || result.size) {
                const name = `${group}-${look.scheme}-${look.width}`;
                writeFileSync(join(shotsDir, `${name}.ref.png`), a);
                writeFileSync(join(shotsDir, `${name}.head.png`), b);
                if (result.png) {
                    writeFileSync(
                        join(shotsDir, `${name}.diff.png`),
                        Buffer.from(result.png, "base64"),
                    );
                }
            }
        }
        await page.close();
    };
    try {
        await Promise.all(Array.from({ length: 4 }, worker));
    } finally {
        await browser.close();
    }
    return results.sort((x, y) => x.id.localeCompare(y.id));
}

/**
 * Compares two screenshots in the browser, on a canvas: how many pixels
 * differ by more than a shade, and a picture of where (red over a faded
 * copy of the new one). Pictures of different sizes count as changed.
 */
async function pixelDiff(page: Page, a: Buffer, b: Buffer) {
    await page.goto("about:blank");
    return page.evaluate(
        async ([a, b]) => {
            const load = async (data: string) => {
                const blob = await (
                    await fetch(`data:image/png;base64,${data}`)
                ).blob();
                return createImageBitmap(blob);
            };
            const [ia, ib] = await Promise.all([load(a), load(b)]);
            const pixels = (img: ImageBitmap) => {
                const canvas = new OffscreenCanvas(img.width, img.height);
                const ctx = canvas.getContext(
                    "2d",
                ) as OffscreenCanvasRenderingContext2D;
                ctx.drawImage(img, 0, 0);
                return ctx.getImageData(0, 0, img.width, img.height);
            };
            const size =
                ia.width !== ib.width || ia.height !== ib.height
                    ? `${ia.width}×${ia.height} → ${ib.width}×${ib.height}`
                    : undefined;
            const w = Math.min(ia.width, ib.width);
            const h = Math.min(ia.height, ib.height);
            const [da, db] = [pixels(ia), pixels(ib)];
            const diff = new ImageData(w, h);
            let count = 0;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = (y * ia.width + x) * 4;
                    const j = (y * ib.width + x) * 4;
                    const o = (y * w + x) * 4;
                    let delta = 0;
                    for (let c = 0; c < 3; c++) {
                        delta = Math.max(
                            delta,
                            Math.abs(da.data[i + c] - db.data[j + c]),
                        );
                    }
                    if (delta > 16) {
                        count++;
                        diff.data.set([255, 0, 64, 255], o);
                    } else {
                        const grey =
                            (db.data[j] + db.data[j + 1] + db.data[j + 2]) / 3;
                        const faded = 255 - (255 - grey) * 0.15;
                        diff.data.set([faded, faded, faded, 255], o);
                    }
                }
            }
            if (!count && !size) return { pixels: 0, size };
            const canvas = new OffscreenCanvas(w, h);
            (
                canvas.getContext("2d") as OffscreenCanvasRenderingContext2D
            ).putImageData(diff, 0, 0);
            const blob = await canvas.convertToBlob({ type: "image/png" });
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let binary = "";
            for (let i = 0; i < bytes.length; i += 0x8000) {
                binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            }
            return { pixels: count, size, png: btoa(binary) };
        },
        [a.toString("base64"), b.toString("base64")] as const,
    );
}

const escapeHtml = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function writeReport(
    { html, added, removed }: ReturnType<typeof compareHtml>,
    pictures: Shot[],
    count: number,
) {
    const changed = pictures.filter((s) => s.changed);
    const diffLines = (diff: string) =>
        diff
            .split("\n")
            .map((line) => {
                const kind = line.startsWith("+")
                    ? "add"
                    : line.startsWith("-")
                      ? "del"
                      : line.startsWith("@@")
                        ? "hunk"
                        : "";
                return `<span class="${kind}">${escapeHtml(line)}</span>`;
            })
            .join("\n");
    const list = (title: string, ids: string[]) =>
        ids.length
            ? `<h2>${title} (${ids.length})</h2><ul>${ids.map((id) => `<li><code>${id}</code></li>`).join("")}</ul>`
            : "";
    const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gallery diff</title>
<style>
:root { color-scheme: light dark; --add: #1a7f37; --del: #cf222e; --hunk: #8250df; --line: #8884; }
body { margin: 0 auto; max-width: 90rem; padding: 1rem; font: 15px/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText; }
pre { overflow-x: auto; padding: 0.75rem; border: 1px solid var(--line); border-radius: 6px; font-size: 13px; }
.add { color: var(--add); } .del { color: var(--del); } .hunk { color: var(--hunk); }
details { margin-block: 0.5rem; } summary { cursor: pointer; }
.shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; align-items: start; }
.shots figure { margin: 0; } .shots img { width: 100%; border: 1px solid var(--line); }
figcaption { font-size: 13px; opacity: 0.8; }
@media (max-width: 40rem) { .shots { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>Gallery diff</h1>
<p>${escapeHtml(args.ref)} (<code>${short}</code>) against the working tree. ${html.length} of ${count} stories changed their HTML; ${changed.length} of ${pictures.length} pictures changed.</p>
${list("Added stories", added)}
${list("Removed stories", removed)}
${html.length ? `<h2>HTML (${html.length})</h2>` : ""}
${html.map(({ id, diff }) => `<details><summary><code>${id}</code></summary><pre>${diffLines(diff)}</pre></details>`).join("\n")}
${changed.length ? `<h2>Pictures (${changed.length})</h2>` : ""}
${changed
    .map(({ id, pixels, size }) => {
        const name = `shots/${id.replaceAll(" ", "-")}`;
        const note = size ? `size ${size}` : `${pixels} pixels differ`;
        return `<details open><summary><code>${id}</code>: ${note}</summary><div class="shots">
<figure><img src="${name}.ref.png" alt="" loading="lazy"><figcaption>${escapeHtml(args.ref)}</figcaption></figure>
<figure><img src="${name}.head.png" alt="" loading="lazy"><figcaption>Working tree</figcaption></figure>
<figure><img src="${name}.diff.png" alt="" loading="lazy"><figcaption>Difference</figcaption></figure>
</div></details>`;
    })
    .join("\n")}
${!html.length && !changed.length && !added.length && !removed.length ? "<p>Nothing changed.</p>" : ""}
</body>
</html>
`;
    writeFileSync(join(out, "index.html"), page);
}

function summarise(
    { html, added, removed }: ReturnType<typeof compareHtml>,
    pictures: Shot[],
    count: number,
) {
    const changed = pictures.filter((s) => s.changed);
    const lines = [
        `HTML: ${html.length} of ${count} stories changed${added.length ? `, ${added.length} added` : ""}${removed.length ? `, ${removed.length} removed` : ""}`,
        ...html.map((c) => `  ${c.id}`),
        ...added.map((id) => `  + ${id}`),
        ...removed.map((id) => `  - ${id}`),
        `Pictures: ${changed.length} of ${pictures.length} changed`,
        ...changed.map(
            (s) =>
                `  ${s.id}: ${s.size ? `size ${s.size}` : `${s.pixels} pixels`}`,
        ),
        `Report: ${join(args.out, "index.html")}`,
    ];
    console.log(lines.join("\n"));
}

// Last, once everything above is defined.
const short = sha.slice(0, 8);
try {
    git("worktree", "add", "--detach", tree, sha);
    // The media that isn't in git, so both builds have the same.
    const ignored = git(
        "-C",
        root,
        "ls-files",
        "-oi",
        "--exclude-standard",
        "--directory",
        "src/data",
    );
    for (const dir of ignored.split("\n").filter(Boolean)) {
        linkTree(join(root, dir), join(tree, dir));
    }

    console.log(`Building ${args.ref} (${short}) and the working tree…`);
    await run("deno", ["install", "--frozen"], tree);
    await Promise.all([
        run("deno", ["run", "build"], tree),
        run("deno", ["run", "build"], root),
    ]);

    const manifest = (dist: string): Story[] | undefined => {
        const file = join(dist, "gallery/manifest.json");
        return existsSync(file)
            ? JSON.parse(readFileSync(file, "utf8"))
            : undefined;
    };
    const before = manifest(dists.ref);
    const after = manifest(dists.head);
    if (!after) throw new Error("the working tree's build has no manifest");
    if (!before) {
        console.log(
            `${args.ref} has no gallery manifest, so there's nothing to compare against.`,
        );
        process.exitCode = args.strict ? 1 : 0;
    } else {
        const report = compareHtml(before, after);
        const total = after.length;
        const shots = await compareShots(before, after);
        writeReport(report, shots, total);
        summarise(report, shots, total);
        const any =
            report.html.length ||
            report.added.length ||
            report.removed.length ||
            shots.some((s) => s.changed);
        if (args.strict && any) process.exitCode = 1;
    }
} finally {
    clean();
}
