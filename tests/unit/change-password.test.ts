import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({auth:vi.fn(),limit:vi.fn(),find:vi.fn(),update:vi.fn(),compare:vi.fn(),hash:vi.fn(),email:vi.fn()}));
vi.mock("@/lib/email",()=>({sendPasswordChangedEmail:mocks.email}));
vi.mock("@/auth",()=>({auth:mocks.auth}));
vi.mock("@/lib/db",()=>({db:{user:{findUnique:mocks.find,updateMany:mocks.update}}}));
vi.mock("@/lib/security/request",()=>({checkServerActionRateLimit:mocks.limit}));
vi.mock("bcryptjs",()=>({compare:mocks.compare,hash:mocks.hash}));
import { changePasswordAction } from "@/app/actions/change-password";
function form() {const f=new FormData();f.set("currentPassword","old-password");f.set("password","new-password");f.set("confirmPassword","new-password");return f;}
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({user:{id:"signed-in-user"}});mocks.limit.mockResolvedValue({ok:true});mocks.find.mockResolvedValue({passwordHash:"old-hash",email:"account@example.com"});mocks.email.mockResolvedValue({ok:true});mocks.compare.mockResolvedValue(true);mocks.hash.mockResolvedValue("new-hash");mocks.update.mockResolvedValue({count:1});});
it("rejects signed-out requests before accessing passwords",async()=>{mocks.auth.mockResolvedValue(null);expect((await changePasswordAction(form())).ok).toBe(false);expect(mocks.find).not.toHaveBeenCalled();});
it("rejects incorrect current passwords",async()=>{mocks.compare.mockResolvedValue(false);expect((await changePasswordAction(form())).ok).toBe(false);expect(mocks.update).not.toHaveBeenCalled();});
it("rejects mismatched passwords and bcrypt truncation",async()=>{const f=form();f.set("confirmPassword","different");expect((await changePasswordAction(f)).ok).toBe(false);f.set("password","🙂".repeat(20));f.set("confirmPassword","🙂".repeat(20));expect((await changePasswordAction(f)).ok).toBe(false);expect(mocks.hash).not.toHaveBeenCalled();});
it("requires recovery for accounts without a password",async()=>{mocks.find.mockResolvedValue({passwordHash:null});expect((await changePasswordAction(form())).ok).toBe(false);expect(mocks.update).not.toHaveBeenCalled();});
it("updates only the authenticated account and expected password hash",async()=>{expect((await changePasswordAction(form())).ok).toBe(true);expect(mocks.update).toHaveBeenCalledWith({where:{id:"signed-in-user",passwordHash:"old-hash"},data:{passwordHash:"new-hash"}});});
it("rejects rate limits and concurrent password changes",async()=>{mocks.limit.mockResolvedValueOnce({ok:false});expect((await changePasswordAction(form())).ok).toBe(false);mocks.update.mockResolvedValue({count:0});expect((await changePasswordAction(form())).ok).toBe(false);});

it("emails the stored account address only after a successful change",async()=>{await changePasswordAction(form());expect(mocks.email).toHaveBeenCalledWith("account@example.com");mocks.email.mockClear();mocks.compare.mockResolvedValue(false);await changePasswordAction(form());expect(mocks.email).not.toHaveBeenCalled();});
it("preserves a successful change if email delivery fails",async()=>{mocks.email.mockRejectedValue(new Error("SMTP failed"));const result=await changePasswordAction(form());expect(result.ok).toBe(true);expect(result).toHaveProperty("warning");});
