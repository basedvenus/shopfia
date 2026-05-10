type ProfileAvatarPreviewProps = {
  image?: string | null;
  initials: string;
  displayName: string;
};

export function ProfileAvatarPreview({
  image,
  initials,
  displayName
}: ProfileAvatarPreviewProps) {
  return (
    <div className="grid aspect-square h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-accent text-2xl font-semibold shadow-soft">
      {image ? (
        <img
          src={image}
          alt={displayName}
          className="h-full w-full object-cover object-center"
        />
      ) : (
        initials
      )}
    </div>
  );
}
