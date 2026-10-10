import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function AccountRecovery({ email }: { email?: string | null }) {
  return (
    <div className="rounded-2xl border border-border bg-[#fff8f5] p-4 text-sm">
      <p>{email ? `Signed in as ${email}.` : "You are already signed in to ShopFia."}</p>
      <p className="mt-2 text-muted-foreground">
        Already have a username? Check that this is the email you used before creating
        a new profile. You can sign out and choose your existing login.
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
