import { test } from "node:test";
import assert from "node:assert/strict";
import {
  uploadResumable,
  uploadFingerprint,
  transferRoots,
  transferItems,
} from "../lib/transfers.ts";
import api, { ApiRequestError } from "../lib/api.ts";

const file = () =>
  new File([new Uint8Array(600000).fill(7)], "data +%.bin", {
    lastModified: 100,
  });
const originalFetch = globalThis.fetch;

test("uploads chunks with server-acknowledged progress and preserves authentication", async () => {
  const input = file();
  let offset = 0;
  let created = false;
  const progress: number[] = [];
  api.setToken("test-session");
  globalThis.fetch = async (_url, init) => {
    assert.equal(
      (init?.headers as Record<string, string>)["X-Auth"],
      "test-session",
    );
    if (init?.method === "HEAD") return new Response(null, { status: 404 });
    if (init?.method === "POST") {
      created = true;
      assert.equal(
        (init.headers as Record<string, string>)["Upload-Length"],
        "600000",
      );
      return new Response(null, { status: 201 });
    }
    assert.ok(created);
    assert.equal(
      Number((init?.headers as Record<string, string>)["Upload-Offset"]),
      offset,
    );
    offset += (init?.body as Blob).size;
    return new Response(null, {
      status: 204,
      headers: { "Upload-Offset": String(offset) },
    });
  };
  try {
    assert.equal(
      await uploadResumable(input, "/chunks/data +%.bin", {
        ownerId: 2,
        signal: new AbortController().signal,
        chunkSize: 262144,
        resolve: async () => "skip",
        onProgress: (value) => progress.push(value),
      }),
      "completed",
    );
    assert.equal(offset, input.size);
    assert.equal(progress.at(-1), 100);
    assert.ok(progress.length >= 3);
  } finally {
    globalThis.fetch = originalFetch;
    api.setToken(null);
  }
});

test("pause and resume continue at the confirmed offset without replacing the file", async () => {
  const input = file();
  const fingerprint = await uploadFingerprint(input);
  let offset = 0,
    posts = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "HEAD")
      return offset
        ? new Response(null, {
            headers: {
              "Upload-Offset": String(offset),
              "Upload-Length": String(input.size),
              "Upload-Fingerprint": fingerprint,
            },
          })
        : new Response(null, { status: 404 });
    if (init?.method === "POST") {
      posts++;
      return new Response(null, { status: 201 });
    }
    assert.equal(
      Number((init?.headers as Record<string, string>)["Upload-Offset"]),
      offset,
    );
    offset += (init?.body as Blob).size;
    return new Response(null, {
      status: 204,
      headers: { "Upload-Offset": String(offset) },
    });
  };
  try {
    const controller = new AbortController();
    await assert.rejects(
      uploadResumable(input, "/resume/data.bin", {
        ownerId: 3,
        signal: controller.signal,
        chunkSize: 262144,
        resolve: async () => "resume",
        onProgress: () => controller.abort(),
      }),
      { name: "AbortError" },
    );
    assert.equal(offset, 262144);
    await uploadResumable(input, "/resume/data.bin", {
      ownerId: 3,
      signal: new AbortController().signal,
      chunkSize: 262144,
      resolve: async (conflict) => {
        assert.equal(conflict.canResume, true);
        return "resume";
      },
      onProgress: () => {},
    });
    assert.equal(offset, input.size);
    assert.equal(posts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a different partial upload cannot be resumed by matching size alone", async () => {
  let patched = false;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "PATCH") patched = true;
    return new Response(null, {
      headers: {
        "Upload-Offset": "10",
        "Upload-Length": "600000",
        "Upload-Fingerprint": "different",
      },
    });
  };
  try {
    const result = await uploadResumable(file(), "/mismatch/data.bin", {
      ownerId: 4,
      signal: new AbortController().signal,
      resolve: async (conflict) => {
        assert.equal(conflict.canResume, false);
        assert.equal(conflict.canReplace, false);
        return "skip";
      },
      onProgress: () => {},
    });
    assert.equal(result, "skipped");
    assert.equal(patched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("replacing a conflicting upload requires an explicit decision", async () => {
  let posts = 0,
    resolved = 0;
  globalThis.fetch = async (url, init) => {
    if (init?.method === "HEAD") return new Response(null, { status: 404 });
    if (init?.method === "POST") {
      posts++;
      if (posts === 1) return new Response(null, { status: 409 });
      assert.match(String(url), /override=true/);
      return new Response(null, { status: 201 });
    }
    return new Response(null, {
      status: 204,
      headers: { "Upload-Offset": "600000" },
    });
  };
  try {
    await uploadResumable(file(), "/replace/data.bin", {
      ownerId: 5,
      signal: new AbortController().signal,
      canReplace: true,
      resolve: async () => {
        resolved++;
        return "replace";
      },
      onProgress: () => {},
    });
    assert.equal(resolved, 1);
    assert.equal(posts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parent selection avoids repeated descendants and copy conflicts use keep-both", async () => {
  const folder = { path: "/folder", name: "folder", isDir: true } as any;
  const child = {
    path: "/folder/file.txt",
    name: "file.txt",
    isDir: false,
  } as any;
  assert.deepEqual(transferRoots([folder, child]), [folder]);
  const original = api.resourceAction;
  let calls = 0;
  api.resourceAction = async (_src, _action, _dst, overwrite, rename) => {
    if (++calls === 1) throw new ApiRequestError("exists", 409);
    assert.equal(overwrite, false);
    assert.equal(rename, true);
  };
  try {
    const result = await transferItems(
      [folder, child],
      "/destination",
      "copy",
      async () => "keep",
    );
    assert.equal(result.completed, 1);
    assert.equal(calls, 2);
    assert.deepEqual(result.errors, []);
  } finally {
    api.resourceAction = original;
  }
});

test("resuming a fully staged file still asks the server to commit it", async () => {
  const input = file();
  const fingerprint = await uploadFingerprint(input);
  let patched = false;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "HEAD")
      return new Response(null, {
        headers: {
          "Upload-Offset": String(input.size),
          "Upload-Length": String(input.size),
          "Upload-Fingerprint": fingerprint,
        },
      });
    assert.equal(init?.method, "PATCH");
    assert.equal((init?.body as Blob).size, 0);
    patched = true;
    return new Response(null, {
      status: 204,
      headers: { "Upload-Offset": String(input.size) },
    });
  };
  try {
    await uploadResumable(input, "/commit/file", {
      ownerId: 6,
      signal: new AbortController().signal,
      resolve: async () => "resume",
      onProgress: () => {},
    });
    assert.equal(patched, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failed resume check is surfaced without creating another upload", async () => {
  let requested = 0;
  globalThis.fetch = async () => {
    requested++;
    return new Response(null, { status: 403 });
  };
  try {
    await assert.rejects(
      uploadResumable(file(), "/denied/file", {
        ownerId: 7,
        signal: new AbortController().signal,
        resolve: async () => {
          throw new Error("not a conflict");
        },
        onProgress: () => {},
      }),
      /403/,
    );
    assert.equal(requested, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keep-both advances past a name already used by another partial upload", async () => {
  const attempts: string[] = [];
  globalThis.fetch = async (url, init) => {
    if (init?.method === "HEAD") return new Response(null, { status: 404 });
    if (init?.method === "GET" || !init?.method)
      return new Response(null, { status: 404 });
    if (init.method === "POST") {
      attempts.push(String(url));
      return new Response(null, {
        status: attempts.length < 3 ? 409 : 201,
        headers: attempts.length === 2 ? { "X-Conflict-Type": "upload" } : {},
      });
    }
    return new Response(null, {
      status: 204,
      headers: { "Upload-Offset": "600000" },
    });
  };
  try {
    await uploadResumable(file(), "/retry-names/data.bin", {
      ownerId: 8,
      signal: new AbortController().signal,
      resolve: async () => "keep",
      onProgress: () => {},
    });
    assert.equal(attempts.length, 3);
    assert.notEqual(attempts[1], attempts[2]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
