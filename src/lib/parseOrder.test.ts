import { describe, expect, it } from "vitest";
import { extractQty, parseOrder } from "./parseOrder";
import type { MenuItem } from "./types";

const names: [string, number, string?][] = [
  ["MAHAMRI", 10, "mandazi,mandasi,mandaazi"], ["KAIMATI", 10], ["CHAPATI", 25, "chapo,chapos,chapatis"],
  ["SMOKIE", 50], ["SAUSAGE/CHOMA SAUSAGE", 50, "sausage"], ["MSHIKAKI", 50, "mishikaki"], ["BEEF ROLL", 150],
  ["DONUT", 20], ["HOT DOG", 100, "hotdog"], ["SCRAMBLED EGGS", 100], ["OMELETTE", 100], ["SHAWARMA", 250, "shwarma"],
  ["TEA", 50, "chai"], ["SPICED TEA", 70], ["SPECIAL TEA", 100], ["BLACK COFFEE", 50], ["WHITE COFFEE", 70],
  ["JUICE", 100], ["JUICE (150)", 150], ["MINERAL WATER 500ML", 50, "water"], ["SODA 300ML", 60], ["SODA 500ML", 100],
  ["UGALI", 50], ["UGALI (70)", 70], ["RICE", 100], ["UGALI MIX (Greens with meat)", 200, "ugali mix"],
  ["OMENA UGALI", 200, "ugali omena,omena"], ["KIENYEJI VEGETABLES", 100], ["GITHERI SPECIAL", 150, "githeri"],
  ["BEEF CHOMA", 250], ["BEEF FRY", 300], ["BEEF", 1000], ["MBUZI CHOMA/FRY", 300, "mbuzi"], ["CHICKEN KIENYEJI", 400],
  ["CHIPS (plain)", 100, "chips"], ["CHIPS MASALA", 200], ["SPICED CHIPS", 150], ["MUKIMO (Vegetable / Beef soup)", 150, "mukimo"],
];
const menu: MenuItem[] = names.map(([item_name, selling_price, aliases], i) => ({
  id: String(i), item_name, category: "x", selling_price, unit_type: null, track_stock: true,
  sort_order: i, stock_item: null, aliases: aliases ?? null,
}));

const read = (text: string) => parseOrder(text, menu).map((l) => `${l.item?.item_name ?? "?" + l.query} x${l.qty}`);

describe("extractQty", () => {
  it("reads the common styles", () => {
    expect(extractQty("2 chai")).toEqual({ query: "chai", qty: 2 });
    expect(extractQty("chai x2")).toEqual({ query: "chai", qty: 2 });
    expect(extractQty("chai(2)")).toEqual({ query: "chai", qty: 2 });
    expect(extractQty("3x mandazi")).toEqual({ query: "mandazi", qty: 3 });
    expect(extractQty("chai 2")).toEqual({ query: "chai", qty: 2 });
    expect(extractQty("chai")).toEqual({ query: "chai", qty: 1 });
  });
  it("does not mistake sizes for quantities", () => {
    expect(extractQty("soda 300").qty).toBe(1);
    expect(extractQty("water 500ml").qty).toBe(1);
  });
});

describe("parseOrder", () => {
  it("handles the examples from the plan", () => {
    expect(read("chai+chapo")).toEqual(["TEA x1", "CHAPATI x1"]);
    expect(read("2 chai, 3 mandazi")).toEqual(["TEA x2", "MAHAMRI x3"]);
    expect(read("tea(2)+chapati(3)")).toEqual(["TEA x2", "CHAPATI x3"]);
    expect(read("chai x2 + chapo")).toEqual(["TEA x2", "CHAPATI x1"]);
    expect(read("chai na chapo")).toEqual(["TEA x1", "CHAPATI x1"]);
    expect(read("tea and mandazi")).toEqual(["TEA x1", "MAHAMRI x1"]);
  });
  it("fixes small typing mistakes", () => {
    expect(read("chapoti")).toEqual(["CHAPATI x1"]);
    expect(read("white coffe")).toEqual(["WHITE COFFEE x1"]);
    expect(read("shawarmaa")).toEqual(["SHAWARMA x1"]);
  });
  it("prefers the exact name over the bracket variant", () => {
    expect(read("juice")).toEqual(["JUICE x1"]);
    expect(read("ugali")).toEqual(["UGALI x1"]);
    expect(read("juice 150")).toEqual(["JUICE (150) x1"]);
  });
  it("asks instead of guessing when a word is unclear", () => {
    const [beef] = parseOrder("beef", menu);
    // "beef" is also a real menu item (by the kilo), so it is accepted. Remove it to see the question:
    expect(beef!.item?.item_name).toBe("BEEF");
    const noKilo = menu.filter((m) => m.item_name !== "BEEF");
    const [ask] = parseOrder("beef", noKilo);
    expect(ask!.item).toBeNull();
    expect(ask!.suggestions.map((s) => s.item_name)).toEqual(expect.arrayContaining(["BEEF FRY", "BEEF CHOMA"]));
    const [soda] = parseOrder("soda", menu);
    expect(soda!.item).toBeNull();
    expect(soda!.suggestions.length).toBeGreaterThan(1);
    const [kienyeji] = parseOrder("kienyeji", menu);
    expect(kienyeji!.item).toBeNull();
  });
  it("does not guess when two items are typed without a separator", () => {
    const [l] = parseOrder("ugali beef", menu);
    expect(l!.item).toBeNull();
  });
  it("uses words the phone has learned", () => {
    const lines = parseOrder("beef", menu.filter((m) => m.item_name !== "BEEF"), { beef: "BEEF FRY" });
    expect(lines[0]!.item?.item_name).toBe("BEEF FRY");
  });
  it("copes with empty and messy input", () => {
    expect(parseOrder("", menu)).toEqual([]);
    expect(parseOrder(" + , ", menu)).toEqual([]);
    expect(read("xyzzy")[0]).toBe("?xyzzy x1");
  });
});
