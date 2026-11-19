import { useState } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, ImageOff, Search } from "lucide-react";
import {
  choiceAssessment,
  eligibleForChoice,
  type ApplicationTurnResponse,
  type Assessment,
  type ResearchProduct,
  type ResearchSnapshot,
  type ResearchSource,
} from "../domain/research";
import type { ApplicationTurnResponse as Version3ApplicationTurnResponse } from "../domain/research-evidence-v3";
import type { ApplicationTurnResponse as Version4ApplicationTurnResponse } from "../domain/research-evidence-v4";
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

function SourceLink({
  source,
  label = "View source",
}: {
  source: ResearchSource;
  label?: string;
}) {
  return (
    <a
      className="source-link"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
      <ArrowUpRight aria-hidden="true" />
      <span className="sr-only"> {source.title} (opens in a new tab)</span>
    </a>
  );
}
function Citation({ source }: { source: ResearchSource }) {
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
        <p className="metadata my-2">{new URL(source.url).hostname}</p>
        <SourceLink source={source} />
      </HoverCardContent>
    </HoverCard>
  );
}
function SourceIllustration({ source }: { source: ResearchSource | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="source-illustration">
      {source?.imageUrl && !failed ? (
        <img
          src={source.imageUrl}
          alt={`Source illustration from ${source.title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="source-illustration-fallback" role="img" aria-label="Source illustration unavailable">
          <ImageOff aria-hidden="true" />
        </div>
      )}
      <figcaption>
        {source?.imageUrl && !failed ? (
          <>
            <SourceLink source={source} label="Source illustration" />
            <span>{new URL(source.url).hostname}</span>
            <span>Representative only. Exact variant unverified.</span>
          </>
        ) : (
          <span>No source illustration available.</span>
        )}
      </figcaption>
    </figure>
  );
}
const statusLabels: Record<Assessment["status"], string> = {
  supported: "Supported",
  unknown: "Unknown",
  contradicted: "Contradicted",
  conflict: "Conflicting sources",
};
const scopeLabels: Record<Assessment["scope"], string> = {
  "exact-variant": "Exact variant",
  "product-family": "Product family only",
  unclear: "Variant scope unclear",
};
function Status({ assessment }: { assessment: Assessment }) {
  return (
    <Badge
      className="assessment-status"
      variant={assessment.status === "supported" ? "secondary" : "outline"}
    >
      {assessment.status === "supported" && assessment.scope !== "exact-variant"
        ? scopeLabels[assessment.scope]
        : statusLabels[assessment.status]}
    </Badge>
  );
}
function AssessmentEvidence({
  label,
  assessment,
  sources,
}: {
  label: string;
  assessment: Assessment;
  sources: Map<string, ResearchSource>;
}) {
  return (
    <li className="assessment-evidence">
      <p className="font-medium">{label}</p>
      <p>
        <Status assessment={assessment} /> {scopeLabels[assessment.scope]}
      </p>
      <p>{assessment.rationale}</p>
      {assessment.support.map((span, index) => {
        const source = sources.get(span.sourceId)!;
        return (
          <div key={`${span.sourceId}-${index}`}>
            <p className="metadata">Literal source passage</p>
            <blockquote>{span.quote}</blockquote>
            <Citation source={source} />
            <SourceLink source={source} />
          </div>
        );
      })}
      {!assessment.support.length && (
        <p className="metadata">No supporting passage retained.</p>
      )}
    </li>
  );
}
function assessments(
  product: ResearchProduct,
  snapshot: { intent: Pick<ResearchSnapshot["intent"], "criteria"> },
) {
  return [
    { id: "identity", label: "Product identity", assessment: product.identity },
    {
      id: "request-match",
      label: "Match to your request",
      assessment: product.requestMatch,
    },
    ...product.criteria.map((row) => ({
      id: row.criterionId,
      label: `${snapshot.intent.criteria.find((criterion) => criterion.id === row.criterionId)!.strength === "hard" ? "Required" : "Flexible"} · ${snapshot.intent.criteria.find((criterion) => criterion.id === row.criterionId)!.wording}`,
      assessment: row.assessment,
    })),
    ...product.attributes.map((attribute) => ({
      id: `attribute:${attribute.name}`,
      label: attribute.name,
      assessment: attribute.assessment,
    })),
    ...(product.price
      ? [
          {
            id: "price",
            label: "Observed price",
            assessment: product.price.assessment,
          },
        ]
      : []),
    ...(product.budget
      ? [
          {
            id: "budget",
            label: "Observed budget comparison",
            assessment: product.budget,
          },
        ]
      : []),
  ];
}
export function LiveResearchResults({
  outcome,
}: {
  outcome: Extract<
    ApplicationTurnResponse | Version3ApplicationTurnResponse | Version4ApplicationTurnResponse,
    { kind: "research" | "research-unavailable" }
  >;
}) {
  if (outcome.kind === "research-unavailable")
    return (
      <section className="message-panel" aria-label="Research unavailable">
        <h2>Research unavailable</h2>
        <p>{outcome.message}</p>
        <p className="metadata">
          Your preferences are retained. No merchant stock was checked.
        </p>
      </section>
    );
  const research = outcome.research;
  const sourceById = new Map<string, ResearchSource>(
    research.sources.map((source) => [source.id, source]),
  );
  const chosen = research.choice
    ? research.products.find(
        (product) => product.id === research.choice!.productId,
      )!
    : null;
  return (
    <section
      className="live-research results-area"
      aria-label="Source-based shopping comparison"
    >
      <p className="answer-first">{outcome.answer}</p>
      {research.choice && chosen ? (
        <div className="research-choice">
          <h2>Conditional choice · {chosen.name}</h2>
          <p className="metadata">Source-based AI assessment</p>
          <Collapsible>
            <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
              Choice evidence <ChevronDown aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul>
                {research.choice.reasons.map((reason) => (
                  <AssessmentEvidence
                    key={reason.assessmentId}
                    label="Supporting assessment"
                    assessment={choiceAssessment(chosen, reason.assessmentId)!}
                    sources={sourceById}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
          <p>{research.choice.caveat}</p>
        </div>
      ) : (
        <p className="assessment-summary" role="status">
          {research.evidenceVersion === 5 &&
          research.products.some((product) =>
            eligibleForChoice(product, research.intent),
          )
            ? "No conditional choice. Review the tied or unresolved evidence below."
            : "No confirmed fit. The evidence below supports comparison, but does not establish a recommendation that meets every hard requirement."}
        </p>
      )}
      <p className="metadata">
        Source-based AI comparison. Confirm prices, stock and delivery with
        merchants.
      </p>
      <div className="shortlist-heading">
        <h2>Compare the options</h2>
        <span className="metadata">{research.products.length} options</span>
      </div>
      <div className="product-grid">
        {research.products.map((product) => {
          const exactPrice =
            product.price &&
            product.price.assessment.status === "supported" &&
            product.price.assessment.scope === "exact-variant" &&
            product.price.variant === product.variant;
          const identitySource = product.identity.support[0]
            ? sourceById.get(product.identity.support[0].sourceId)!
            : null;
          const illustrationSource = research.evidenceVersion === 5 && product.identity.status === "supported"
            ? product.identity.support
                .map((span) => sourceById.get(span.sourceId)!)
                .find((source) => source.imageUrl) ?? null
            : null;
          return (
            <Card
              className="product-card research-card"
              key={product.id}
              role="article"
              aria-label={product.name}
            >
              <CardContent>
                <div className="product-row">
                  <div className="product-identity">
                    <h3>{product.name}</h3>
                    <p className="metadata">
                      {product.variant ?? "Exact variant unresolved"}
                    </p>
                  </div>
                </div>
                {research.evidenceVersion === 5 && (
                  <SourceIllustration key={illustrationSource?.imageUrl ?? "missing"} source={illustrationSource} />
                )}
                <div className="observed-price">
                  <strong>
                    {exactPrice && product.price
                      ? `${product.price.currency} ${product.price.amount.toLocaleString("en-SG", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
                      : product.price
                        ? "Variant price not established"
                        : "Price or currency not established"}
                  </strong>
                  <p className="metadata">
                    Observed price · Unverified with merchant
                  </p>
                  {product.price && (
                    <>
                      {!exactPrice && (
                        <p>
                          Page price context · {product.price.currency}{" "}
                          {product.price.amount.toLocaleString("en-SG", {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}{" "}
                          · {scopeLabels[product.price.assessment.scope]} ·{" "}
                          {statusLabels[product.price.assessment.status]}
                        </p>
                      )}
                      <p>
                        {product.price.conditions.length
                          ? product.price.conditions.join(" · ")
                          : "No price conditions retained."}
                      </p>
                      <p className="metadata">
                        {!product.price.conditionsResolved &&
                          "Price conditions unresolved · "}
                        Variant {product.price.variant}
                      </p>
                    </>
                  )}
                  <p className="metadata">Stock and delivery unverified</p>
                </div>
                {"explanation" in product && product.explanation ? (
                  <div className="assessment-summary">
                    {(["reasons", "tradeoffs"] as const).map((kind) => {
                      const ids = product.explanation![kind].filter(
                        (id) =>
                          kind === "tradeoffs" ||
                          product.criteria.some(
                            (criterion) => criterion.criterionId === id,
                          ) ||
                          product.attributes.some(
                            (attribute) => `attribute:${attribute.name}` === id,
                          ),
                      );
                      if (!ids.length) return null;
                      const rows = assessments(product, research);
                      return (
                        <div key={kind}>
                          <p className="font-medium">
                            {kind === "reasons"
                              ? "Supported fit"
                              : "Tradeoffs and unknowns"}
                          </p>
                          <dl className="compact-assessments">
                            {ids.map((id) => {
                              const row = rows.find((row) => row.id === id)!;
                              const attribute = product.attributes.some(
                                (attribute) =>
                                  `attribute:${attribute.name}` === id,
                              );
                              return (
                                <div
                                  key={id}
                                  className={
                                    attribute ? "attribute-preview" : undefined
                                  }
                                >
                                  <dt>{row.label}</dt>
                                  <dd>
                                    <Status assessment={row.assessment} />
                                    {attribute &&
                                      row.assessment.status === "supported" &&
                                      row.assessment.scope ===
                                        "exact-variant" && (
                                        <span className="assessment-preview">
                                          {row.assessment.rationale}
                                        </span>
                                      )}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <dl className="assessment-summary compact-assessments">
                    {(product.identity.status !== "supported" ||
                      product.identity.scope !== "exact-variant") && (
                      <div>
                        <dt>Product identity</dt>
                        <dd>
                          <Status assessment={product.identity} />
                        </dd>
                      </div>
                    )}
                    {(product.requestMatch.status !== "supported" ||
                      product.requestMatch.scope !== "exact-variant") && (
                      <div>
                        <dt>Match to your request</dt>
                        <dd>
                          <Status assessment={product.requestMatch} />
                        </dd>
                      </div>
                    )}
                    {product.budget && (
                      <div>
                        <dt>Observed budget comparison</dt>
                        <dd>
                          <Status assessment={product.budget} />
                        </dd>
                      </div>
                    )}
                    {product.criteria.map((row) => {
                      const criterion = research.intent.criteria.find(
                        (item) => item.id === row.criterionId,
                      )!;
                      return (
                        <div key={row.criterionId}>
                          <dt>
                            {criterion.strength === "hard"
                              ? "Required"
                              : "Flexible"}{" "}
                            · {criterion.wording}
                          </dt>
                          <dd>
                            <Status assessment={row.assessment} />
                          </dd>
                        </div>
                      );
                    })}
                    {product.attributes.map((attribute) => (
                      <div className="attribute-preview" key={attribute.name}>
                        <dt>{attribute.name}</dt>
                        <dd>
                          <Status assessment={attribute.assessment} />
                          {attribute.assessment.status === "supported" && (
                            <span className="assessment-preview">
                              {attribute.assessment.rationale}
                            </span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <Trace>
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
                      <p className="metadata">
                        Rationales are AI synthesis. Quotations below are
                        literal retained source passages. A matching quotation
                        does not independently prove the interpretation.
                      </p>
                      <ul>
                        {assessments(product, research).map(
                          ({ label, assessment }) => (
                            <AssessmentEvidence
                              key={label}
                              label={label}
                              assessment={assessment}
                              sources={sourceById}
                            />
                          ),
                        )}
                      </ul>
                    </TraceCollapsibleContent>
                  </TraceCollapsible>
                </Trace>
                {identitySource && (
                  <SourceLink
                    source={identitySource}
                    label="View product source"
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
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
                  <p className="font-medium">
                    {source.title}
                    {source.titleTruncated ? " [title truncated]" : ""}
                  </p>
                  <SourceLink source={source} />
                  <Collapsible>
                    <CollapsibleTrigger render={<Button variant="ghost" />}>
                      Retained source context <ChevronDown aria-hidden="true" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <p className="source-context">{source.text}</p>
                      {source.textTruncated && (
                        <p className="metadata">
                          Source text was truncated. This is the retained
                          context.
                        </p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
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
              One research request returned {research.sources.length} retained
              source pages. No merchant inventory check was performed.
            </p>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
    </section>
  );
}
