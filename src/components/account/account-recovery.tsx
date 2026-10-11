import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function AccountRecovery({ email }: { email?: string | null }) {
  return (
    <div id="account-recovery" className="rounded-2xl border border-border bg-[#fff8f5] p-4 text-sm">
      <p>{email ? `Signed in as ${email}.` : "You are already signed in to ShopFia."}</p>
      <p className="mt-2 text-muted-foreground">
        Already had a profile or storefront? Missing details do not mean you need to
        create them again. Check that this is the email you used before. You can
        sign out and choose your existing login. Continuing to browse does not
        restore missing details or link a storefront to this account.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/account" });
        }}
        className="mt-3"
      >
        <Button type="submit" variant="secondary">Sign out and choose another login</Button>
      </form>
    </div>
  );
}
