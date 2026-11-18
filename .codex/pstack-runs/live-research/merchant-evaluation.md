# Merchant API evaluation for Issue 2

Fieldnote needs attributable product research and genuine merchant offers while preserving its chat UI and ending at merchant links.
This investigation checked official documentation on 2026-11-18. VERIFIED means documentation verified unless explicitly described as a live response.
No merchant product API requests or Exa requests were made. No credentials, environment files, accounts, enrollments, or repository files were accessed or changed.

## Decision

BLOCKED for a verified live Singapore offer today. No permitted, credential-free real merchant integration was established in this investigation.
VERIFIED that Shopify Storefront supports tokenless product queries. It is incorrect to claim that all Shopify product access requires credentials.
BLOCKED for the proposed Sennheiser or Shokz Ajax shortcut. Shopify documents Ajax for Shopify-hosted themes, and both merchants prohibit scraping in their own terms.
UNVERIFIED whether an existing eBay or Best Buy credential is available. Credential inspection was outside this assignment.
The smallest honest implementation can preserve provider-independent offer types, implement documented adapters disabled by default, and show unavailable capabilities explicitly. Such work is not proof of live commerce.

## eBay Browse

VERIFIED that Browse searches listings and retrieves item details with an OAuth Application access token obtained through the client credentials grant. Buyer login is unnecessary for these read operations. [Browse API](https://developer.ebay.com/develop/api/buy/browse_api).
VERIFIED that a developer account and environment-specific keyset are prerequisites. Sandbox and production keysets are distinct. [Get started](https://developer.ebay.com/develop/guides/sell/get-started-with-ebay-apis).
VERIFIED that search uses `GET https://api.ebay.com/buy/browse/v1/item_summary/search` and scope `https://api.ebay.com/oauth/api_scope`. The marketplace header defaults to US when omitted or invalid. [Search contract](https://developer.ebay.com/develop/api/buy).
VERIFIED that `EBAY_SG` supports Browse `item_summary` and `item`. Image search is limited to US, Germany, UK, and Australia. SG support does not prove a particular item ships to a particular address. [Marketplace matrix](https://developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html).
VERIFIED that the published Buy requirements describe production approval, contracts, and an EPN application process. Sandbox use also requires eBay and developer accounts. [Buy requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html).
UNVERIFIED whether all those production gates apply to ordinary nonaffiliate Browse reads. The newer getting-started guide says some steps do not apply and reserves Growth Check for restricted APIs. An official Developer Support response says most Browse search and getItem calls are unrestricted. Preserve this discrepancy rather than inventing a universal partner gate. [Getting started](https://developer.ebay.com/develop/get-started/get-started-on-a-buying-application), [Developer Support response](https://community.ebay.com/forum/search-api-57966/topic/request-app-check-access-for-account-in-browse-prod-467069/).
BLOCKED without an authorized production client ID and secret plus confirmed entitlement. No OAuth or item request was attempted. Sandbox data cannot satisfy genuine-offer acceptance.
UNVERIFIED actual item currencies, variants, prices, availability, and SG delivery. An implementation must retain each returned currency and selected listing variation rather than assuming SGD from marketplace selection.

## Shopify Storefront

VERIFIED that Storefront supports tokenless products, collections, and search with a query-complexity cap of 1,000. Some fields, including metafields and product tags, require tokens. Public and private tokens are separate access methods. Private tokens remain server-only. Automated traffic is limited and security rejections must not be bypassed. [Storefront reference](https://shopify.dev/docs/api/storefront/latest).
VERIFIED that the documented GraphQL endpoint is `POST https://{shop}.myshopify.com/api/{api_version}/graphql.json`. A read-only query is still an HTTP POST. Use a supported pinned version after inspecting its schema. [International pricing](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/markets/international-pricing).
VERIFIED that variant data includes ID, selected options, price, `availableForSale`, and `currentlyNotInStock`. The last field identifies a purchasable backorder. Therefore `availableForSale=true` alone does not prove physical stock. [ProductVariant](https://shopify.dev/docs/api/storefront/latest/objects/ProductVariant).
VERIFIED that country context and currencies depend on merchant configuration. `@inContext(country: SG)` does not guarantee SGD because unsupported countries can fall back to store currency. Query localization and preserve returned currency. [International pricing](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/markets/international-pricing).
UNVERIFIED an authorized real SG merchant Storefront endpoint, enabled SG market, returned currency, variant coverage, or availability. Do not use mock.shop or a developer demo as genuine offers.
A tokenless adapter can be implemented without issuing a key, but a real merchant's permitted use and actual response still need verification.

## Shopify Ajax Product API

VERIFIED that `GET /{locale}/products/{product-handle}.js` is documented and returns product and variant prices, IDs, and availability. It returns at most 250 variants. Money is in the session's presentment currency, which Shopify documents obtaining from `/{locale}/cart.js`. The product response alone is insufficient currency proof. [Product reference](https://shopify.dev/docs/api/ajax/reference/product).
VERIFIED that Shopify limits this API to themes hosted by Shopify and excludes custom storefronts. An external Fieldnote server adapter is outside that documented use. Public reachability is not merchant permission. [Ajax overview](https://shopify.dev/docs/api/ajax).
BLOCKED for an external Ajax integration without a permitted merchant arrangement. Do not substitute undocumented `/products.json` catalog crawling or extract another application's tokens.

## Real SG headphone candidates

VERIFIED that Sennheiser Singapore's terms name Sonova Consumer Hearing Singapore Pte Ltd and explicitly identify Shopify hosting. They prohibit crawling and scraping and require written permission for exploitation of the service. [Merchant terms](https://sg.sennheiser-hearing.com/policies/terms-of-service).
VERIFIED that an official product page exists for [MOMENTUM 4 Wireless](https://sg.sennheiser-hearing.com/products/momentum-4-wireless), found through web search. This establishes a candidate citation, not current commerce data.
UNVERIFIED its product API response, currency, variant identifiers, stock, and delivery. No product API request was made because the required permission condition was not established.
VERIFIED that Shokz Asia's terms identify Shopify hosting, prohibit crawling and scraping, and require permission to exploit the service. [Merchant terms](https://asia.shokz.com/pages/terms-of-service).
VERIFIED that [Shokz OpenRun](https://asia.shokz.com/products/openrun) has a regional selector including Singapore in indexed page content. That selector does not prove SG availability, an SGD price, or shipping eligibility.
UNVERIFIED its product API response, currency, variants, stock, and SG delivery. No product API request was made.
BLOCKED for using either candidate as a verified token-free commerce source under the assignment's requirement that terms permit the request. Their public pages can remain merchant destinations, without copying unverified prices into offer cards.

## Best Buy

VERIFIED that Products API requests need an API key and support fields such as `sku`, `salePrice`, `onlineAvailability`, and `onlineAvailabilityUpdateDate`. The availability field indicates online purchase eligibility, not SG delivery. [API documentation](https://bestbuyapis.github.io/api-documentation/).
VERIFIED that Best Buy's API terms require a developer account and valid key, attribution, intact supplied links, and temporary caching no longer than 72 hours. They restrict some third-party pricing-analysis uses. A comparison product needs a terms-fit check before enablement. [API terms](https://developer.bestbuy.com/legal).
VERIFIED that BestBuy.com international-order guidance offers shipment within the 50 United States. This does not meet a Singapore-delivery hard constraint. [International orders](https://www.bestbuy.com/site/help-topics/international-orders/pcmcat204400050019.c?id=pcmcat204400050019).
BLOCKED without authorized credentials. UNVERIFIED actual product responses and price currency. No request was attempted.

## Implementation boundary and proof still needed

A proposed offer should retain provider, merchant, canonical product URL, product and variant IDs, region context, amount, ISO currency, availability basis, observation time, and source reference.
Research excerpts and merchant offers require separate provenance. Search snippets do not establish inventory or current price.
Use unknown availability when unsupported. Preserve seller-estimated availability as an estimate. Never claim in-stock from an orderable backorder.
Keep variant prices separate. Never treat a product's minimum price as the price of every variant.
A successful authorized read must record request URL, selected region, UTC observation time, HTTP status, returned product identity, currency, variant, availability semantics, and a bounded redacted response artifact.
A fetch timestamp establishes observation time only. It does not prove that the merchant updated the offer at that time.
Contract tests can verify parsing, unsupported regions, missing price or currency, unavailable variants, cancellation, timeouts, and provider failure. They cannot satisfy live acceptance.
No request budget was consumed. The optional allowance of three public merchant product reads remains unused. Exa spend is zero.

## Principle applied

Prove It Works changed the decision from treating public Shopify URLs and indexed products as a ready live source to reporting merchant access and commerce data as BLOCKED or UNVERIFIED. Only directly inspected official documentation is VERIFIED here.
