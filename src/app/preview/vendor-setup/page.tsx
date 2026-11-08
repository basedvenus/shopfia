import { VENDOR_CATEGORY_NAMES } from "@/lib/vendor-categories";
import { notFound } from "next/navigation";
import { VendorChoiceForm } from "@/components/account/vendor-choice-form";

export default function VendorSetupPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <section className="mx-auto max-w-2xl rounded-3xl border bg-white/90 p-6 shadow-soft">
    <h1 className="mb-6 text-3xl font-semibold tracking-tight">One more thing</h1>
    <VendorChoiceForm preview categories={VENDOR_CATEGORY_NAMES.map((name,index)=>({id:`preview-${index}`,name}))} />
  </section>;
}
