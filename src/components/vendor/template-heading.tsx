import type { StorefrontTemplate } from "@/lib/storefront-template-library";

export function TemplateHeading({ text, treatment, accentFamily, parts }: { text: string; treatment?: StorefrontTemplate["headingTreatment"]; accentFamily?: string; parts?: [string,string,string] }) {
  if(!treatment || treatment === "plain")return <>{text}</>;
  const words=parts ?? text.trim().split(/\s+/);
  if(words.length<2)return <>{text}</>;
  return <span className={`template-mixed-heading treatment-${treatment}`}><span>{words[0]} </span><strong style={{fontFamily:accentFamily}}>{words[1]}</strong>{words.length>2 ? <span> {words.slice(2).join(" ")}</span> : null}</span>;
}
