import { Children, isValidElement, type CSSProperties, type ReactNode } from "react";
import type { StorefrontTemplate } from "@/lib/storefront-template-library";
import { templateVariables } from "@/lib/storefront-template-style";
import { sectionDesignStyle } from "@/lib/template-section-design";
import {sectionRows,type SectionLayout} from "@/lib/storefront-section-layout";
import "../editor-preview/storefront-section-layout.css";
import StorefrontFonts from "./storefront-fonts";
import "./storefront-template-library.css";
import "./published-storefront.css";
export function PublishedStorefrontSurface({template,children,className,style,sectionOrder=[],sectionLayout={}}: {sectionOrder?:string[];sectionLayout?:SectionLayout;template:StorefrontTemplate|null;children:ReactNode;className:string;style:CSSProperties}) {
 const groups = new Map<string,ReactNode[]>();
 const before:ReactNode[] = [], after:ReactNode[] = [];
 for(const child of Children.toArray(children)) {
  if(!isValidElement<{style?:CSSProperties;order?:number}>(child)){before.push(child);continue;}
  const priority=Number(child.props.order ?? child.props.style?.order ?? -1);
  const id=sectionOrder[priority];
  if(id){groups.set(id,[...(groups.get(id)??[]),child]);}
  else if(priority<0)before.push(child);else after.push(child);
 }
 const rows=sectionRows(sectionOrder.filter(id=>groups.has(id)),sectionLayout);
 const orderedChildren=<>{before}<div className="storefront-section-grid">{rows.map(row=><div key={row.join('-')} className="storefront-section-row" data-paired={row.length===2}>{row.map(id=><div key={id} data-public-section={id} className="storefront-layout-section" style={{'--section-height':`${sectionLayout[id]?.height??0}px`} as CSSProperties}>{groups.get(id)}</div>)}</div>)}</div>{after}</>;
 return <StorefrontFonts><div style={{containerType:"inline-size",containerName:"storefront-preview"}}><div data-template={template?.id} data-composition={template?.composition} data-mask={template?.imageMask} data-sections={template?.sections} data-services={template?.services} data-button={template?.button ?? "pill"} data-frame={template?.frame ?? "none"} className={`${className} ${template ? "template-surface published-storefront" : ""}`} style={{...style,...(template ? templateVariables(template):{}),...sectionDesignStyle(template?.backgroundDesign),"--storefront-subheading":template?.subheadingFamily ?? template?.headingFamily,"--storefront-subheading-style":template?.subheadingStyle ?? "normal"} as CSSProperties}>{orderedChildren}</div></div></StorefrontFonts>;
}
