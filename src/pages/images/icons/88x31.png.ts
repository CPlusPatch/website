import { readFile } from "node:fs/promises";
import type { APIRoute } from "astro";

// Old path of the 88x31, kept so links from other sites still load. A static
// redirect would be a meta refresh page, which <img> doesn't follow.
export const GET: APIRoute = async (): Promise<Response> =>
    new Response(await readFile("src/images/88x31s/jessew.png"), {
        headers: { "Content-Type": "image/png" },
    });
