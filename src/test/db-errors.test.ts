import { describe, expect, it } from "vitest";
import {
  dataFailure,
  dataSuccess,
  isMissingBackendContract,
  toDataAccessError,
} from "@/db/errors";

describe("data access errors", () => {
  it("only marks known missing schema/function errors as compatibility gaps", () => {
    expect(isMissingBackendContract({ code: "PGRST202" })).toBe(true);
    expect(isMissingBackendContract({ code: "42883" })).toBe(true);
    expect(isMissingBackendContract({ code: "42501" })).toBe(false);
    expect(isMissingBackendContract(new TypeError("Failed to fetch"))).toBe(
      false,
    );
  });

  it("keeps permission, network, not-found and unknown states distinct", () => {
    expect(toDataAccessError("读取", { code: "42501" }).code).toBe(
      "permission",
    );
    expect(
      toDataAccessError("读取", new TypeError("Failed to fetch")).code,
    ).toBe("network");
    expect(toDataAccessError("读取", { status: 404 }).code).toBe("not_found");
    expect(toDataAccessError("读取", new Error("boom")).code).toBe("unknown");
  });

  it("provides an explicit result contract", () => {
    expect(dataSuccess([])).toEqual({ ok: true, data: [] });
    const result = dataFailure("读取课程", { code: "PGRST202" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("contract_missing");
  });
});
