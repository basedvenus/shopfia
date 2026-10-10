import { describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({ nextAuth:vi.fn((_config:unknown)=>({})) }));
vi.mock("next-auth",()=>({default:mocks.nextAuth}));
vi.mock("@auth/prisma-adapter",()=>({PrismaAdapter:vi.fn(()=>({}))}));
vi.mock("@/lib/db",()=>({db:{}}));
vi.mock("@/lib/email",()=>({sendWelcomeEmail:vi.fn()}));
vi.mock("@/lib/auth/provider-config",()=>({authProviderConfig:{googleEnabled:true,googleClientId:"test",googleClientSecret:"test",emailEnabled:false,authSecret:"test",email:{}}}));
import "@/auth";
describe("Google login profile photo consent",()=>{
 it("keeps login identity fields but never imports the provider picture",()=>{
  const config=mocks.nextAuth.mock.calls[0][0] as {providers:Array<{id?:string;options?:{profile?:(profile:Record<string,string>)=>Record<string,unknown>}}>};
  const google=config.providers.find((provider)=>provider.id==="google");
  const result=google?.options?.profile?.({sub:"google_1",email:"owner@example.com",name:"Owner",picture:"https://lh3.googleusercontent.com/provider"});
  expect(result).toMatchObject({id:"google_1",email:"owner@example.com",name:"Owner",image:null});
  expect(google?.options).not.toHaveProperty("allowDangerousEmailAccountLinking");
 });
});
