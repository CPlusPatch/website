# Local icons

SVGs placed here are available to `<Icon>` as `name="<file name>"`, via
astro-icon's default `iconDir`. They are for logos the iconify sets lack or
get wrong; each file says where its shape comes from.

astro-icon turns an icon drawn only in black (and white) into
`currentColor`, so it follows the text colour; any other colour is kept.
Draw one-colour logos in black to get that, and brand colours to keep them.

| Name     | What                          | Source                     |
| -------- | ----------------------------- | -------------------------- |
| `nixos`  | NixOS snowflake, in colour    | NixOS artwork, CC BY 4.0   |
| `matrix` | Matrix [m] mark, text colour  | Simple Icons 13.21.0, CC0  |
| `jquery` | jQuery mark, in jQuery blue   | Simple Icons 13.21.0, CC0  |

This directory must exist even when it holds no icons. astro-icon adds it to
Vite's file watcher, and when it is missing, chokidar 3 (bundled by Vite)
watches `src/` for it instead, recording `src` as seen without reading it.
Depending on timing, the watcher's crawl of the project root then skips `src`,
so nothing under it is watched and the dev server never picks up changes.
Under Deno this happens on every start.
