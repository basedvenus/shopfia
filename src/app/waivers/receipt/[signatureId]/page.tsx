import {auth} from "@/auth";
import {db} from "@/lib/db";
import {businessManagerWhere} from "@/lib/businesses";
import {notFound,redirect} from "next/navigation";
export const dynamic="force-dynamic";
export default async function WaiverReceipt({params}:{params:Promise<{signatureId:string}>}){
 const session=await auth();if(!session?.user?.id)redirect("/account?next=login");
 const {signatureId}=await params,record=await db.waiverSignature.findUnique({where:{id:signatureId},include:{waiver:{select:{id:true,vendorId:true,title:true,fileName:true}}}});if(!record)notFound();
 const manager=record.buyerId===session.user.id||Boolean(await db.vendorProfile.findFirst({where:{id:record.waiver.vendorId,...businessManagerWhere(session.user.id,session.user.role)},select:{id:true}}));if(!manager)notFound();
 return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8"><h1 className="text-3xl font-semibold">Signed waiver</h1><h2 className="text-xl">{record.waiver.title}</h2><dl className="grid gap-3 rounded-2xl border bg-white p-5"><dt className="font-semibold">Electronic signature</dt><dd className="text-2xl italic">{record.signerName}</dd><dt className="font-semibold">Signed</dt><dd>{record.signedAt.toISOString()} (UTC)</dd><dt className="font-semibold">Consent</dt><dd>{record.consentText}</dd><dt className="font-semibold">Booking quote</dt><dd>{record.quoteId}</dd><dt className="font-semibold">Document SHA-256</dt><dd className="break-all text-xs">{record.documentHash}</dd><dt className="font-semibold">Quote version SHA-256</dt><dd className="break-all text-xs">{record.quoteHash}</dd></dl><a className="inline-block underline" href={`/api/waivers/${record.waiverId}`} target="_blank" rel="noreferrer">Open or download the signed document’s original PDF</a><p className="text-sm text-muted-foreground">This record and the original PDF together identify the document signed for this booking. You can print or save this receipt using your browser.</p></main>;
}
