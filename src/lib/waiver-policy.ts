import {createHash} from "node:crypto";
export {WAIVER_CONSENT} from "./waiver-consent";
export function waiverQuoteHash(quote:{id:string;amountCents:number;depositAmountCents:number|null;expiresAt:Date;lineItemsJson:unknown}){
 return createHash("sha256").update(JSON.stringify({id:quote.id,amountCents:quote.amountCents,depositAmountCents:quote.depositAmountCents,expiresAt:quote.expiresAt.toISOString(),lineItemsJson:quote.lineItemsJson})).digest("hex");
}
export function waiverApplies(packageId:string,selectedPackageId?:string){return packageId===""||packageId===selectedPackageId;}
