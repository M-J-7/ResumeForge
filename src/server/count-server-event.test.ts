/**
 * The server counts what it saw happen with the same refusals a page makes:
 * not for a browser that sends Global Privacy Control or Do Not Track, not
 * for a crawler, and not outside a request at all.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const incoming = { headers: new Headers() as Headers | null };

vi.mock("next/headers", () => ({
  headers: async () => {
    if (!incoming.headers) throw new Error("headers() was called outside a request scope");
    return incoming.headers;
  },
}));

const { countServerEvent } = await import("./count-server-event");
const { eventCounter } = await import("./events");

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36";

let record: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  record = vi.spyOn(eventCounter, "record").mockReturnValue(true);
});

afterEach(() => {
  record.mockRestore();
});

describe("countServerEvent", () => {
  it("counts the name for an ordinary browser", async () => {
    incoming.headers = new Headers({ "user-agent": BROWSER });
    await countServerEvent("signin:complete");
    expect(record).toHaveBeenCalledWith("signin:complete");
  });

  it("does not count a browser that sends Sec-GPC or DNT", async () => {
    for (const header of ["sec-gpc", "dnt"]) {
      incoming.headers = new Headers({ "user-agent": BROWSER, [header]: "1" });
      await countServerEvent("signin:email");
    }
    expect(record).not.toHaveBeenCalled();
  });

  it("does not count a crawler, or anything outside a request", async () => {
    incoming.headers = new Headers({ "user-agent": "Googlebot/2.1" });
    await countServerEvent("signin:google");
    incoming.headers = null;
    await countServerEvent("signin:google");
    expect(record).not.toHaveBeenCalled();
  });
});
