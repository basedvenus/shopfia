import { CategoryAudience } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { VendorChoiceForm } from "@/components/account/vendor-choice-form";

export const dynamic = "force-dynamic";
export default async function VendorSetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/account");
  const user = await db.user.findUnique({where: {id: session.user.id}, select: {name: true, username: true}});
  if (!user?.name?.trim() || !user.username?.trim()) redirect("/account/setup");
  const categories = await db.category.findMany({where:{audience:CategoryAudience.VENDOR},select:{id:true,name:true},orderBy:{name:"asc"}});
  return <section className="mx-auto max-w-2xl rounded-3xl border bg-white/90 p-6 shadow-soft">
    <h1 className="mb-6 text-3xl font-semibold tracking-tight">One more thing</h1>
    <VendorChoiceForm categories={categories} />
  </section>;
}
