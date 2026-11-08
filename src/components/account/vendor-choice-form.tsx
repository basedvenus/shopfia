"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle } from "lucide-react";
import { checkStorefrontUsernameAction } from "@/app/actions/storefront-username";
import { chooseVendorSetupAction } from "@/app/actions/auth";
import { createVendorSignupAction } from "@/app/actions/vendor-signup";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = {id:string;name:string};
export function VendorChoiceForm({categories=[],preview=false}:{categories?:Category[];preview?:boolean}) {
  const [isVendor,setIsVendor]=useState<"yes"|"no"|null>(null);
  const [storefrontName,setStorefrontName]=useState("");
  const [storefrontUsername,setStorefrontUsername]=useState("");
  const [availability,setAvailability]=useState<{username:string;available:boolean;error?:string}|null>(null);
  const [checking,setChecking]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [created,setCreated]=useState<{slug:string;url:string}|null>(null);
  const [copied,setCopied]=useState(false);
  const [pending,startTransition]=useTransition();
  const router=useRouter();
  useEffect(()=>{
    setAvailability(null);
    if(isVendor!=="yes" || !/^[a-z0-9-]{3,40}$/.test(storefrontUsername)){setChecking(false);return;}
    let active=true;setChecking(true);
    const timer=setTimeout(async()=>{
      try {const result=await checkStorefrontUsernameAction(storefrontUsername);if(active)setAvailability({username:storefrontUsername,...result});}
      catch {if(active)setAvailability({username:storefrontUsername,available:false,error:"Could not check availability. Please try again."});}
      finally {if(active)setChecking(false);}
    },450);
    return()=>{active=false;clearTimeout(timer);};
  },[isVendor,storefrontUsername]);
  return <>
    <form className="grid gap-5" action={form=>{
      setMessage(null);
      startTransition(async()=>{
        try {
          if(isVendor==="no") {
            if(preview){router.push("/explore");return;}
            const result=await chooseVendorSetupAction(form);
            if(!result.ok){setMessage(result.error);return;}
            router.replace(result.nextPath);router.refresh();return;
          }
          if(!form.getAll("categoryIds").length){setMessage("Choose at least one category.");return;}
          if(preview){setCreated({slug:storefrontUsername,url:`https://www.shopfia.app/${storefrontUsername}`});return;}
          const result=await createVendorSignupAction(form);
          if(!result.ok){setMessage(result.error);return;}
          setCreated({slug:result.slug,url:result.url});
        }catch{setMessage("Could not continue. Please try again.");}
      });
    }}>
      <fieldset disabled={pending} className="grid gap-5">
        <legend className="mb-3 text-xl font-semibold">Are you a vendor?</legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2"><input type="radio" name="isVendor" value="yes" checked={isVendor==="yes"} onChange={()=>setIsVendor("yes")} required />Yes</label>
          <label className="flex items-center gap-2"><input type="radio" name="isVendor" value="no" checked={isVendor==="no"} onChange={()=>setIsVendor("no")} required />No</label>
        </div>
        {isVendor==="yes" ? <div className="grid gap-5">
          <ImageUploadField name="logoUrl" label="Business logo" rounded="full" hideFormatDetailsUntilInteraction />
          <label className="grid gap-2 text-sm font-medium">Business name<Input name="storefrontName" value={storefrontName} onChange={event=>setStorefrontName(event.target.value)} placeholder="Your business name" minLength={2} maxLength={80} required /></label>
          <p className="text-xs text-muted-foreground">This is your public business name, separate from your personal display name and username.</p>
          <label className="grid gap-2 text-sm font-medium">Business username<Input name="storefrontUsername" value={storefrontUsername} onChange={event=>{setStorefrontUsername(event.target.value.toLowerCase().replace(/\s/g,""));setAvailability(null);}} placeholder="your-business" autoCapitalize="none" autoCorrect="off" spellCheck={false} minLength={3} maxLength={40} pattern="[a-z0-9-]+" required /></label>
          <p className="text-xs text-muted-foreground">Once saved, you can change your business username and storefront link once every 30 days.</p>
          {checking ? <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />Checking username…</p> : null}
          {availability?.username===storefrontUsername ? <p role="status" className={`text-sm ${availability.available?"text-green-700":"text-destructive"}`}>{availability.available?"Business username available.":availability.error}</p> : null}
          <PlaceAutocompleteInput label="City" placeholder="Type your city" required requireSelection syncAddressFields searchType="cities" fieldNames={{input:"formattedAddress",city:"locationCity",state:"locationState",lat:"locationLat",lng:"locationLng",placeId:"googlePlaceId"}} />
          <fieldset className="grid gap-3"><legend className="mb-2 text-sm font-medium">Categories</legend><p className="text-xs text-muted-foreground">Choose the categories that describe your business.</p><div className="grid gap-2 sm:grid-cols-2">{categories.map(category=><label key={category.id} className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm"><input type="checkbox" name="categoryIds" value={category.id} />{category.name}</label>)}</div></fieldset>
        </div> : isVendor==="no" ? <p className="text-sm text-muted-foreground">You’re ready to explore. You can add a business later.</p> : null}
        <Button type="submit" disabled={pending || (isVendor==="yes" && (checking || availability?.username!==storefrontUsername || !availability?.available))}>{pending?"Saving…":isVendor==="yes"?"Save business":"Continue"}</Button>
      </fieldset>
      {message ? <p role="alert" className="text-sm text-destructive">{message}</p>:null}
    </form>
    <Dialog.Root open={Boolean(created)}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-sm" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-2xl" onEscapeKeyDown={event=>event.preventDefault()} onPointerDownOutside={event=>event.preventDefault()}>
        <Dialog.Title className="text-2xl font-semibold">Your business storefront link</Dialog.Title>
        <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">Save this link and paste it in your bio so customers can find your business and book securely through ShopFia.</Dialog.Description>
        <p className="my-5 break-all rounded-2xl bg-stone-100 p-4 text-sm">{created?.url}</p>
        <p className="mb-5 text-xs leading-5 text-muted-foreground">You can also find your link in the address bar when viewing your storefront. Next, personalize your page with Edit storefront on your business dashboard.</p>
        <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(created?.url??"");setCopied(true);}catch{setMessage("Select and copy the link above.");}}}>{copied?"Link copied":"Copy link"}</Button><Button type="button" onClick={()=>{if(created){router.replace(preview?`/preview/vendor-dashboard?${new URLSearchParams({name:storefrontName,slug:created.slug})}#storefront`:`/vendor/business/${created.slug}?welcome=1#storefront`);router.refresh();}}}>Complete</Button></div>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}
