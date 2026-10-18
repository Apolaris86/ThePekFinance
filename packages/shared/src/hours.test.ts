import { describe, expect, it } from "vitest";
import { pollInterval, sessionStatus } from "./hours";

// Mon 2026-10-19 at given UTC time
const mon = (utc: string) => new Date(`2026-10-19T${utc}:00Z`);

describe("sessionStatus", () => {
  it("US is open 9:30-16:00 New York time (EDT = UTC-4)", () => {
    expect(sessionStatus("US", mon("13:29"))).toBe("closed");
    expect(sessionStatus("US", mon("13:30"))).toBe("open");
    expect(sessionStatus("US", mon("19:59"))).toBe("open");
    expect(sessionStatus("US", mon("20:00"))).toBe("closed");
  });

  it("SGX has a lunch break (SGT = UTC+8)", () => {
    expect(sessionStatus("SGX", mon("01:00"))).toBe("open");
    expect(sessionStatus("SGX", mon("04:30"))).toBe("break");
    expect(sessionStatus("SGX", mon("05:00"))).toBe("open");
    expect(sessionStatus("SGX", mon("09:00"))).toBe("closed");
  });

  it("Paris follows CEST (UTC+2) in October before the clock change", () => {
    expect(sessionStatus("EPA", mon("06:59"))).toBe("closed");
    expect(sessionStatus("EPA", mon("07:00"))).toBe("open");
    expect(sessionStatus("EPA", mon("15:29"))).toBe("open");
    expect(sessionStatus("EPA", mon("15:30"))).toBe("closed");
  });

  it("is closed on weekends", () => {
    expect(sessionStatus("US", new Date("2026-10-17T15:00:00Z"))).toBe("closed");
  });
});

describe("pollInterval", () => {
  it("polls fast only while open", () => {
    expect(pollInterval("US", mon("15:00"))).toBe(30_000);
    expect(pollInterval("US", mon("22:00"))).toBe(300_000);
  });
});
