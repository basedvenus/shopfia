import type { CSSProperties, ReactNode } from "react";
import type { StorefrontTemplate } from "@/lib/storefront-template-library";
import { templateVariables } from "@/lib/storefront-template-style";
import { sectionDesignStyle } from "@/lib/template-section-design";
import StorefrontFonts from "./storefront-fonts";
import "./storefront-template-library.css";
import "./published-storefront.css";
export function PublishedStorefrontSurface({template,children,className,style}: {template:StorefrontTemplate|null;children:ReactNode;className:string;style:CSSProperties}) {
 return <StorefrontFonts><div style={{containerType:"inline-size",containerName:"storefront-preview"}}><div data-template={template?.id} data-composition={template?.composition} data-mask={template?.imageMask} data-sections={template?.sections} data-services={template?.services} data-button={template?.button ?? "pill"} data-frame={template?.frame ?? "none"} className={`${className} ${template ? "template-surface published-storefront" : ""}`} style={{...style,...(template ? templateVariables(template):{}),...sectionDesignStyle(template?.backgroundDesign),"--storefront-subheading":template?.subheadingFamily ?? template?.headingFamily,"--storefront-subheading-style":template?.subheadingStyle ?? "normal"} as CSSProperties}>{children}</div></div></StorefrontFonts>;
}
