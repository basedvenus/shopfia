import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {db} from "@/lib/db";
import {businessManagerWhere} from "@/lib/businesses";
import {vendorDashboardSelect} from "@/lib/vendor-dashboard-select";
import {getVendorDashboardStats} from "@/lib/services/vendor-dashboard-stats";
import {BusinessDashboardView} from "@/components/vendor/business-dashboard-view";
export const dynamic="force-dynamic";
export default async function BusinessDashboardPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams?:Promise<{reviewRequest?:string;welcome?:string}>}) {
 const {slug}=await params;
 const query=await searchParams;
 const session=await auth();
 if(!session?.user?.id)redirect("/account?next=login");
 const business=await db.vendorProfile.findFirst({where:{slug,...businessManagerWhere(session.user.id,session.user.role)},select:vendorDashboardSelect});
 if(!business)redirect("/vendor/dashboard");
 const stats=await getVendorDashboardStats(business.id);
 return <BusinessDashboardView business={business} stats={stats} welcome={query?.welcome==="1"} reviewRequest={query?.reviewRequest} />;
}
