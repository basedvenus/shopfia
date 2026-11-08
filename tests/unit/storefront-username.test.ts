import {beforeEach, expect, it, vi} from "vitest";
const mocks=vi.hoisted(()=>({find:vi.fn(),limit:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{vendorProfile:{findFirst:mocks.find}}}));
vi.mock("@/lib/security/request",()=>({checkServerActionRateLimit:mocks.limit}));
import {checkStorefrontUsernameAction} from "@/app/actions/storefront-username";
beforeEach(()=>{vi.resetAllMocks();mocks.find.mockResolvedValue(null);mocks.limit.mockResolvedValue({ok:true});});
it.each(["a", "bad/path", "account"])("rejects invalid or reserved business username %s",async value=>{
 expect((await checkStorefrontUsernameAction(value)).available).toBe(false);
 expect(mocks.find).not.toHaveBeenCalled();
});
it("checks both business handles and storefront paths",async()=>{
 expect(await checkStorefrontUsernameAction("venus-events")).toEqual({available:true});
 expect(mocks.find).toHaveBeenCalledWith({where:{OR:[{slug:"venus-events"},{username:"venus-events"}]},select:{id:true}});
 mocks.find.mockResolvedValue({id:"taken"});
 expect((await checkStorefrontUsernameAction("venus-events")).available).toBe(false);
});
it("does not query after rate limiting",async()=>{
 mocks.limit.mockResolvedValue({ok:false});
 expect((await checkStorefrontUsernameAction("venus-events")).available).toBe(false);
 expect(mocks.find).not.toHaveBeenCalled();
});
