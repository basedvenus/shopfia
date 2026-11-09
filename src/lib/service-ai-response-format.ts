// Strict provider output keeps the draft shape consistent before local validation.
const string={type:"string"};
const amount={type:["integer","null"],minimum:0,maximum:100000000};
const object=(properties:Record<string,unknown>)=>({type:"object",additionalProperties:false,properties,required:Object.keys(properties)});
const array=(items:unknown,maxItems:number)=>({type:"array",items,maxItems});
export const serviceDraftResponseFormat={type:"json_schema",json_schema:{name:"service_listing_draft",strict:true,schema:object({
 name:{type:"string",maxLength:120},description:{type:"string",maxLength:2000},inclusions:{type:"string",maxLength:2000},
 pricingType:{type:"string",enum:["fixed","hour","person","item","package","custom"]},rateCents:amount,
 minimum:{type:["number","null"],exclusiveMinimum:0,maximum:100000},itemLabel:{type:"string",maxLength:100},
 packages:array(object({name:{type:"string",maxLength:120},priceCents:amount,inclusions:{type:"string",maxLength:2000},coverage:{type:"string",maxLength:500}}),12),
 addons:array(object({name:{type:"string",maxLength:120},description:{type:"string",maxLength:500},priceCents:amount}),20),
 menus:array(object({name:{type:"string",maxLength:120},options:array({type:"string",maxLength:200},50),selection:{type:"string",enum:["display","single","multiple"]},maxChoices:{type:["integer","null"],minimum:1,maximum:50}}),12),
 questions:array({...string,maxLength:300},8)
})}};
