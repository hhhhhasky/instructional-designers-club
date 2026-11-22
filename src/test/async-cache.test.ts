import { afterEach, expect, it, vi } from "vitest";
import { createAsyncCache } from "@/lib/async-cache";

afterEach(() => vi.restoreAllMocks());

it("uses its memory cache when the browser blocks access to sessionStorage", async () => {
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
    throw new DOMException("Session storage is unavailable", "SecurityError");
  });
  const fetcher = vi.fn().mockResolvedValueOnce("catalog").mockResolvedValueOnce("updated catalog");
  const cache = createAsyncCache({ key: "course-catalog-test", ttlMs: 1000, storage: "session", fetcher });

  await expect(cache.get()).resolves.toBe("catalog");
  await expect(cache.get()).resolves.toBe("catalog");
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(cache.get({ fresh: true })).resolves.toBe("updated catalog");
  expect(cache.peek()).toBe("updated catalog");
  cache.clear();
  expect(cache.peek()).toBeNull();
});
