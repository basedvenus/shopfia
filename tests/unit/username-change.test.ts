import { expect, it } from "vitest";
import { canChangeUsername, USERNAME_CHANGE_INTERVAL_MS } from "@/lib/username-change";
it("allows a first change",()=>{expect(canChangeUsername(null)).toBe(true);});
it("blocks changes before 30 days and allows them at the boundary",()=>{const last=new Date("2026-11-01T00:00:00Z");expect(canChangeUsername(last,new Date(last.getTime()+USERNAME_CHANGE_INTERVAL_MS-1))).toBe(false);expect(canChangeUsername(last,new Date(last.getTime()+USERNAME_CHANGE_INTERVAL_MS))).toBe(true);});
