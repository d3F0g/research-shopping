import type { Category, Feature } from "./contracts";

export const FIXTURE_OBSERVED_AT = "2025-01-15T00:00:00.000Z";
export const FIXTURE_NOTICE = "Synthetic development samples. Scenario timestamp 15 Jan 2025, not observed prices, stock or specification research.";

export const catalog = {
  "sony-wh-1000xm5": {
    category: "headphones", brand: "Sony", name: "Sony WH-1000XM5",
    productUrl: "https://www.sony.com.sg/electronics/headband-headphones/wh-1000xm5",
    features: ["wireless", "active-noise-cancelling", "multipoint", "lightweight"],
    price: 399, availability: "sample-in-stock", summary: "Sample profile with wireless listening, ANC and multipoint. Comfort is personal.",
  },
  "sony-wh-ch720n": {
    category: "headphones", brand: "Sony", name: "Sony WH-CH720N",
    productUrl: "https://www.sony.com.sg/headphones/products/wh-ch720n",
    features: ["wireless", "active-noise-cancelling", "multipoint", "lightweight"],
    price: 149, availability: "sample-in-stock", summary: "Sample lower-price wireless ANC profile. Battery evidence conflicts in this fixture.",
  },
  "sennheiser-momentum-4": {
    category: "headphones", brand: "Sennheiser", name: "Sennheiser MOMENTUM 4 Wireless",
    productUrl: "https://global.sennheiser-hearing.com/products/momentum-4-wireless",
    features: ["wireless", "active-noise-cancelling", "multipoint", "long-battery-life"],
    price: 329, availability: "sample-in-stock", summary: "Sample long-battery wireless ANC profile. Weight may be a tradeoff.",
  },
  "audio-technica-ath-m50xbt2": {
    category: "headphones", brand: "Audio-Technica", name: "Audio-Technica ATH-M50xBT2",
    productUrl: "https://www.audio-technica.com/en-us/ath-m50xbt2",
    features: ["wireless", "multipoint", "long-battery-life"],
    price: 279, availability: "sample-unavailable", summary: "Sample wireless listening profile without ANC. Unavailable in the fixture.",
  },
  "asus-zenbook-14-ux3405": {
    category: "laptops", brand: "ASUS", name: "ASUS Zenbook 14 OLED UX3405",
    productUrl: "https://www.asus.com/sg/laptops/for-home/zenbook/asus-zenbook-14-oled-ux3405/",
    features: ["oled-display", "high-memory", "portable"],
    price: 1799, availability: "sample-in-stock", summary: "Sample OLED, 32 GB configuration. Confirm the exact configuration with the manufacturer.",
  },
  "asus-vivobook-s14-s3407": {
    category: "laptops", brand: "ASUS", name: "ASUS Vivobook S14 S3407",
    productUrl: "https://www.asus.com/sg/laptops/for-home/vivobook/asus-vivobook-s14-s3407/",
    features: ["portable"],
    price: 1099, availability: "sample-in-stock", summary: "Sample lower-price portable configuration. Memory evidence conflicts in this fixture.",
  },
  "asus-zenbook-s14-ux5406": {
    category: "laptops", brand: "ASUS", name: "ASUS Zenbook S14 UX5406",
    productUrl: "https://www.asus.com/sg/laptops/for-home/zenbook/asus-zenbook-s-14-ux5406/",
    features: ["oled-display", "high-memory", "portable", "long-battery"],
    price: 2299, availability: "sample-in-stock", summary: "Sample OLED, 32 GB portable configuration. Higher sample cost is the tradeoff.",
  },
  "dell-xps-13-9340": {
    category: "laptops", brand: "Dell", name: "Dell XPS 13 9340",
    productUrl: "https://www.dell.com/en-sg/shop/cty/spd/xps-13-9340-laptop",
    features: ["high-memory", "portable"],
    price: 1999, availability: "sample-unavailable", summary: "Sample portable 32 GB configuration. Unavailable in the fixture.",
  },
} as const satisfies Record<string, {
  category: Category; brand: string; name: string; productUrl: string;
  features: readonly Feature[]; price: number; availability: "sample-in-stock" | "sample-unavailable"; summary: string;
}>;

export type CatalogId = keyof typeof catalog;
export const approvedMerchantHosts = new Set([
  "www.sony.com.sg", "global.sennheiser-hearing.com", "www.audio-technica.com", "www.asus.com", "www.dell.com",
]);

export const categoryFeatures: Record<Category, readonly Feature[]> = {
  headphones: ["active-noise-cancelling", "wireless", "multipoint", "long-battery-life", "lightweight"],
  laptops: ["oled-display", "high-memory", "long-battery", "portable"],
};

export const featureLabels: Record<Feature, string> = {
  "active-noise-cancelling": "active noise cancelling", wireless: "wireless", multipoint: "multipoint",
  "long-battery-life": "long battery life", lightweight: "lightweight",
  "oled-display": "OLED display", "high-memory": "32 GB memory", "long-battery": "long battery life", portable: "portable",
};
