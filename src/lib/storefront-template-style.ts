import type { CSSProperties } from "react";
import type { StorefrontTemplate } from "./storefront-template-library";
export function templateVariables(template: StorefrontTemplate): CSSProperties {
  const secondary=template.colors.secondary;
  const luminance=[1,3,5].map(index=>parseInt(secondary.slice(index,index+2),16)/255).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  return {...Object.fromEntries(Object.entries(template.colors).map(([key,value])=>[`--template-${key}`,value])),
    "--template-button":template.buttonColor ?? template.colors.accent,
    "--template-heading-size":`${template.headingSize ?? 64}px`, "--template-heading-weight":template.headingWeight ?? 600,
    "--template-hero":template.heroBackground ?? template.colors.surface,
    "--template-heroInk":template.heroInk ?? template.colors.ink,
    "--template-secondaryInk":luminance>.55 ? "#282421" : "#fff9f0",
    "--template-heading-case":template.headingCase ?? "none",
    "--template-heading-style":template.headingFontStyle ?? "normal"
  } as CSSProperties;
}
