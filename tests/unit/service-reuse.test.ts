import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),business:vi.fn(),offerings:vi.fn()}));
vi.mock("@/auth",()=>({auth:mocks.auth}));
vi.mock("@/lib/db",()=>({db:{vendorProfile:{findFirst:mocks.business},offering:{findMany:mocks.offerings}}}));
vi.mock("@/lib/businesses",()=>({businessManagerWhere:()=>({userId:"owner"})}));
import {loadPastServices} from "@/app/actions/service-presets";
describe("saved service reuse",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({user:{id:"owner",role:"USER"}});mocks.business.mockResolvedValue({id:"business"});});
 it("requires sign in before reading service descriptions",async()=>{mocks.auth.mockResolvedValue(null);await expect(loadPastServices("business")).rejects.toThrow();expect(mocks.offerings).not.toHaveBeenCalled();});
 it("rejects a business the user cannot manage",async()=>{mocks.business.mockResolvedValue(null);await expect(loadPastServices("other")).rejects.toThrow();expect(mocks.offerings).not.toHaveBeenCalled();});
 it("reads only this business and adapts legacy pricing",async()=>{mocks.offerings.mockResolvedValue([{id:"old",title:"Pole rental",description:"A portable pole rental",faqJson:null,basePriceCents:10000}]);const result=await loadPastServices("business");expect(mocks.offerings.mock.calls[0][0].where).toEqual({vendorId:"business"});expect(result[0].pricing.base).toEqual({type:"fixed",rate:10000});expect(result[0].pricing.name).toBe("Pole rental");});
});
