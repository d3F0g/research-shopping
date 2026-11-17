import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import type { Preferences, ProductId } from "../domain/contracts";
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
import { researchShortlist } from "./api";

type ResearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "response"; response: WebResearchResponse }
  | { status: "connection-error"; message: string };

function excerptPreview(highlights: string[]) {
  const first = Array.from(highlights[0] ?? "");
  return `${first.slice(0, 160).join("")}${first.length > 160 || highlights.length > 1 ? "…" : ""}`;
}

export function WebResearch({
  productIds,
  preferences,
}: {
  productIds: ProductId[];
  preferences: Preferences;
}) {
  const [state, setState] = useState<ResearchState>({ status: "idle" });
  const [showMoreSources, setShowMoreSources] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  useEffect(() => () => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  async function requestResearch() {
    if (controllerRef.current) return;
    setShowMoreSources(false);
    const controller = new AbortController();
    const generation = ++generationRef.current;
    controllerRef.current = controller;
    setState({ status: "loading" });
    try {
      const response = await researchShortlist(
        { productIds, preferences },
        controller.signal,
      );
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setState({ status: "response", response });
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setState({
        status: "connection-error",
        message: error instanceof Error
          ? error.message
          : "Web research could not finish. Try again.",
      });
    } finally {
      if (
        !controller.signal.aborted
        && generation === generationRef.current
        && controllerRef.current === controller
      ) {
        controllerRef.current = null;
      }
    }
  }

  return (
    <section className="web-research" aria-labelledby="web-research-heading">
      <div className="web-research-header">
        <div>
          <p className="section-kicker">OPTIONAL SOURCES</p>
          <h3 id="web-research-heading">Web context</h3>
        </div>
        {(state.status === "idle"
          || state.status === "loading"
          || state.status === "connection-error") && (
          <Button
            variant="outline"
            className="web-research-button"
            onClick={() => void requestResearch()}
            disabled={state.status === "loading"}
          >
            <Search aria-hidden="true" />
            {state.status === "loading"
              ? "Searching the web…"
              : state.status === "idle"
                ? "Search the web for context"
                : "Try web research again"}
          </Button>
        )}
      </div>
      <p className="web-research-limit">
        Optional source excerpts are separate from fixture claims. They do not
        establish the sample price or stock, and retrieval time is not page freshness.
      </p>
      {state.status === "loading" && (
        <p className="web-research-status" role="status">
          Searching sources for this shortlist…
        </p>
      )}
      {state.status === "connection-error" && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.status === "response" && state.response.status === "disabled" && (
        <p className="web-research-status" role="status">
          Web research is not enabled for this session.
        </p>
      )}
      {state.status === "response" && state.response.status === "unavailable" && (
        <Alert role="status">
          <AlertDescription>
            {state.response.reason === "timeout"
              ? "Web research timed out. You can try again."
              : state.response.reason === "invalid-response"
                ? "Web research returned unusable source data. You can try again."
                : "Web research is temporarily unavailable. You can try again."}
            <Button
              variant="outline"
              className="web-research-retry"
              onClick={() => void requestResearch()}
            >
              Try web research again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {state.status === "response" && state.response.status === "ready" && (
        <>
          <p className="metadata web-research-retrieved">
            Retrieved {new Date(state.response.retrievedAt).toLocaleString("en-SG", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            })} UTC
            {state.response.truncated ? " · Some source details were shortened or omitted" : ""}
          </p>
          {state.response.results.length === 0 ? (
            <p className="web-research-status" role="status">
              No safe source excerpts were available for this shortlist.
            </p>
          ) : (
            <Trace className="web-research-sources">
              <TraceCollapsible>
                <TraceCollapsibleTrigger className="min-h-11">
                  <TraceLine>
                    <TraceIcon><BookOpen /></TraceIcon>
                    <TraceTitle>{state.response.results.length} web source{state.response.results.length === 1 ? "" : "s"}</TraceTitle>
                  </TraceLine>
                </TraceCollapsibleTrigger>
                <TraceCollapsibleContent>
                  <ul className="web-research-list">
                    {state.response.results.slice(0, showMoreSources ? undefined : 3).map((source) => {
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
                  {!showMoreSources && state.response.results.length > 3 && (
                    <Button
                      variant="outline"
                      className="web-research-more"
                      onClick={() => setShowMoreSources(true)}
                    >
                      Show {state.response.results.length - 3} more sources
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
