// Clip the photograph itself; transparent scallops reveal any section background.
export const scallopedPhotoMask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath fill='white' d='M0 0H100V92A10 8 0 0 1 80 92A10 8 0 0 1 60 92A10 8 0 0 1 40 92A10 8 0 0 1 20 92A10 8 0 0 1 0 92Z'/%3E%3C/svg%3E")`;
export const scallopedPhotoStyle = { maskImage: scallopedPhotoMask, WebkitMaskImage: scallopedPhotoMask, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" };
