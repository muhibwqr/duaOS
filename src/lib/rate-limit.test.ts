import { describe, it, expect } from "vitest";
import { rateLimitSearch, rateLimitRefine } from "./rate-limit";

function mockRequest(ip: string): Request {
  return new Request("http://localhost/api/search", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rate-limit", () => {
  it("allows first request", () => {
    const res = rateLimitSearch(mockRequest("192.168.1.1"));
    expect(res.ok).toBe(true);
    expect(res.retryAfter).toBeUndefined();
  });

  it("allows requests from different IPs", () => {
    expect(rateLimitSearch(mockRequest("10.0.0.1")).ok).toBe(true);
    expect(rateLimitSearch(mockRequest("10.0.0.2")).ok).toBe(true);
  });

  it("refine has separate limit from search", () => {
    const req = mockRequest("127.0.0.99");
    expect(rateLimitSearch(req).ok).toBe(true);
    expect(rateLimitRefine(req).ok).toBe(true);
  });
});
