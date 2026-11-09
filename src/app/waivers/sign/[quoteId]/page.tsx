import {auth} from "@/auth";
import {redirect,notFound} from "next/navigation";
import {buyerQuoteWaivers} from "@/lib/services/waivers";
import {WaiverSigner} from "@/components/vendor/waiver-signer";
export const dynamic="force-dynamic";
export default async function SignWaivers({params,searchParams}:{params:Promise<{quoteId:string}>;searchParams:Promise<{payMode?:string}>}){
 const {quoteId}=await params,session=await auth();if(!session?.user?.id)redirect("/account?next=login");
 const info=await buyerQuoteWaivers(quoteId,session.user.id).catch(()=>null);if(!info)notFound();
 const query=await searchParams;
 return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8"><h1 className="text-3xl font-semibold">Required waivers</h1><WaiverSigner quoteId={quoteId} quoteHash={info.quoteHash} documents={info.required.map(doc=>({id:doc.id,title:doc.title,signed:!info.pending.some(p=>p.id===doc.id)}))} payMode={query.payMode==="full"?"full":"deposit"}/></main>;
}
