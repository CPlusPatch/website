/// <reference types="deno" />
import { solarSystem } from "@cpluspatch/catalog";
import { documentOf } from "@cpluspatch/sim";
import { assert } from "@std/assert";
import { HASH_PREFIX } from "../../persistence.ts";
import { shareLink } from "./share.ts";

Deno.test("shareLink makes a link from the base and the encoded document", async () => {
    const base = "https://example.com/orbits?a=1";

    const result = await shareLink(documentOf(solarSystem), base);

    assert(result.ok);
    assert(result.link.startsWith(`${base}${HASH_PREFIX}`));
    assert(result.link.length > base.length + HASH_PREFIX.length);
});
