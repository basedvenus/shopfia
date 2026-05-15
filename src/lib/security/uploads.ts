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
    throw new Error("Use a JPG, PNG, WebP, or GIF image.");
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
