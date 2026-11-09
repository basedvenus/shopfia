import { expect, it } from "vitest";
import { getProfilePhotoType } from "@/lib/profile-photo-file";
it("accepts native iPhone formats for conversion",()=>{expect(getProfilePhotoType({type:"image/heic",name:"IMG_1234.HEIC"})).toBe("image/heic");expect(getProfilePhotoType({type:"image/heif",name:"photo.heif"})).toBe("image/heif");});
it("recognizes photos whose mobile provider omits the MIME type",()=>{expect(getProfilePhotoType({type:"",name:"IMG_1234.JPG"})).toBe("image/jpeg");expect(getProfilePhotoType({type:"application/octet-stream",name:"photo.png"})).toBe("image/png");});
it("rejects unsupported or conflicting file types",()=>{expect(getProfilePhotoType({type:"image/svg+xml",name:"photo.jpg"})).toBeNull();expect(getProfilePhotoType({type:"",name:"photo.html"})).toBeNull();});
