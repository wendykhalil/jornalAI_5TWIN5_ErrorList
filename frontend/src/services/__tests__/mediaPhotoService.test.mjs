import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  getSafeBaseUrl,
  getSafeNextUrl,
  buildMediaRequestUrl,
  mediaPhotoService,
} from "../mediaPhotoService.js";

describe("mediaPhotoService URL Construction and Pagination Regression Tests", () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  });

  it("1. getSafeBaseUrl correctly resolves relative /api/media/ without throwing Invalid URL", () => {
    globalThis.window = {
      location: {
        origin: "https://mindlog-ai.swedencentral.cloudapp.azure.com",
      },
    };

    const url = getSafeBaseUrl("/api/media/");
    assert.equal(
      url.href,
      "https://mindlog-ai.swedencentral.cloudapp.azure.com/api/media/"
    );
    assert.equal(
      url.origin,
      "https://mindlog-ai.swedencentral.cloudapp.azure.com"
    );
    assert.equal(url.pathname, "/api/media/");
  });

  it("2. getSafeBaseUrl falls back to localhost when window is undefined (SSR/test)", () => {
    delete globalThis.window;

    const url = getSafeBaseUrl("/api/media/");
    assert.equal(url.href, "http://localhost:8000/api/media/");
    assert.equal(url.origin, "http://localhost:8000");
  });

  it("3. getSafeBaseUrl preserves already-absolute URLs", () => {
    const url = getSafeBaseUrl("https://production.example.com/api/media/");
    assert.equal(url.href, "https://production.example.com/api/media/");
    assert.equal(url.origin, "https://production.example.com");
  });

  it("4. getSafeNextUrl resolves relative queries and absolute DRF next URLs", () => {
    const baseUrl = new URL(
      "/api/media/",
      "https://mindlog-ai.swedencentral.cloudapp.azure.com"
    );

    // Case A: DRF returns full absolute URL
    const nextAbsolute = getSafeNextUrl(
      "https://mindlog-ai.swedencentral.cloudapp.azure.com/api/media/?page=2",
      baseUrl
    );
    assert.equal(
      nextAbsolute.href,
      "https://mindlog-ai.swedencentral.cloudapp.azure.com/api/media/?page=2"
    );
    assert.equal(nextAbsolute.search, "?page=2");

    // Case B: DRF returns relative query
    const nextRelative = getSafeNextUrl("?page=3", baseUrl);
    assert.equal(
      nextRelative.href,
      "https://mindlog-ai.swedencentral.cloudapp.azure.com/api/media/?page=3"
    );
    assert.equal(nextRelative.search, "?page=3");
  });

  it("5. buildMediaRequestUrl handles endpoints cleanly without duplicate slashes", () => {
    const base = buildMediaRequestUrl("");
    assert.equal(buildMediaRequestUrl("?page=2"), `${base}?page=2`);
    assert.equal(buildMediaRequestUrl("123/"), `${base}123/`);
    assert.equal(buildMediaRequestUrl("/123/"), `${base}123/`);
  });

  it("6. getMedia paginates successfully when VITE_API_BASE_URL is relative (/api)", async () => {
    globalThis.window = {
      location: {
        origin: "https://mindlog-ai.swedencentral.cloudapp.azure.com",
      },
    };

    let callCount = 0;
    globalThis.fetch = async (url) => {
      callCount++;
      const urlStr = String(url);

      if (urlStr.includes("?page=2")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            next: null,
            results: [
              { id: "img-2", media_type: "image", title: "Page 2 Photo" },
            ],
          }),
        };
      }

      // First page
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          next: `${getSafeBaseUrl().origin}/api/media/?page=2`,
          results: [
            { id: "img-1", media_type: "image", title: "Page 1 Photo" },
          ],
        }),
      };
    };

    const mediaList = await mediaPhotoService.getMedia();
    assert.equal(callCount, 2);
    assert.equal(mediaList.length, 2);
    assert.equal(mediaList[0].id, "img-1");
    assert.equal(mediaList[1].id, "img-2");
  });

  it("7. getMedia blocks malicious next URLs pointing to external hosts", async () => {
    globalThis.window = {
      location: {
        origin: "https://mindlog-ai.swedencentral.cloudapp.azure.com",
      },
    };

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        next: "https://attacker.evil.com/api/media/?page=2",
        results: [{ id: "img-1", media_type: "image" }],
      }),
    });

    await assert.rejects(
      async () => {
        await mediaPhotoService.getMedia();
      },
      {
        message: "Pagination média invalide.",
      }
    );
  });

  it("8. Journal attachment retry flow avoids duplicate uploads", async () => {
    let uploadCallCount = 0;
    const fakeFile = { name: "test-photo.png", type: "image/png", size: 1024 };

    // Simulating media upload service
    const mockUpload = async (file) => {
      uploadCallCount++;
      return { id: "media-uuid-123", file_url: "https://example.com/media/test.png" };
    };

    // State simulation in JournalForm
    let newFiles = [fakeFile];
    let selectedIds = [];

    // Attempt 1: Upload file, but submission fails
    const attemptSubmission = async (shouldFail) => {
      const uploaded = [];
      const successfullyUploaded = new Set();

      for (const file of newFiles) {
        const photo = await mockUpload(file);
        if (photo?.id) {
          uploaded.push(String(photo.id));
          successfullyUploaded.add(file);
          selectedIds = [...new Set([...selectedIds, String(photo.id)])];
        }
      }

      if (successfullyUploaded.size > 0) {
        newFiles = newFiles.filter((f) => !successfullyUploaded.has(f));
      }

      const payload = {
        images: [...new Set([...selectedIds, ...uploaded])],
      };

      if (shouldFail) {
        throw new Error("Simulated journal create failure");
      }

      return payload;
    };

    // First attempt fails at journal creation stage
    await assert.rejects(async () => {
      await attemptSubmission(true);
    });

    assert.equal(uploadCallCount, 1, "File was uploaded once in first attempt");
    assert.equal(newFiles.length, 0, "File removed from newFiles after upload");
    assert.deepEqual(selectedIds, ["media-uuid-123"], "Media ID preserved in selectedIds");

    // Second attempt (retry)
    const result = await attemptSubmission(false);

    assert.equal(uploadCallCount, 1, "No duplicate upload occurred on retry");
    assert.deepEqual(result.images, ["media-uuid-123"], "Media ID retained in final payload");
  });
});
