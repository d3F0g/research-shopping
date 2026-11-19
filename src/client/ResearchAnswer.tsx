import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
  TraceLine,
  TraceTitle,
  TraceIcon,
} from "@/components/ui/trace";
import type {
  Assessment,
  ResearchProduct,
  ResearchSnapshot,
} from "../domain/research";

function Citation({
  source,
  quote,
}: {
  source: ResearchSnapshot["sources"][number];
  quote: string;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger render={<Button variant="secondary" size="xs" />}>
        {new URL(source.url).hostname}
      </HoverCardTrigger>
      <HoverCardContent className="max-w-[calc(100vw-2rem)]">
        <p>{source.title}</p>
        <a href={source.url} target="_blank" rel="noreferrer noopener">
          Open source<span className="sr-only"> in a new tab</span>
        </a>
      </HoverCardContent>
      <blockquote className="mt-2 whitespace-pre-wrap break-words border-l pl-3">
        {quote}
      </blockquote>
    </HoverCard>
  );
}
function Evidence({
  label,
  assessment,
  snapshot,
}: {
  label: string;
  assessment: Assessment;
  snapshot: ResearchSnapshot;
}) {
  return (
    <div className="space-y-2">
      <p>
        {label} <Badge variant="outline">{assessment.status}</Badge>{" "}
        <span className="text-muted-foreground">{assessment.scope}</span>
      </p>
      <p>{assessment.rationale}</p>
      {assessment.support.map((span, i) => {
        const source = snapshot.sources.find((s) => s.id === span.sourceId);
        return source ? (
          <Citation key={i} source={source} quote={span.quote} />
        ) : null;
      })}
    </div>
  );
}
function Product({
  product,
  snapshot,
}: {
  product: ResearchProduct;
  snapshot: ResearchSnapshot;
}) {
  const [failed, setFailed] = useState(false);
  const source = snapshot.sources.find((s) =>
    product.identity.support.some((span) => span.sourceId === s.id),
  );
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>{product.name}</CardTitle>
          {snapshot.choice?.productId === product.id && (
            <Badge>Source-supported option</Badge>
          )}
        </div>
        <CardDescription>
          {product.variant ?? "Variant unresolved"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {source?.imageUrl && !failed && (
          <figure className="space-y-1">
            <img
              className="h-28 max-w-full object-contain"
              src={source.imageUrl}
              alt={`Source illustration for ${product.name}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
            <figcaption className="text-xs text-muted-foreground">
              Representative source illustration. Exact variant unverified.
            </figcaption>
          </figure>
        )}
        <p>
          {product.price ? (
            <>
              <strong>
                {product.price.currency} {product.price.amount.toFixed(2)}
              </strong>{" "}
              observed, unverified
              {product.price.conditions.length
                ? ` · ${product.price.conditions.join(", ")}`
                : ""}
              {!product.price.conditionsResolved && " · Conditions unresolved"}
            </>
          ) : (
            "No qualifying observed price"
          )}
        </p>
        <p className="text-muted-foreground">Stock and delivery unknown.</p>
        <p>{product.requestMatch.rationale}</p>
        {product.blockers.length > 0 && (
          <p className="text-muted-foreground">
            Unresolved: {product.blockers.slice(0, 2).join(" ")}
            {product.blockers.length > 2 &&
              ` Plus ${product.blockers.length - 2} more in evidence.`}
          </p>
        )}
        <Trace>
          <TraceCollapsible>
            <TraceCollapsibleTrigger
              aria-label={`Evidence and tradeoffs for ${product.name}`}
            >
              <TraceLine>
                <TraceIcon>
                  <FileText />
                </TraceIcon>
                <TraceTitle>Evidence and tradeoffs</TraceTitle>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent className="space-y-5">
              <Evidence
                label="Product identity"
                assessment={product.identity}
                snapshot={snapshot}
              />
              <Evidence
                label="Complete request fit"
                assessment={product.requestMatch}
                snapshot={snapshot}
              />
              {product.requirements.map((row) => (
                <Evidence
                  key={row.requirementId}
                  label={
                    snapshot.intent.requirements.find(
                      (r) => r.id === row.requirementId,
                    )?.text ?? "Requirement"
                  }
                  assessment={row.assessment}
                  snapshot={snapshot}
                />
              ))}
              {product.attributes.map((row, i) => (
                <Evidence
                  key={i}
                  label={row.name}
                  assessment={row.assessment}
                  snapshot={snapshot}
                />
              ))}
              {product.price && (
                <Evidence
                  label="Observed price"
                  assessment={product.price.assessment}
                  snapshot={snapshot}
                />
              )}
              {product.blockers.map((blocker, i) => (
                <p key={i}>{blocker}</p>
              ))}
              <p className="text-muted-foreground">
                AI interpretations of cited sources. Stock, delivery and
                merchant offers remain unverified.
              </p>
            </TraceCollapsibleContent>
          </TraceCollapsible>
        </Trace>
      </CardContent>
      {source && (
        <CardFooter>
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <a href={source.url} target="_blank" rel="noreferrer noopener" />
            }
          >
            View product source <ExternalLink />
            <span className="sr-only">opens in a new tab</span>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
export function ResearchAnswer({ snapshot }: { snapshot: ResearchSnapshot }) {
  return (
    <div className="space-y-4">
      {snapshot.dataKind === "test-fixture" && (
        <Badge variant="outline">
          Fixture data. Automated test substitute.
        </Badge>
      )}
      <div className="grid gap-4">
        {snapshot.products.map((product) => (
          <Product key={product.id} product={product} snapshot={snapshot} />
        ))}
      </div>
      <Trace>
        <TraceCollapsible>
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceTitle>Sources and research limits</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent className="space-y-2">
            {snapshot.limitations.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
            {snapshot.sources.map((s) => (
              <p key={s.id}>
                <a
                  className="underline"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {s.title || new URL(s.url).hostname}
                </a>
                {s.textTruncated &&
                  " · Source text cut. Cut context cannot establish complete support."}
              </p>
            ))}
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
    </div>
  );
}
