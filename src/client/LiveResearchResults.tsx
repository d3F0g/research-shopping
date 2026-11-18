import { ArrowUpRight, BookOpen, ChevronDown, Search } from "lucide-react";
import type {
  ApplicationTurnResponse,
  ResearchSnapshot,
} from "../domain/research";
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
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

type Source = ResearchSnapshot["sources"][number];
function SourceLink({ source }: { source: Source }) {
  return (
    <a
      className="source-link"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      View source <ArrowUpRight aria-hidden="true" />
      <span className="sr-only"> {source.title} (opens in a new tab)</span>
    </a>
  );
}
function Citation({ source }: { source: Source }) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Button variant="secondary" size="xs" className="citation-trigger" />
        }
        aria-label={`Preview source ${source.title}`}
      >
        <BookOpen aria-hidden="true" /> Source
      </HoverCardTrigger>
      <HoverCardContent className="citation-preview" align="start">
        <p className="font-medium">{source.title}</p>
        <p className="metadata my-2">
          {new URL(source.url).hostname} · Page observation
        </p>
        <SourceLink source={source} />
      </HoverCardContent>
    </HoverCard>
  );
}
export function LiveResearchResults({
  outcome,
}: {
  outcome: Extract<
    ApplicationTurnResponse,
    { kind: "research" | "research-unavailable" }
  >;
}) {
  if (outcome.kind === "research-unavailable")
    return (
      <section className="results-area message-panel" role="status">
        <h2>Research unavailable</h2>
        <p>{outcome.message}</p>
      </section>
    );
  const research = outcome.research;
  const sourceById = new Map(
    research.sources.map((source) => [source.id, source]),
  );
  return (
    <section
      className="results-area live-research"
      aria-label="Web product research"
    >
      <p className="answer-first">{outcome.answer}</p>
      {research.products.length > 0 && (
        <>
          <div className="shortlist-heading">
            <h2>Research leads</h2>
            <span className="metadata">
              {research.products.length} source-backed leads
            </span>
          </div>
          <div className="product-grid">
            {research.products.map((product) => (
              <Card
                className="product-card research-card"
                role="article"
                aria-label={product.name}
                key={product.id}
              >
                <CardContent>
                  <div className="product-row">
                    <div className="product-identity">
                      <h3>{product.name}</h3>
                      <p className="metadata">
                        Research lead · Stock and delivery unverified
                      </p>
                    </div>
                  </div>
                  {product.price ? (
                    <div className="observed-price">
                      <Badge variant="secondary">
                        {product.price.kind === "page-price-context-unverified"
                          ? "Page price excerpt · Unverified"
                          : "Page-observed price · Unverified"}
                      </Badge>
                      <p>{product.price.quote}</p>
                    </div>
                  ) : (
                    <p className="metadata">
                      No attributable price observation
                    </p>
                  )}
                  {!product.facts.length && (
                    <p className="metadata">Specifications not established by this source.</p>
                  )}
                  {product.facts[0] && (
                    <p className="product-summary research-preview">
                      {product.facts[0].quote.length > 180
                        ? `${product.facts[0].quote.slice(0, 180)}…`
                        : product.facts[0].quote}
                    </p>
                  )}
                  <Trace className="evidence-details">
                    <TraceCollapsible>
                      <TraceCollapsibleTrigger className="min-h-11">
                        <TraceLine>
                          <TraceIcon>
                            <BookOpen />
                          </TraceIcon>
                          <TraceTitle>Evidence and limits</TraceTitle>
                        </TraceLine>
                      </TraceCollapsibleTrigger>
                      <TraceCollapsibleContent>
                        <ul className="claim-list">
                          {[
                            product.identity,
                            ...product.facts,
                            ...(product.price ? [product.price] : []),
                          ].map((citation, index) => {
                            const source = sourceById.get(citation.sourceId)!;
                            return (
                              <li key={index}>
                                <blockquote>{citation.quote}</blockquote>
                                <Citation source={source} />
                                <SourceLink source={source} />
                              </li>
                            );
                          })}
                        </ul>
                        <p className="metadata">Needs verification</p>
                        <ul className="preference-notes">
                          {product.unresolvedConstraints.map((constraint) => (
                            <li key={constraint}>{constraint}</li>
                          ))}
                        </ul>
                      </TraceCollapsibleContent>
                    </TraceCollapsible>
                  </Trace>
                  <SourceLink source={sourceById.get(product.identity.sourceId)!} />
                </CardContent>
              </Card>
            ))}
          </div>
          {research.products.length > 1 && (
            <Collapsible className="comparison-panel">
              <CollapsibleTrigger
                render={<Button variant="outline" />}
                className="comparison-trigger"
              >
                Compare research leads <ChevronDown aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent
                className="comparison-content"
                role="region"
                aria-label="Research lead comparison"
              >
                <p className="metadata comparison-notice">
                  Page observations are unverified. Stock, delivery and current affordability remain unknown.
                </p>
                <ul className="comparison-leads">
                  {research.products.map((product) => (
                    <li key={product.id}>
                      <Card
                        className="comparison-lead"
                        size="sm"
                        role="group"
                        aria-label={product.name}
                      >
                        <CardContent>
                          <h3>{product.name}</h3>
                          <dl className="comparison-overview">
                            <div>
                              <dt>Source specifications</dt>
                              <dd>
                                {product.facts.length
                                  ? `${product.facts.length} quoted specification${product.facts.length === 1 ? "" : "s"}`
                                  : "Not established by this source"}
                              </dd>
                            </div>
                            <div>
                              <dt>Observed price · Unverified</dt>
                              <dd>{product.price?.quote ?? "Not observed"}</dd>
                            </div>
                          </dl>
                          <Collapsible className="comparison-evidence">
                            <div className="comparison-actions">
                              <CollapsibleTrigger
                                render={<Button variant="ghost" size="sm" />}
                                aria-label={`Evidence for ${product.name}`}
                              >
                                Evidence and limits <ChevronDown aria-hidden="true" />
                              </CollapsibleTrigger>
                              <SourceLink
                                source={sourceById.get(product.identity.sourceId)!}
                              />
                            </div>
                            <CollapsibleContent>
                              <ul className="claim-list">
                                {product.facts.map((fact, index) => (
                                  <li key={index}>
                                    <blockquote>{fact.quote}</blockquote>
                                    <Citation source={sourceById.get(fact.sourceId)!} />
                                  </li>
                                ))}
                              </ul>
                              <p className="metadata">Needs verification</p>
                              <ul className="preference-notes">
                                {product.unresolvedConstraints.map((constraint) => (
                                  <li key={constraint}>{constraint}</li>
                                ))}
                              </ul>
                            </CollapsibleContent>
                          </Collapsible>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
      <Trace className="research-sources">
        <TraceCollapsible>
          <TraceCollapsibleTrigger className="min-h-11">
            <TraceLine>
              <TraceIcon>
                <BookOpen />
              </TraceIcon>
              <TraceTitle>
                {research.sources.length} research sources
              </TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <ul className="web-research-list">
              {research.sources.map((source) => (
                <li className="web-research-source" key={source.id}>
                  <p className="font-medium">{source.title}</p>
                  <SourceLink source={source} />
                  <ul className="web-research-highlights">
                    {source.highlights.map((quote, index) => (
                      <li key={index}>{quote}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
      <Collapsible className="response-details">
        <CollapsibleTrigger render={<Button variant="ghost" />}>
          Research limits <ChevronDown aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="preference-notes">
            {research.limitations.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
            {outcome.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="metadata">
            Retrieved{" "}
            {new Date(research.retrievedAt).toLocaleString("en-SG", {
              timeZone: "UTC",
            })}{" "}
            UTC. Retrieval time is not price freshness.
          </p>
        </CollapsibleContent>
      </Collapsible>
      <Trace className="tool-activity">
        <TraceCollapsible>
          <TraceCollapsibleTrigger className="min-h-11">
            <TraceLine>
              <TraceIcon>
                <Search />
              </TraceIcon>
              <TraceTitle>Completed web research</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <p className="metadata">
              One search returned {research.sources.length} source pages. This
              is not a merchant inventory check.
            </p>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
    </section>
  );
}
