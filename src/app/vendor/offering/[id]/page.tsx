import { redirect } from "next/navigation";

export default function VendorOfferingAliasPage({ params }: { params: { id: string } }) {
  redirect(`/offering/${params.id}`);
}
