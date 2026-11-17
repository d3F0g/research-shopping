import { approvedMerchantHosts, catalog, type CatalogId } from "./catalog";
import type { DiscoveryProduct, Offer } from "./contracts";

export function isApprovedUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && approvedMerchantHosts.has(url.hostname)
      && !url.username && !url.password && !url.port && !url.search && !url.hash
      && raw === url.href;
  } catch {
    return false;
  }
}

export function matchesCatalogIdentity(product: DiscoveryProduct): boolean {
  const identity = catalog[product.id as CatalogId];
  return !!identity && identity.name === product.name && identity.brand === product.brand
    && identity.category === product.category && identity.productUrl === product.productUrl
    && isApprovedUrl(product.productUrl);
}

export function isSafeMerchantOffer(product: DiscoveryProduct, offer: Offer): boolean {
  return matchesCatalogIdentity(product) && offer.productId === product.id
    && offer.productUrl === product.productUrl && isApprovedUrl(offer.productUrl)
    && offer.merchantHost === new URL(offer.productUrl).hostname;
}

export function isSafeCatalogHandoff(
  productId: string,
  productName: string,
  productUrl: string,
  offer: Offer,
): boolean {
  const identity = catalog[productId as CatalogId];
  return !!identity && identity.name === productName && identity.productUrl === productUrl
    && offer.productId === productId && offer.productUrl === identity.productUrl
    && isApprovedUrl(productUrl) && offer.merchantHost === new URL(productUrl).hostname;
}
