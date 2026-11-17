import { useState } from "react";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import type { WebResearchResponse } from "../domain/web-research";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import type { TaskState } from "./useConversation";

function excerptPreview(highlights: string[]) {
  const first = Array.from(highlights[0] ?? "");
  return `${first.slice(0, 160).join("")}${first.length > 160 || highlights.length > 1 ? "…" : ""}`;
}

export function WebResearch({ state, active, onRequest }: {
  state: TaskState<WebResearchResponse>;
  active: boolean;
  onRequest: () => void;
}) {
  const [showMoreSources, setShowMoreSources] = useState(false);
  function requestResearch() { setShowMoreSources(false); onRequest(); }
  if (!active && state.status === "idle") return null;

  return (
    <section className="web-research" aria-label="Web context">
      <div className="web-research-header">
        <div>
          <p className="section-kicker">OPTIONAL SOURCES</p>
          <h3 >Web context</h3>
        </div>
        {active && (state.status === "idle"
          || state.status === "cancelled"
          || state.status === "pending"
          || state.status === "failed") && (
          <Button
            variant="outline"
            className="web-research-button"
            onClick={requestResearch}
            disabled={state.status === "pending"}
          >
            <Search aria-hidden="true" />
            {state.status === "pending"
              ? "Searching the web…"
              : (state.status === "idle" || state.status === "cancelled")
                ? "Search the web for context"
                : "Try web research again"}
          </Button>
        )}
      </div>
      <p className="web-research-limit">
        This explicit search uses Exa when enabled and may incur API charges. Source excerpts are separate from fixture claims. They do not
        establish the sample price or stock, and retrieval time is not page freshness.
      </p>
      {state.status === "cancelled" && <p className="metadata" role="status">Web research stopped.</p>}
      {state.status === "pending" && (
        <p className="web-research-status" role="status">
          Searching sources for this shortlist…
        </p>
      )}
      {state.status === "failed" && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.status === "complete" && state.value.status === "disabled" && (
        <p className="web-research-status" role="status">
          Web research is not enabled for this session.
        </p>
      )}
      {state.status === "complete" && state.value.status === "unavailable" && (
        <Alert role="status">
          <AlertDescription>
            {state.value.reason === "timeout"
              ? "Web research timed out. You can try again."
              : state.value.reason === "invalid-response"
                ? "Web research returned unusable source data. You can try again."
                : "Web research is temporarily unavailable. You can try again."}
            {active && <Button
              variant="outline"
              className="web-research-retry"
              onClick={requestResearch}
            >
              Try web research again
            </Button>}
          </AlertDescription>
        </Alert>
      )}
      {state.status === "complete" && state.value.status === "ready" && (
        <>
          <p className="metadata web-research-retrieved">
            Retrieved {new Date(state.value.retrievedAt).toLocaleString("en-SG", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            })} UTC
            {state.value.truncated ? " · Some source details were shortened or omitted" : ""}
          </p>
          {state.value.results.length === 0 ? (
            <p className="web-research-status" role="status">
              No safe source excerpts were available for this shortlist.
            </p>
          ) : (
            <Trace className="web-research-sources">
              <TraceCollapsible>
                <TraceCollapsibleTrigger className="min-h-11">
                  <TraceLine>
                    <TraceIcon><BookOpen /></TraceIcon>
                    <TraceTitle>{state.value.results.length} web source{state.value.results.length === 1 ? "" : "s"}</TraceTitle>
                  </TraceLine>
                </TraceCollapsibleTrigger>
                <TraceCollapsibleContent>
                  <ul className="web-research-list">
                    {state.value.results.slice(0, showMoreSources ? undefined : 3).map((source) => {
                      const host = new URL(source.url).hostname;
                      const hasExcerpt = source.highlights.length > 0;
                      return (
                        <li className="web-research-source" key={source.url}>
                          <a
                            className="source-link web-research-link"
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {source.title} <ArrowUpRight aria-hidden="true" />
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                          <p className="metadata">HTTPS · {host}</p>
                          {hasExcerpt ? (
                            <>
                              <p className="web-research-preview">{excerptPreview(source.highlights)}</p>
                              <Collapsible className="web-research-excerpt">
                                <CollapsibleTrigger
                                  className="web-research-excerpt-trigger"
                                  aria-label={`Read full excerpt from ${source.title}`}
                                >
                                  Read full excerpt
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <ul className="web-research-highlights">
                                    {source.highlights.map((highlight, index) => (
                                      <li key={`${index}-${highlight}`}>{highlight}</li>
                                    ))}
                                  </ul>
                                </CollapsibleContent>
                              </Collapsible>
                            </>
                          ) : (
                            <p className="metadata">No excerpt was provided.</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {!showMoreSources && state.value.results.length > 3 && (
                    <Button
                      variant="outline"
                      className="web-research-more"
                      onClick={() => setShowMoreSources(true)}
                    >
                      Show {state.value.results.length - 3} more sources
                    </Button>
                  )}
                </TraceCollapsibleContent>
              </TraceCollapsible>
            </Trace>
          )}
        </>
      )}
    </section>
  );
}
