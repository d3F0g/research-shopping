import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  ListFilter,
  Search,
  ShieldCheck,
} from "lucide-react";
import type {
  Candidate,
  ProviderEvent,
  SelectionResult,
  Source,
  TurnResponse,
} from "../domain/contracts";
import { isApprovedUrl } from "../domain/merchant-links";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

function currencySymbol(currency: string) {
  return currency === "SGD" ? "S$" : "US$";
}

function fixtureDate(date: string) {
  return new Date(date).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SourceReference({
  source,
  productUrl,
}: {
  source: Source;
  productUrl: string;
}) {
  const href =
    isApprovedUrl(source.url) && source.url === productUrl ? source.url : null;
  return (
    <div className="source-reference">
      {href ? (
        <a
          className="source-link"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          Manufacturer reference/model page <ArrowUpRight aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <p>{source.name} · synthetic fixture source</p>
      )}
      <p className="metadata">
        Synthetic fixture timestamp · {fixtureDate(source.capturedAt)}
      </p>
    </div>
  );
}

function InlineCitation({
  source,
  productUrl,
  label = "Reference",
}: {
  source: Source;
  productUrl: string;
  label?: string;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Button variant="secondary" size="xs" className="citation-trigger" />
        }
        aria-label={`Preview reference ${source.name}`}
      >
        <BookOpen aria-hidden="true" /> {label}
      </HoverCardTrigger>
      <HoverCardContent align="start" className="citation-preview">
        <p className="font-medium">{source.name}</p>
        <p className="my-2 text-muted-foreground">
          Synthetic fixture reference. This page does not verify the sample
          claim, price, or stock.
        </p>
        <SourceReference source={source} productUrl={productUrl} />
      </HoverCardContent>
    </HoverCard>
  );
}

function ClaimDetails({ candidate }: { candidate: Candidate }) {
  return (
    <Trace className="evidence-details">
      <TraceCollapsible>
        <TraceCollapsibleTrigger className="min-h-10">
          <TraceLine>
            <TraceIcon>
              <BookOpen />
            </TraceIcon>
            <TraceTitle>Evidence and limits</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <p className="product-summary mb-3">
            Fixture description · {candidate.product.summary}
          </p>
          <p className="fixture-explainer">
            Claims are synthetic fixture data. Manufacturer reference/model
            pages provide context only. They do not verify these claims, price,
            stock, or delivery.
          </p>
          {candidate.product.claims.length === 0 ? (
            <p>No product claims are recorded in this fixture.</p>
          ) : (
            <ul className="claim-list">
              {candidate.product.claims.map((claim, index) => (
                <li key={`${claim.key}-${index}`}>
                  <Badge
                    variant={
                      claim.status === "conflict" ? "outline" : "secondary"
                    }
                    className="claim-state"
                  >
                    {claim.status === "supported"
                      ? "SAMPLE CLAIM"
                      : claim.status === "unknown"
                        ? "UNKNOWN"
                        : "CONFLICTING SAMPLE CLAIMS"}
                  </Badge>
                  <p className="claim-name">{claim.key.replaceAll("-", " ")}</p>
                  {claim.status === "supported" && (
                    <>
                      <p className="claim-value">
                        {claim.value}{" "}
                        <InlineCitation
                          source={claim.sources[0]}
                          productUrl={candidate.product.productUrl}
                        />
                      </p>
                      {claim.sources.map((source) => (
                        <SourceReference
                          key={source.id}
                          source={source}
                          productUrl={candidate.product.productUrl}
                        />
                      ))}
                    </>
                  )}
                  {claim.status === "unknown" && <p>{claim.note}</p>}
                  {claim.status === "conflict" && (
                    <>
                      {claim.observations.map(
                        (observation, observationIndex) => (
                          <div
                            className="conflict-observation"
                            key={`${observation.source.id}-${observationIndex}`}
                          >
                            <p>
                              {observation.value} · {observation.source.name}
                            </p>
                            <SourceReference
                              source={observation.source}
                              productUrl={candidate.product.productUrl}
                            />
                          </div>
                        ),
                      )}
                      <p className="metadata">
                        These fixture records disagree. The comparison does not
                        use this claim as a reason.
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

function ProductCard({
  candidate,
  index,
  onSelect,
  selecting,
}: {
  candidate: Candidate;
  index: number;
  onSelect: () => void;
  selecting: boolean;
}) {
  const { offer, product } = candidate;
  const reference = product.claims
    .flatMap((claim) => (claim.status === "supported" ? claim.sources : []))
    .find(
      (source) =>
        isApprovedUrl(source.url) && source.url === product.productUrl,
    );
  const reasons = candidate.reasons.filter(
    (reason) => !reason.startsWith("Tradeoff."),
  );
  const tradeoff =
    candidate.reasons.find((reason) => reason.startsWith("Tradeoff.")) ??
    (product.claims.some((claim) => claim.status === "conflict")
      ? "Conflicting sample claims are excluded from ranking. Inspect the evidence."
      : "Sample evidence does not establish real-world quality, current price, or stock.");
  return (
    <Card
      className={`product-card ${index === 0 ? "top-pick" : ""}`}
      role="article"
      aria-label={product.name}
    >
      <CardHeader>
        <div className="product-card-eyebrow">
          <Badge variant={index === 0 ? "default" : "secondary"}>
            {index === 0
              ? "Leading sample match"
              : `Sample option ${index + 1}`}
          </Badge>
          <span className="metadata">
            {product.category === "headphones" ? "Headphones" : "Laptop"}
          </span>
        </div>
        <h3>{product.name}</h3>
        {reference && (
          <div className="mt-2">
            <InlineCitation
              source={reference}
              productUrl={product.productUrl}
              label="Model reference"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="product-details">
        <div className="offer-box">
          <div className="offer-price-line">
            <strong>
              {currencySymbol(offer.price.currency)}
              {offer.price.amount.toLocaleString("en-SG")}
            </strong>
            <Badge variant="outline">SAMPLE</Badge>
          </div>
          <p className="metadata">Sample price · fixture only</p>
          <p className="stock-line">
            <span className="stock-dot" />
            {offer.availability === "sample-in-stock"
              ? "Sample says in stock"
              : offer.availability === "sample-unavailable"
                ? "Sample says unavailable"
                : "Sample stock unknown"}
          </p>
          <p className="metadata">
            Fixture snapshot · {fixtureDate(offer.observedAt)} · {offer.region}
          </p>
        </div>
        <ul className="reason-list">
          {reasons.slice(0, 2).map((reason) => (
            <li key={reason}>
              <Check aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>
        {tradeoff && (
          <p className="tradeoff">
            <span>Tradeoff</span>
            {tradeoff.replace(/^Tradeoff\.\s*/, "")}
          </p>
        )}
        {reasons.length > 2 && (
          <Collapsible>
            <CollapsibleTrigger
              render={<Button variant="ghost" size="sm" />}
              className="px-0"
            >
              More fit details <ChevronDown aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="reason-list">
                {reasons.slice(2).map((reason) => (
                  <li key={reason}>
                    <Check aria-hidden="true" />
                    {reason}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
        <ClaimDetails candidate={candidate} />
      </CardContent>
      <CardFooter>
        <Button
          className="select-product h-10 w-full"
          variant={index === 0 ? "default" : "outline"}
          onClick={onSelect}
          disabled={selecting}
        >
          {selecting ? "Checking sample link…" : "Select this product"}
          <ArrowUpRight aria-hidden="true" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function Comparison({ candidates }: { candidates: Candidate[] }) {
  return (
    <Collapsible className="comparison-panel">
      <CollapsibleTrigger
        className="comparison-trigger"
        render={<Button variant="outline" />}
      >
        <ListFilter aria-hidden="true" /> Compare {candidates.length} sample
        options <ChevronDown className="ml-auto" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="comparison-content">
        <Table className="comparison-table">
          <TableCaption>
            All descriptions, prices, and stock below are fixture data.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Sample price</TableHead>
              <TableHead>Sample fit</TableHead>
              <TableHead>Sample stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => (
              <TableRow key={candidate.product.id}>
                <TableCell className="font-medium">
                  {candidate.product.name}
                </TableCell>
                <TableCell>
                  {currencySymbol(candidate.offer.price.currency)}
                  {candidate.offer.price.amount.toLocaleString("en-SG")}
                </TableCell>
                <TableCell>
                  {candidate.reasons
                    .filter((reason) => !reason.startsWith("Tradeoff."))
                    .join(" ")}
                </TableCell>
                <TableCell>
                  {candidate.offer.availability === "sample-in-stock"
                    ? "In stock in fixture"
                    : candidate.offer.availability === "sample-unavailable"
                      ? "Unavailable in fixture"
                      : "Unknown in fixture"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}

const providerNames: Record<ProviderEvent["provider"], string> = {
  discovery: "Catalog discovery",
  research: "Fixture research",
  merchant: "Sample offer check",
};
const outcomeNames: Record<ProviderEvent["outcome"], string> = {
  ok: "Completed",
  failed: "Failed",
  timeout: "Timed out",
};

export function ToolActivity({ events }: { events: ProviderEvent[] }) {
  if (events.length === 0) return null;
  return (
    <Trace className="tool-activity">
      <TraceCollapsible>
        <TraceCollapsibleTrigger className="min-h-10">
          <TraceLine>
            <TraceIcon>
              <Search />
            </TraceIcon>
            <TraceTitle>
              Recorded activity · {events.length} outcomes
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <p className="metadata mb-3">
            Provider outcomes recorded before this response. This is not a
            complete audit or live inventory check.
          </p>
          <Trace>
            {events.map((event, index) => (
              <TraceLine
                key={`${event.provider}-${index}`}
                status={event.outcome === "ok" ? undefined : "error"}
              >
                <TraceIcon>
                  {event.outcome === "ok" ? <Check /> : <CircleAlert />}
                </TraceIcon>
                <TraceTitle className="whitespace-normal">
                  {providerNames[event.provider]} ·{" "}
                  {outcomeNames[event.outcome]}
                </TraceTitle>
              </TraceLine>
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

function PreferenceNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="preference-notes">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

export function Results({
  outcome,
  onSelect,
  onRetry,
  selectingId,
  selectionError,
}: {
  outcome: TurnResponse | null;
  onSelect: (candidate: Candidate) => void;
  onRetry: () => void;
  selectingId: string | null;
  selectionError: string | null;
}) {
  if (!outcome)
    return (
      <Empty className="empty-results">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>
            A useful answer, with the trade-offs close by.
          </EmptyTitle>
          <EmptyDescription>
            Describe what you need. Compare a short list, check the evidence,
            then choose a product page.
          </EmptyDescription>
        </EmptyHeader>
        <p className="metadata">Headphones and laptops · sample catalog only</p>
      </Empty>
    );

  return (
    <section className="results-area" aria-labelledby="results-heading">
      <div className="results-header">
        <div>
          <p className="section-kicker">RESEARCH SUMMARY</p>
          <h2 id="results-heading">Your shortlist</h2>
        </div>
        <Badge variant="outline">Fixture data</Badge>
      </div>
      {outcome.kind === "recommendations" && (
        <>
          <p className="answer-first">{outcome.answer}</p>
          <PreferenceNotes notes={outcome.notes} />
          <div className="shortlist-heading">
            <h3>{outcome.candidates.length} options that fit</h3>
            <span className="metadata">
              <ShieldCheck aria-hidden="true" /> Hard limits applied
            </span>
          </div>
          <div className="product-grid">
            {outcome.candidates.map((candidate, index) => (
              <ProductCard
                key={candidate.product.id}
                candidate={candidate}
                index={index}
                onSelect={() => onSelect(candidate)}
                selecting={selectingId === candidate.product.id}
              />
            ))}
          </div>
          {selectionError && (
            <Alert variant="destructive" className="selection-error">
              <CircleAlert />
              <AlertDescription>{selectionError}</AlertDescription>
            </Alert>
          )}
          <Comparison candidates={outcome.candidates} />
        </>
      )}
      {outcome.kind !== "recommendations" && (
        <>
          <Alert
            className={`message-panel ${outcome.kind === "clarification" ? "clarification-panel" : outcome.kind === "no-match" ? "no-match-panel" : "error-panel"}`}
            variant={outcome.kind === "error" ? "destructive" : "default"}
            role={outcome.kind === "error" ? "alert" : "status"}
          >
            <CircleAlert />
            <AlertTitle>
              <h3>
                {outcome.kind === "clarification"
                  ? "One thing to clarify"
                  : outcome.kind === "no-match"
                    ? "No sample option meets these limits"
                    : "Research paused"}
              </h3>
            </AlertTitle>
            <AlertDescription>
              <p>{outcome.message}</p>
              {outcome.kind === "no-match" && (
                <p>
                  The demo kept your hard limits. Edit them if you want to
                  explore a wider set.
                </p>
              )}
              {outcome.kind === "error" && (
                <Button variant="outline" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </AlertDescription>
          </Alert>
          <PreferenceNotes notes={outcome.notes} />
        </>
      )}
      <ToolActivity events={outcome.toolActivity} />
    </section>
  );
}

export function Handoff({
  result,
  onReset,
}: {
  result: Extract<SelectionResult, { kind: "handoff" }>;
  onReset: () => void;
}) {
  const price = result.offer.price;
  return (
    <Card
      className="handoff-panel"
      role="region"
      aria-labelledby="handoff-heading"
    >
      <CardHeader>
        <Badge className="w-fit" variant="secondary">
          Product page handoff
        </Badge>
        <h2 id="handoff-heading">{result.productName}</h2>
        <p className="text-muted-foreground">{result.label}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="handoff-offer">
          <strong>
            {currencySymbol(price.currency)}
            {price.amount.toLocaleString("en-SG")}
          </strong>
          <span className="metadata">Sample price · fixture only</span>
        </div>
        <p className="handoff-domain">
          Merchant host <code>{new URL(result.productUrl).hostname}</code>
        </p>
        <a
          href={result.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({
            className: "merchant-link h-auto min-h-11 whitespace-normal py-2",
          })}
        >
          Open manufacturer product page <ArrowUpRight aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <p className="metadata">
          The link passed the demo's HTTPS and approved-host checks. The sample
          price and stock were not checked live.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={onReset}>
          Start a new search
        </Button>
      </CardFooter>
    </Card>
  );
}
