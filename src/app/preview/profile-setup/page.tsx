import { notFound } from "next/navigation";
import { RequiredProfileForm } from "@/components/account/required-profile-form";

export default function ProfileSetupPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const user = { id: "preview-new-user", email: "new-user@example.com", name: null, username: null, imageCrop: null };
  return (
    <div className="mx-auto max-w-3xl">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/92 shadow-soft">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(244,207,202,0.75),transparent_38%),linear-gradient(135deg,rgba(255,248,245,0.96),rgba(255,255,255,0.86),rgba(249,224,199,0.62))] p-6 md:p-9">
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-[#2f2626] md:text-4xl">
            Set up your profile
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Choose your username and display name.
          </p>
        </div>
        <div className="grid gap-5 p-5 md:p-8">
          <RequiredProfileForm
            profileId={user.id}
            defaultDisplayName={user?.name}
            defaultImage={null}
            defaultImageCrop={user?.imageCrop}
            defaultUsername={user?.username}
          />
        </div>
      </section>
    </div>
  );
}
