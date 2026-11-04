/// <reference types="deno" />
import { assertEquals } from "@std/assert";
import { imageAttributes, imageRatio, imageUrl } from "./image.ts";

Deno.test("a URL source is only a src", () => {
    assertEquals(imageAttributes("/a.png"), { src: "/a.png" });
    assertEquals(imageUrl("/a.png"), "/a.png");
    assertEquals(imageRatio("/a.png"), undefined);
});

Deno.test("a sized source keeps its size, and a srcset only if given", () => {
    const sized = { src: "/a.png", width: 640, height: 480 };
    assertEquals(imageAttributes(sized), {
        src: "/a.png",
        width: 640,
        height: 480,
    });
    assertEquals(
        imageAttributes({ ...sized, srcset: "/a.png 1x" }).srcset,
        "/a.png 1x",
    );
    assertEquals(imageUrl(sized), "/a.png");
    assertEquals(imageRatio(sized), "640 / 480");
});
