"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CroppedImage } from "@/components/ui/cropped-image";
import type { ImageCrop } from "@/lib/image-crop";

type Props = {
  photo: { url: string; crop: ImageCrop };
  index: number;
  count: number;
  isEditing: boolean;
  onClose: () => void;
  onRestoreFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPrevious: () => void;
  onNext: () => void;
  children?: ReactNode;
};

export function PartyPhotoActions({ photo, index, count, isEditing, onClose, onRestoreFocus, onEdit, onDelete, onPrevious, onNext, children }: Props) {
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" />
      <Dialog.Content onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }} className="fixed inset-x-0 bottom-0 z-[81] flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-3xl border bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl outline-none md:bottom-auto md:left-1/2 md:top-1/2 md:w-[calc(100%_-_2rem)] md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div><Dialog.Title className="text-xl font-semibold">Photo {index + 1} of {count}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">Edit, delete, or tag vendors in this photo.</Dialog.Description></div>
          <button type="button" aria-label="Close photo preview" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="aspect-[4/3] max-h-[50dvh] overflow-hidden rounded-2xl bg-muted"><CroppedImage src={photo.url} crop={photo.crop} frameFit="contain" alt={`Photo ${index + 1} enlarged preview`} className="h-full w-full object-contain" /></div>
        {count > 1 ? <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" disabled={index === 0} onClick={onPrevious}><ChevronLeft className="h-4 w-4" />Previous photo</Button>
          <Button type="button" variant="secondary" disabled={index === count - 1} onClick={onNext}>Next photo<ChevronRight className="h-4 w-4" /></Button>
        </div> : null}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" className="h-12" onClick={onEdit}><SlidersHorizontal className="h-4 w-4" />Edit photo</Button>
          <Button type="button" variant="secondary" className="h-12 border border-destructive/20 text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete photo</Button>
        </div>
        {children}
        <Button type="button" className="h-12 w-full shrink-0" onClick={onClose}>Done editing photo & tags</Button>
        <p className="text-xs text-muted-foreground">{isEditing ? "Photo removals take effect when you save your party." : "Deleting removes the photo from your party draft."}</p>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
