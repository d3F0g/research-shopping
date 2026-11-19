import type { LegacyApplicationTurnResponse } from "../domain/research-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function LegacyResearchResults({
  outcome,
}: {
  outcome: Extract<
    LegacyApplicationTurnResponse,
    { kind: "research" | "research-unavailable" }
  >;
}) {
  if (outcome.kind === "research-unavailable") return <p>{outcome.message}</p>;
  const sources = new Map(
    outcome.research.sources.map((source) => [source.id, source]),
  );
  return (
    <section
      className="live-research"
      aria-label="Historical research snapshot"
    >
      <p className="answer-first">{outcome.answer}</p>
      <p className="metadata">
        Earlier research snapshot. Prices, stock and delivery remain unverified.
      </p>
      <div className="product-grid">
        {outcome.research.products.map((product) => (
          <Card
            className="product-card research-card"
            key={product.id}
            role="article"
            aria-label={product.name}
          >
            <CardContent>
              <h3>{product.name}</h3>
              <p>{product.price?.quote ?? "Price not observed"}</p>
              <Collapsible>
                <CollapsibleTrigger render={<Button variant="ghost" />}>
                  Historical evidence and limits
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul>
                    {[
                      "identity" in product ? [product.identity] : [],
                      product.facts,
                      product.price ? [product.price] : [],
                    ]
                      .flat()
                      .map((citation, index) => (
                        <li key={index}>
                          <blockquote>{citation.quote}</blockquote>
                          <a
                            className="source-link"
                            href={sources.get(citation.sourceId)!.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View historical source
                          </a>
                        </li>
                      ))}
                  </ul>
                  <ul className="preference-notes">
                    {product.unresolvedConstraints.map((constraint) => (
                      <li key={constraint}>{constraint}</li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
      </div>
      <Collapsible>
        <CollapsibleTrigger render={<Button variant="ghost" />}>
          {outcome.research.sources.length} historical research sources
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="web-research-list">
            {outcome.research.sources.map((source) => (
              <li key={source.id}>
                <p>{source.title}</p>
                <a
                  className="source-link"
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View historical source
                </a>
                <ul>
                  {source.highlights.map((quote, index) => (
                    <li key={index}>
                      <blockquote>{quote}</blockquote>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
      <ul className="preference-notes">
        {outcome.research.limitations.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>
    </section>
  );
}
