import {describe,it,expect} from "vitest";
import {waiverApplies,waiverQuoteHash} from "@/lib/waiver-policy";
describe("waiver requirements",()=>{
 it("requires whole-service waivers and only the chosen package's waiver",()=>{expect(waiverApplies("","silver")).toBe(true);expect(waiverApplies("gold","gold")).toBe(true);expect(waiverApplies("gold","silver")).toBe(false);expect(waiverApplies("gold")).toBe(false);});
 it("invalidates signatures when the quote price, version, or expiry changes",()=>{
 const quote={id:"quote1",amountCents:10000,depositAmountCents:5000,expiresAt:new Date("2027-01-01"),lineItemsJson:{version:1}};
 const hash=waiverQuoteHash(quote);expect(waiverQuoteHash({...quote})).toBe(hash);
 expect(waiverQuoteHash({...quote,amountCents:11000})).not.toBe(hash);
 expect(waiverQuoteHash({...quote,lineItemsJson:{version:2}})).not.toBe(hash);
 expect(waiverQuoteHash({...quote,expiresAt:new Date("2027-02-01")})).not.toBe(hash);
 });
});
