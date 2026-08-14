const IMAGE_SIGNATURES: Record<string, number[][]> = {
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [
    [0x52, 0x49, 0x46, 0x46]
  ]
};

export async function readVerifiedImageFile(file: File, options: { allowedTypes: Set<string>; maxBytes: number }) {
  if (!options.allowedTypes.has(file.type)) {
    throw new Error(`Use a ${formatAllowedImageTypes(options.allowedTypes)} image.`);
  }

  if (file.size > options.maxBytes) {
    throw new Error(`That image is too large. Choose a photo under ${Math.floor(options.maxBytes / 1024 / 1024)}MB.`);
  }

  if (/[\\/]|\.([cm]js|js|html|svg|php|exe|sh|bat|cmd)$/i.test(file.name)) {
    throw new Error("That file name is not allowed.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedImageSignature(bytes, file.type)) {
    throw new Error("That file does not look like a valid image.");
  }

  return bytes;
}

function formatAllowedImageTypes(types: Set<string>) {
  const labels = Array.from(types)
    .map((type) => {
      if (type === "image/jpeg") return "JPG";
      if (type === "image/png") return "PNG";
      if (type === "image/webp") return "WebP";
      if (type === "image/gif") return "GIF";
      return type.replace(/^image\//, "").toUpperCase();
    })
    .filter(Boolean);

  if (labels.length <= 1) return labels[0] ?? "supported";
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

function hasExpectedImageSignature(bytes: Buffer, contentType: string) {
  const signatures = IMAGE_SIGNATURES[contentType];
  if (!signatures?.length) return false;

  if (contentType === "image/webp") {
    return (
      signatures.some((signature) => startsWith(bytes, signature)) &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return signatures.some((signature) => startsWith(bytes, signature));
}

function startsWith(bytes: Buffer, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}
