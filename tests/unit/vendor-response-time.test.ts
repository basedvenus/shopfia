import {describe,it,expect} from "vitest";
import {formatResponseTime} from "@/lib/vendor-response-time";
describe("response time label",()=>{it("does not invent a time without replies",()=>expect(formatResponseTime(null)).toBe("Not available yet"));it("formats recorded response durations",()=>{expect(formatResponseTime(30)).toBe("Under 1 minute");expect(formatResponseTime(120)).toBe("2 minutes");expect(formatResponseTime(5400)).toBe("1.5 hours");expect(formatResponseTime(172800)).toBe("2 days");});});
