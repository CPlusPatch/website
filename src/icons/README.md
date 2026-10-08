# Local icons

SVGs placed here are available to `<Icon>` as `name="<file name>"`, via
astro-icon's default `iconDir`.

This directory must exist even when it holds no icons. astro-icon adds it to
Vite's file watcher, and when it is missing, chokidar 3 (bundled by Vite)
watches `src/` for it instead, recording `src` as seen without reading it.
Depending on timing, the watcher's crawl of the project root then skips `src`,
so nothing under it is watched and the dev server never picks up changes.
Under Deno this happens on every start.
