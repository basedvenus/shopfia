import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),origin:vi.fn(),find:vi.fn(),update:vi.fn(),saved:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/auth",()=>({auth:mocks.auth}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/lib/security/request",()=>({assertSameOrigin:mocks.origin,enforceRequestRateLimit:()=>null}));
vi.mock("@/lib/db",()=>({db:{$transaction:async (fn: (tx:unknown)=>unknown)=>fn({user:{findUnique:mocks.find,updateMany:mocks.update,findUniqueOrThrow:mocks.saved}})}}));
import { PATCH } from "@/app/api/uploads/avatar/route";
const image="/api/users/user_1/avatar?v=123";
const crop={x:40,y:70,zoom:2};
function request(overrides={}){return new Request("https://www.shopfia.app/api/uploads/avatar",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({image,crop,...overrides})});}
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({user:{id:"user_1"}});mocks.origin.mockReturnValue(true);mocks.find.mockResolvedValue({id:"user_1",image,avatar:null});mocks.update.mockResolvedValue({count:1});mocks.saved.mockResolvedValue({id:"user_1",image,avatar:null,username:"host",imageCrop:{...crop,aspectRatio:1,brightness:1,saturation:1}});});
it("saves crop immediately and revalidates the public profile",async()=>{const response=await PATCH(request());expect(response.status).toBe(200);expect(mocks.update).toHaveBeenCalledWith({where:{id:"user_1",image},data:{imageCrop:{...crop,aspectRatio:1,brightness:1,saturation:1}}});expect(mocks.revalidate).toHaveBeenCalledWith("/profiles/host");expect((await response.json()).persisted).toBe(true);});
it("rejects a stale image without overwriting a replacement photo",async()=>{const response=await PATCH(request({image:"/old.jpg"}));expect(response.status).toBe(409);expect(mocks.update).not.toHaveBeenCalled();});
it("requires the signed-in user and same-origin request",async()=>{mocks.auth.mockResolvedValueOnce(null);expect((await PATCH(request())).status).toBe(401);mocks.origin.mockReturnValue(false);expect((await PATCH(request())).status).toBe(403);expect(mocks.update).not.toHaveBeenCalled();});
it("rejects malformed crop geometry",async()=>{expect((await PATCH(request({crop:{...crop,zoom:99}}))).status).toBe(400);expect(mocks.update).not.toHaveBeenCalled();});
