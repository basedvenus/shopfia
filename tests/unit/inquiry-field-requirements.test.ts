import {describe,it,expect} from "vitest";
import {publicInquirySchema} from "@/lib/validators/inquiry";
const inquiry={vendorProfileId:"cmw8i14x20002f0rcgbt971qt",name:"Jane Customer",eventDate:"2026-12-12",eventLocation:"",message:"I would like to book this for my party."};
describe("inquiry field requirements",()=>{
 it("allows leaving event location, budget and guest count blank",()=>{expect(publicInquirySchema.safeParse(inquiry).success).toBe(true);});
 it("still requires an event date",()=>{expect(publicInquirySchema.safeParse({...inquiry,eventDate:""}).success).toBe(false);});
});
