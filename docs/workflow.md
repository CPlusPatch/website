# Development workflow

Most work happens in the gallery. Run `deno run dev` and open http://localhost:4321/gallery/ to see every state of a component at once.

## Making a change

Before calling a change done, look at it in the gallery's Display menu (themes, styles, light and dark, effects), with the keyboard, with reduced motion, and with JavaScript off if it has a script. A new state gets a new story: see [Adding a component](components.md).

## Checks

| Command                  | What it runs                                                                 |
| ------------------------ | ---------------------------------------------------------------------------- |
| `deno run check`         | Biome, `astro check`, `svelte-check`, the theme contrast check, unit tests and the Svelte parity tests. Same as CI. |
| `deno run lint:fix`      | Fixes most format and lint problems                                          |
| `deno run test`          | Unit tests: `*.test.ts` files next to the code in `packages/` and `src/`     |
| `deno run test:gallery`  | Builds the site and runs the browser tests in `tests/gallery/`               |
| `deno run gallery:diff`  | Shows what a change does to every story                                      |

## Gallery tests

The browser tests run with Playwright against `astro preview` on port 4322. Install the browser once with `npx playwright install chromium`. Every story is checked:

| Spec                 | Checks                                                                  |
| -------------------- | ----------------------------------------------------------------------- |
| `no-js.spec.ts`      | Renders, hides script-only controls and opens `<details>` with JS off   |
| `a11y.spec.ts`       | axe in light and dark, and in two other themes                          |
| `console.spec.ts`    | No errors logged and no failed requests                                 |
| `layout.spec.ts`     | No sideways scroll at the tablet, phone and tiny widths                 |
| `motion.spec.ts`     | Holds still with reduced motion, settles after its entrance unless `animated` |
| `focus.spec.ts`      | Focus is visible on everything Tab reaches                              |

`behaviours.spec.ts` drives a few components the way a reader would, like the dropdown, the carousel and the terminal.

Locally only Chromium runs. CI also runs Firefox and WebKit for the no-JS, a11y and console checks, and keeps the HTML report on failure.

After a build, `npx playwright test` reruns without rebuilding. Pass a spec (`npx playwright test a11y`) or a story (`-g "carousel/autoplay"`). The a11y, console and motion checks are named by group (`-g "carousel "`).

Some axe rules are off in `a11y.spec.ts`, each with a comment. Only turn one off when the gallery breaks it, not the component.

## Gallery diff

```sh
deno run gallery:diff              # the working tree against HEAD
deno run gallery:diff --ref main   # against another ref
```

It builds the gallery at the ref (in a worktree under `.gallery-diff/`) and from the working tree, then compares each story's HTML and each group's page as pictures, in light and dark, at desktop and phone widths. Stories tagged `live` are skipped. The report is at `.gallery-diff/index.html`.

There's no baseline to update: each run compares two fresh builds. It exits 0 whatever changed, unless you pass `--strict`. CI runs it on pull requests that touch the components or the gallery, and keeps the report as the `gallery-diff` artifact.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope when there's one, and a capitalised imperative subject:

```text
feat(gallery): Replace matrix groups with story controls
fix(ui): Keep sidebar link hover off touch screens
```

## Deploying

Pushing to `main` runs CI, and if it passes, the site deploys to GitHub Pages. Pull requests only run the checks.

## Downloaded media

The Shorts videos, the Radio music and the terminal's movie aren't in git. CI downloads them from URLs in these repository variables (Settings → Secrets and variables → Actions → Variables):

| Variable        | Contents                                 |
| --------------- | ---------------------------------------- |
| `SHORTS_ZIP_URL` | Zip of `src/data/shorts/`, files at its root |
| `RADIO_ZIP_URL`  | Zip of `src/data/radio/`, files at its root  |
| `MOVIE_URL`      | The movie file                           |

To zip a folder and upload it to Cloudflare R2 (after `wrangler login`):

```sh
(cd src/data/shorts && zip -qr - .) | wrangler r2 object put my-bucket/shorts.zip --pipe --content-type application/zip --remote
(cd src/data/radio && zip -qr - .) | wrangler r2 object put my-bucket/radio.zip --pipe --content-type application/zip --remote
```
