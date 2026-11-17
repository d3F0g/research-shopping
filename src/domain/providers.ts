import type { Claim, DiscoveryProduct, Offer, Preferences, ProductId } from "./contracts";

export type ProviderContext = { signal: AbortSignal };

export interface DiscoveryProvider {
  discover(preferences: Preferences, context: ProviderContext): Promise<DiscoveryProduct[]>;
  findById(productId: ProductId, context: ProviderContext): Promise<DiscoveryProduct | null>;
}

export interface ResearchProvider {
  research(product: DiscoveryProduct, context: ProviderContext): Promise<Claim[]>;
}

export interface MerchantProvider {
  lookup(product: DiscoveryProduct, preferences: Preferences, context: ProviderContext): Promise<Offer | null>;
}

export type Providers = {
  discovery: DiscoveryProvider;
  research: ResearchProvider;
  merchant: MerchantProvider;
};

export type ProviderName = keyof Providers;
export type ProviderEvent = { provider: ProviderName; outcome: "ok" | "failed" | "timeout" };
