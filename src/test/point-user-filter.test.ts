import { describe, expect, it } from "vitest";
import { filterPointUsers } from "@/components/admin/hai/point-user-filter";

const users = [
  { id: "free-1", nickname: "张老师", phone: "138 0013 8000", access_level: "free" as const },
  { id: "plus-1", nickname: "Alice", phone: "13900139000", access_level: "plus" as const },
  { id: "pro-1", nickname: "李校长", phone: "136-0013-6000", access_level: "pro" as const },
  { id: "plus2015-1", nickname: "王老师", phone: "13500135000", access_level: "plus2015" as const },
];

describe("HAI point user filters", () => {
  it("filters by username or formatted phone number", () => {
    expect(filterPointUsers(users, "alice", "all").map((user) => user.id)).toEqual(["plus-1"]);
    expect(filterPointUsers(users, "1380013", "all").map((user) => user.id)).toEqual(["free-1"]);
    expect(filterPointUsers(users, "136 0013", "all").map((user) => user.id)).toEqual(["pro-1"]);
  });

  it("filters by membership level", () => {
    expect(filterPointUsers(users, "", "free").map((user) => user.id)).toEqual(["free-1"]);
    expect(filterPointUsers(users, "", "plus").map((user) => user.id)).toEqual(["plus-1"]);
    expect(filterPointUsers(users, "", "pro").map((user) => user.id)).toEqual(["pro-1"]);
    expect(filterPointUsers(users, "", "plus2015").map((user) => user.id)).toEqual(["plus2015-1"]);
  });

  it("combines keyword and membership filters", () => {
    expect(filterPointUsers(users, "老师", "plus2015").map((user) => user.id)).toEqual(["plus2015-1"]);
    expect(filterPointUsers(users, "老师", "plus")).toEqual([]);
  });
});
