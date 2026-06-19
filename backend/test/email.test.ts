import { describe, expect, it } from "vitest";
import { deriveTitle, detectImageType, rewriteCidImages, sanitizePostHtml, subjectMatchesPassword } from "../src/email";

describe("email utilities", () => {
  it("matches yarly passwords exactly after trimming surrounding whitespace", () => {
    expect(subjectMatchesPassword("secret", "secret")).toBe(true);
    expect(subjectMatchesPassword(" secret ", "secret")).toBe(true);
    expect(subjectMatchesPassword("secret title", "secret")).toBe(false);
  });

  it("derives a title from the first non-empty body line", () => {
    expect(deriveTitle("\n\nHello meekmail\nsecond line")).toBe("Hello meekmail");
    expect(deriveTitle("")).toBe("Untitled");
  });

  it("detects supported image signatures", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))?.contentType).toBe("image/jpeg");
    expect(detectImageType(Buffer.from("GIF89a"))?.contentType).toBe("image/gif");
  });

  it("rewrites cid image references and removes remote images", () => {
    const images = new Map([
      [
        "abc",
        {
          id: "img",
          url: "https://assets.example.com/posts/a/img.jpg",
          key: "posts/a/img.jpg",
          contentType: "image/jpeg",
          size: 10,
          cid: "abc"
        }
      ]
    ]);

    const rewritten = rewriteCidImages('<p>x</p><img src="cid:abc"><img src="https://tracker.example/pixel.gif">', images);
    const sanitized = sanitizePostHtml(rewritten, "https://assets.example.com");

    expect(sanitized).toContain("https://assets.example.com/posts/a/img.jpg");
    expect(sanitized).not.toContain("tracker.example");
  });
});
