import { signOut } from "@/auth";
import { SiteNavClient } from "@/components/layout/site-nav-client";

export function SiteNav() {
  return (
    <SiteNavClient
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    />
  );
}
