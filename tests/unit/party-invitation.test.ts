import { describe, expect, it } from "vitest";
import { getPartyInvitation } from "@/lib/party-invitation";

describe("party invitation links", () => {
  it("accepts Partiful and both Luma event domains while stripping tracking", () => {
    expect(getPartyInvitation("https://partiful.com/e/my-event?invite=secret")).toEqual({provider: "partiful", url: "https://partiful.com/e/my-event"});
    for (const host of ["lu.ma", "luma.com"]) expect(getPartyInvitation(`https://${host}/my-event?utm_source=share`)).toEqual({provider: "luma", url: `https://${host}/my-event`});
  });
  it.each(["http://lu.ma/event", "https://lu.ma.attacker.com/event", "https://user:password@lu.ma/event", "https://luma.com/", "https://luma.com/a/b"])("rejects invalid event URLs: %s", value => {
    expect(getPartyInvitation(value)).toBeNull();
  });
});
