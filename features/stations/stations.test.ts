import { describe, expect, it } from "vitest";

import { buildStations, searchStations } from "@/features/stations";

describe("station search", () => {
  const stations = buildStations(["강남", "강남구청", "잠실", "잠실", "화랑대", "강변"]);

  it("suggests stations whose official English name contains the partial input", () => {
    expect(searchStations(stations, "gang").map((s) => s.nameEn)).toEqual([
      "Gangnam",
      "Gangnamgu Office",
      "Gangbyeon (Dongseoul Bus Terminal)",
    ]);
  });

  it("accepts a Korean station name", () => {
    expect(searchStations(stations, "잠실").map((s) => s.nameEn)).toEqual(["Jamsil (Songpagu Office)"]);
  });

  it("lists a transfer station once", () => {
    expect(stations.filter((s) => s.nameKo === "잠실")).toHaveLength(1);
  });

  it("joins a CSV name that carries a parenthesized note", () => {
    expect(searchStations(stations, "hwarang")[0]).toMatchObject({
      nameKo: "화랑대",
      slug: "hwarangdae-seoul-women-s-univ",
    });
  });

  it("drops stations without an official English name", () => {
    expect(buildStations(["없는역"])).toEqual([]);
  });

  it("returns nothing for blank input", () => {
    expect(searchStations(stations, "  ")).toEqual([]);
  });
});
