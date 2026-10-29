export const metadata = { title: "Mobile pricing preview | ShopFia", robots: { index: false, follow: false } };

export default function MobilePricingPreviewPage() {
  return <div style={{ padding: "24px 12px", background: "#eeeae3", minHeight: "100vh" }}>
    <p style={{ textAlign: "center", marginBottom: 16 }}>Mobile preview · 390px · <Link href="/pricing-preview" style={{ textDecoration: "underline" }}>Back to full preview</Link></p>
    <div className="sp-mobile" style={{ width: 390, maxWidth: "100%", margin: "0 auto", border: "1px solid #d7cbc1", borderRadius: 24, background: "white", overflow: "hidden" }}><PricingPreview /></div>
  </div>;
}
import Link from "next/link";
import { PricingPreview } from "@/components/pricing/pricing-preview";

