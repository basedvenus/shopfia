import { Children, isValidElement, type CSSProperties, type ReactNode } from "react";
import type { StorefrontTemplate } from "@/lib/storefront-template-library";
import { templateVariables } from "@/lib/storefront-template-style";
import { sectionDesignStyle } from "@/lib/template-section-design";
import StorefrontFonts from "./storefront-fonts";
import "./storefront-template-library.css";
import "./published-storefront.css";
export function PublishedStorefrontSurface({template,children,className,style}: {template:StorefrontTemplate|null;children:ReactNode;className:string;style:CSSProperties}) {
 const orderedChildren = Children.toArray(children).sort((a,b)=>{
   const priority=(node:ReactNode)=>isValidElement<{style?:CSSProperties;order?:number}>(node) ? Number(node.props.order ?? node.props.style?.order ?? 0) : 0;
   return priority(a)-priority(b);
 });
 return <StorefrontFonts><div style={{containerType:"inline-size",containerName:"storefront-preview"}}><div data-template={template?.id} data-composition={template?.composition} data-mask={template?.imageMask} data-sections={template?.sections} data-services={template?.services} data-button={template?.button ?? "pill"} data-frame={template?.frame ?? "none"} className={`${className} ${template ? "template-surface published-storefront" : ""}`} style={{...style,...(template ? templateVariables(template):{}),...sectionDesignStyle(template?.backgroundDesign),"--storefront-subheading":template?.subheadingFamily ?? template?.headingFamily,"--storefront-subheading-style":template?.subheadingStyle ?? "normal"} as CSSProperties}>{orderedChildren}</div></div></StorefrontFonts>;
}
