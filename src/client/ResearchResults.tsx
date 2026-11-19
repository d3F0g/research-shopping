import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  ListFilter,
  Search,
} from "lucide-react";
import type {
  Candidate,
  ProviderEvent,
  Source,
  TurnResponse,
} from "../domain/legacy-contracts";
import { isApprovedUrl } from "../domain/merchant-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
}: {
  candidate: Candidate;
  index: number;
}) {
  const { offer, product } = candidate;
  return (
    <Card
      className={`product-card ${index === 0 ? "top-pick" : ""}`}
      role="article"
      aria-label={product.name}
    >
      <CardContent>
        <div className="product-row">
          <span className="product-rank" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="product-identity">
            <h3>{product.name}</h3>
            <p className="metadata">
              {index === 0 ? "Leading sample match" : "Sample option"} · Fixture
              data
            </p>
          </div>
          <div className="product-price">
            <strong>
              {currencySymbol(offer.price.currency)}
              {offer.price.amount.toLocaleString("en-SG")}
            </strong>
            <p className="metadata">Sample price · fixture only</p>
          </div>
        </div>
        <div className="product-context">
          <p>
            {candidate.reasons
              .filter(
                (reason) =>
                  !reason.startsWith("Sample price") &&
                  !reason.startsWith("Tradeoff."),
              )
              .slice(0, 1)
              .join(" ") || "Sample price meets your stated limits."}
          </p>
          <p className="metadata">
            {offer.availability === "sample-in-stock"
              ? "Sample says in stock"
              : offer.availability === "sample-unavailable"
                ? "Sample says unavailable"
                : "Sample stock unknown"}{" "}
            · Fixture snapshot · {fixtureDate(offer.observedAt)} ·{" "}
            {offer.region}
          </p>
          <p className="tradeoff">
            {candidate.reasons.find((reason) =>
              reason.startsWith("Tradeoff."),
            ) ??
              "Tradeoff. Sample evidence does not establish real-world quality, current price or stock."}
          </p>
        </div>
        <div className="product-actions">
          <ClaimDetails candidate={candidate} />
        </div>
      </CardContent>
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

export function Results({ outcome }: { outcome: TurnResponse }) {
  if (outcome.kind === "message")
    return <p className="ordinary-message">{outcome.message}</p>;
  return (
    <section className="results-area" aria-label="Research response">
      {outcome.kind === "recommendations" ? (
        <>
          <p className="answer-first">{outcome.answer}</p>
          <div className="shortlist-heading">
            <h2>Your shortlist</h2>
            <span className="metadata">
              {outcome.candidates.length} sample{" "}
              {outcome.candidates.length === 1 ? "option" : "options"}
            </span>
          </div>
          <div className="product-grid">
            {outcome.candidates.map((candidate, index) => (
              <ProductCard
                key={candidate.product.id}
                candidate={candidate}
                index={index}
              />
            ))}
          </div>
          {outcome.candidates.length > 1 && (
            <Comparison candidates={outcome.candidates} />
          )}
          {
            <p className="metadata historical-note">
              Earlier shortlist. Send a message to refresh these options.
            </p>
          }
        </>
      ) : (
        <div
          className={`message-panel ${outcome.kind === "clarification" ? "clarification-panel" : outcome.kind === "no-match" ? "no-match-panel" : "error-panel"}`}
          role={outcome.kind === "error" ? "alert" : undefined}
        >
          <h2>
            {outcome.kind === "clarification"
              ? "One thing to clarify"
              : outcome.kind === "no-match"
                ? "No sample option meets these limits"
                : "Research paused"}
          </h2>
          <p>{outcome.message}</p>
        </div>
      )}
      <Collapsible className="response-details">
        <CollapsibleTrigger render={<Button variant="ghost" />}>
          Response notes <ChevronDown aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <PreferenceNotes notes={outcome.notes} />
        </CollapsibleContent>
      </Collapsible>
      <ToolActivity events={outcome.toolActivity} />
    </section>
  );
}
