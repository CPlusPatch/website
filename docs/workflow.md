# Development workflow

```
edit → check it in the gallery → deno run check → commit → push → live
```

Most work happens in the gallery. Start the dev server with `deno run dev` and open http://localhost:4321. Every component has a set of stories there, so you can see a change in all its states at once.

## Making a change

Edit the component and keep an eye on its stories in the gallery. The Display menu at the top lets you switch themes, light and dark mode, the preview width and the page effects. It's worth going through those before you call something done, and also trying it with the keyboard, with reduced motion turned on, and with JavaScript disabled if the component has a script.

If you add a state that isn't covered yet, add a story for it. See [Adding a component](components.md).

## Checking

```sh
deno run check
```

This runs Biome (formatting and lint), `astro check` (types), the theme contrast check and the tests. It's the same thing CI runs, so if it passes locally, CI should pass too. `deno run lint:fix` fixes most formatting and lint problems for you.

Tests live next to the code they test, as `*.test.ts` files, and run with `deno run test`. So far that's the logic in `packages/`.

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
