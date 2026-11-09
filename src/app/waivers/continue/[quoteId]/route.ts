import {assertSameOrigin} from "@/lib/security/request";
import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prepareQuoteCheckout} from "@/lib/services/quote-checkout";
import {enforceRequestRateLimit} from "@/lib/security/request";
export async function POST(request:Request,{params}:{params:Promise<{quoteId:string}>}){
 if(!assertSameOrigin(request))return new Response("Invalid origin.",{status:403});
 const limited=enforceRequestRateLimit(request,[{key:"waiver-checkout:ip:{ip}",limit:10,intervalMs:60000}]);if(limited)return limited;
 const session=await auth();if(!session?.user?.id)return NextResponse.redirect(new URL("/account?next=login",request.url),303);
 const {quoteId}=await params,form=await request.formData();
 try{const result=await prepareQuoteCheckout({quoteId,buyerId:session.user.id,origin:new URL(request.url).origin,payMode:form.get("payMode")==="full"?"full":"deposit"});return NextResponse.redirect(result.checkoutUrl,303);}catch(error){return new Response(error instanceof Error?error.message:"Could not continue to payment.",{status:400});}
}
