export function readSocialVisibility(booking:unknown,draft?:unknown): {instagram:boolean;tiktok:boolean} {
 const object=(value:unknown):Record<string,unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
 const draftRecord=object(draft);const design=object(draftRecord.design ?? object(booking)._design);const visibility=object(design.socialVisibility);
 return {instagram:visibility.instagram!==false,tiktok:visibility.tiktok!==false};
}
