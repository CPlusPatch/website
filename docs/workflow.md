# Development workflow

```
edit → check it in the gallery → deno run check → commit → push → live
```

Most work happens in the gallery. Start the dev server with `deno run dev` and open http://localhost:4321/gallery/. Every component has a page of stories there, so you can see a change in all its states at once.

## Making a change

Edit the component and keep an eye on its stories in the gallery. The Display menu at the top lets you switch themes, styles, light and dark mode and the page effects, and its Compare row shows a page's stories in light and dark side by side, in every theme, or in every style. The toolbar above the stories sets the preview width. It's worth going through those before you call something done, and also trying it with the keyboard, with reduced motion turned on, and with JavaScript disabled if the component has a script.

If you add a state that isn't covered yet, add a story for it. See [Adding a component](components.md).

## Checking

```sh
deno run check
```

This runs Biome (formatting and lint), `astro check` (types), the theme contrast check and the tests. It's the same thing CI runs, so if it passes locally, CI should pass too. `deno run lint:fix` fixes most formatting and lint problems for you.

Tests live next to the code they test, as `*.test.ts` files, and run with `deno run test`. So far that's the logic in `packages/`.

## Testing the gallery

```sh
deno run test:gallery
```

This builds the site and runs the browser tests in `tests/gallery/` with Playwright, against `astro preview` on port 4322. They go through every story in the gallery and check that it:

- renders, keeps its script-only controls hidden, and opens its `<details>` with JavaScript off (`no-js`)
- passes axe in light and dark and in two other themes (`a11y`)
- logs no errors and makes no failing requests (`console`)
- doesn't make the page scroll sideways at the tablet, phone and tiny widths (`layout`)
- holds still with reduced motion, and settles after its entrance unless it's tagged `animated` (`motion`)
- shows where focus is on everything Tab reaches (`focus`)

`behaviours.spec.ts` also drives a few components the way a reader would: the dropdown, the carousel, the terminal, a dialogue, copying code, and the filter on the gallery's front page.

The first time, install the browsers with `npx playwright install chromium`. Locally only Chromium runs, in about a minute; CI runs Firefox and WebKit too, for the no-JS, accessibility and console checks, and keeps the HTML report when something fails.

After the build, `npx playwright test` runs the tests again without rebuilding. To run some of them, pass a spec or a story: `npx playwright test a11y`, or `-g "carousel/autoplay"`. The accessibility, console and motion checks load a whole group at a time, so they are named by group (`-g "carousel "`) and say which story a problem is in.

Some axe rules are turned off in `a11y.spec.ts`, each with a comment saying why. Turn one off only when the gallery breaks it, not the component.

## Seeing what a change does to the gallery

```sh
deno run gallery:diff              # the working tree against HEAD
deno run gallery:diff --ref main   # against another commit or branch
```

This builds the gallery twice, at the ref (in a git worktree under `.gallery-diff/`, removed afterwards) and from the working tree, and compares every story:

- its HTML, without build hashes, script bodies or Astro's scoping attributes
- each group's page as a picture, in light and dark, at desktop and phone widths, with reduced motion, and with videos and GIFs masked

It prints which stories changed and writes a report to `.gallery-diff/index.html`, with the HTML diffs and the before, after and difference pictures. Stories tagged `live` are left out of both. Nothing is kept between runs, so there is no baseline to update: a run only ever compares two builds made on the same machine. It takes about 20 seconds.

The exit code is 0 whatever changed; pass `--strict` to make any change fail it. On pull requests that touch the components or the gallery, CI runs it against the base branch and keeps the report as the `gallery-diff` artifact. A ref from before the gallery had a manifest has nothing to compare, and says so.

## Committing

Keep commits small, one change each. Messages follow this format:

```
feat: Add autoplay to the carousel
fix: Keep snapped attachments clear of the group's edge fade
refactor: Simplify attachment hover and action buttons
```

The prefix is one of `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `test`, `ci` or `chore`. The rest starts with a capital letter and says what the commit does.

## Deploying

Pushing to `main` runs CI, and if it passes, the site is deployed to GitHub Pages. Pull requests only run the checks.

## Hosting the downloaded media

The videos for Shorts (`deno run shorts`) and the music for the Radio (`deno run radio`) are kept out of git, so CI downloads each folder as a zip from a repository variable (`SHORTS_ZIP_URL` and `RADIO_ZIP_URL`, under Settings → Secrets and variables → Actions → Variables). The terminal's movie works the same way with `MOVIE_URL`, but it is a single file and needs no zip.

To zip a folder and upload it to a Cloudflare R2 bucket in one go (replace `my-bucket`; run `wrangler login` once first):

```sh
(cd src/data/shorts && zip -qr - .) | wrangler r2 object put my-bucket/shorts.zip --pipe --content-type application/zip --remote
(cd src/data/radio && zip -qr - .) | wrangler r2 object put my-bucket/radio.zip --pipe --content-type application/zip --remote
```

Then set the variable to the object's public address, such as `https://media.example.com/shorts.zip`, once the bucket has a custom domain or its `r2.dev` URL turned on. The zip has the folder's files at its root, which is what CI unpacks.
