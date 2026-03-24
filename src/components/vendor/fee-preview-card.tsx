"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent } from "@/lib/utils";

type FeePreviewCardProps = {
  listingFeeCents: number;
  transactionFeePercent: number;
  paymentProcessingPercent: number;
  paymentProcessingFlatCents: number;
  offsiteAdsStandardPercent: number;
  offsiteAdsHighVolumePercent: number;
  offsiteAdsEnabled: boolean;
};

export function FeePreviewCard({
  listingFeeCents,
  transactionFeePercent,
  paymentProcessingPercent,
  paymentProcessingFlatCents,
  offsiteAdsStandardPercent,
  offsiteAdsHighVolumePercent,
  offsiteAdsEnabled
}: FeePreviewCardProps) {
  const [itemPrice, setItemPrice] = useState("150");
  const [shipping, setShipping] = useState("15");
  const [tax, setTax] = useState("0");
  const [giftWrap, setGiftWrap] = useState("0");
  const [useOffsiteAds, setUseOffsiteAds] = useState(false);
  const [highVolumeTier, setHighVolumeTier] = useState(false);
  const [marketplaceRemitsTax, setMarketplaceRemitsTax] = useState(true);

  const itemSubtotalCents = toCents(itemPrice);
  const shippingAmountCents = toCents(shipping);
  const taxAmountCents = toCents(tax);
  const giftWrapAmountCents = toCents(giftWrap);
  const buyerTotalCents =
    itemSubtotalCents + shippingAmountCents + taxAmountCents + giftWrapAmountCents;
  const transactionBaseCents = itemSubtotalCents + shippingAmountCents + giftWrapAmountCents;
  const transactionFeeCents = percentOf(transactionBaseCents, transactionFeePercent);
  const paymentProcessingFeeCents =
    percentOf(buyerTotalCents, paymentProcessingPercent) + paymentProcessingFlatCents;
  const offsitePercent = highVolumeTier
    ? offsiteAdsHighVolumePercent
    : offsiteAdsStandardPercent;
  const offsiteAdsFeeCents =
    offsiteAdsEnabled && useOffsiteAds ? percentOf(buyerTotalCents, offsitePercent) : 0;
  const totalFeesCents =
    listingFeeCents + transactionFeeCents + paymentProcessingFeeCents + offsiteAdsFeeCents;
  const netEarningsCents =
    buyerTotalCents -
    (marketplaceRemitsTax ? taxAmountCents : 0) -
    totalFeesCents;

  return (
    <div className="space-y-4 rounded-[1.8rem] border border-white/70 bg-white/95 p-5 shadow-soft">
      <div>
        <h3 className="text-lg font-semibold">Estimated earnings preview</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview the low-friction fee mix before publishing a listing.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="Item price" />
        <Input value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="Shipping" />
        <Input value={tax} onChange={(e) => setTax(e.target.value)} placeholder="Tax" />
        <Input value={giftWrap} onChange={(e) => setGiftWrap(e.target.value)} placeholder="Gift wrap / add-ons" />
      </div>

      <div className="grid gap-2 text-sm text-muted-foreground">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={marketplaceRemitsTax}
            onChange={(e) => setMarketplaceRemitsTax(e.target.checked)}
          />
          Marketplace remits tax instead of the seller
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useOffsiteAds}
            onChange={(e) => setUseOffsiteAds(e.target.checked)}
            disabled={!offsiteAdsEnabled}
          />
          Apply Offsite Ads fee
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={highVolumeTier}
            onChange={(e) => setHighVolumeTier(e.target.checked)}
            disabled={!offsiteAdsEnabled || !useOffsiteAds}
          />
          Use high-volume Offsite Ads rate ({formatPercent(offsiteAdsHighVolumePercent)}%)
        </label>
      </div>

      <div className="space-y-2 rounded-[1.4rem] bg-muted/70 p-4 text-sm">
        <FeeRow label="Listing fee" value={formatCurrency(listingFeeCents)} />
        <FeeRow
          label="Transaction fee"
          value={`${formatPercent(transactionFeePercent)}% · ${formatCurrency(transactionFeeCents)}`}
        />
        <FeeRow
          label="Payment processing fee"
          value={`${formatPercent(paymentProcessingPercent)}% + ${formatCurrency(
            paymentProcessingFlatCents
          )} · ${formatCurrency(paymentProcessingFeeCents)}`}
        />
        <FeeRow
          label="Offsite Ads fee"
          value={
            offsiteAdsEnabled && useOffsiteAds
              ? `${formatPercent(offsitePercent)}% · ${formatCurrency(offsiteAdsFeeCents)}`
              : "Only when applicable"
          }
        />
        <FeeRow label="Net earnings" value={formatCurrency(netEarningsCents)} strong />
      </div>
    </div>
  );
}

function FeeRow({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-semibold text-foreground" : ""}>{label}</span>
      <span className={strong ? "font-semibold text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

function percentOf(amountCents: number, percent: number) {
  return Math.round(amountCents * (percent / 100));
}

function toCents(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}
