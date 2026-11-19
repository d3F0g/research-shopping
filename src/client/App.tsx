import { useEffect, useRef, useState } from "react";
import { ArrowUp, Moon, Plus, Search, Square, Sun, TextSearch } from "lucide-react";
import { LiveResearchResults } from "./LiveResearchResults";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { PreferencePanel } from "./PreferencePanel";
import { BudgetQuestion } from "./PreferenceQuestion";
import { useTheme } from "./theme-provider";
import { useConversation } from "./useConversation";

export function App() {
  const chat = useConversation();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [fixtureMode, setFixtureMode] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/health", { signal: controller.signal })
      .then((response) => response.json())
      .then((health: unknown) => {
        if (
          !controller.signal.aborted &&
          typeof health === "object" &&
          health !== null &&
          "mode" in health
        )
          setFixtureMode(health.mode === "fixture");
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const { theme, setTheme } = useTheme();
  const empty = chat.turns.length === 0;
  const editor = chat.editor;
  const composer = (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        chat.send({ type: "submit" });
      }}
    >
      {chat.preferences.pendingChange &&
        !(!chat.preferences.budget && chat.preferences.pendingChange.kind === "money" &&
          chat.preferences.pendingChange.missingSlot === "currency") && (
        <Alert className="pending-change" role="status">
          <AlertTitle>Resolve this change before researching</AlertTitle>
          <AlertDescription>
            <p className="pending-change-preview">
              {chat.preferences.pendingChange.message}
            </p>
            <Collapsible>
              <CollapsibleTrigger
                render={<Button type="button" variant="ghost" size="sm" />}
              >
                Review pending change
              </CollapsibleTrigger>
              <CollapsibleContent className="pending-change-details">
                <p>{chat.preferences.pendingChange.explanation}</p>
                <p>{chat.preferences.pendingChange.message}</p>
              </CollapsibleContent>
            </Collapsible>
            <div className="pending-change-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  chat.send({ type: "resolve-pending" });
                  composerRef.current?.focus();
                }}
              >
                Resolve change
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => chat.send({ type: "discard-pending" })}
              >
                Discard pending change
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <InputGroup className="prompt-input">
        <InputGroupTextarea
          ref={composerRef}
          aria-label="Message"
          value={chat.draft}
          maxLength={2000}
          rows={1}
          placeholder={
            empty ? "Tell me what you're looking for…" : "Message fieldnote…"
          }
          onChange={(event) =>
            chat.send({ type: "draft", value: event.target.value })
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (!chat.pending) chat.send({ type: "submit" });
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          {!empty && (
            <MessageScrollerButton
              aria-label="Scroll to latest message"
              title="Scroll to latest message"
              type="button"
              className="composer-scroll-button"
            />
          )}
          {chat.pending ? (
            <InputGroupButton
              size="icon-sm"
              aria-label="Stop response"
              onClick={() => chat.send({ type: "stop" })}
            >
              <Square aria-hidden="true" />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              size="icon-sm"
              type="submit"
              variant="default"
              aria-label="Send message"
              disabled={!chat.draft.trim()}
            >
              <ArrowUp aria-hidden="true" />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      <p className="composer-note">
        {fixtureMode
          ? "Automated fixture service. Sample claims are synthetic."
          : "Shopping requests may use one paid Exa call. Viewing saved evidence does not start another search."}
      </p>
    </form>
  );
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span>fieldnote</span>
          {fixtureMode && <span className="fixture-marker">Fixture data</span>}
        </div>
        <div className="topbar-right">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button
            variant="ghost"
            className="new-chat"
            aria-label="New chat"
            title="Start a new chat. Conversation stays in this tab until refresh."
            onClick={() => chat.send({ type: "reset" })}
          >
            <Plus aria-hidden="true" />
            <span>New chat</span>
          </Button>
        </div>
      </header>
      <main
        className={`chat-main ${empty ? "empty-chat" : "has-conversation"}`}
        aria-label="Shopping conversation"
      >
        {empty ? (
          <div className="empty-group">
            <h1>What are you looking for?</h1>
            {composer}
            <div className="starter-prompts" aria-label="Example requests">
              <Button
                variant="ghost"
                onClick={() =>
                  chat.send({
                    type: "submit",
                    message:
                      "Headphones for music under SGD400. Compare sound quality and battery life.",
                  })
                }
              >
                Headphones for music
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  chat.send({
                    type: "submit",
                    message:
                      "A quiet air purifier for a bedroom under SGD300. Compare filter costs and noise.",
                  })
                }
              >
                A quieter bedroom
              </Button>
            </div>
          </div>
        ) : (
          <MessageScrollerProvider autoScroll={false}>
            <MessageScroller className="conversation-scroller">
              <MessageScrollerViewport
                className="conversation-viewport"
                aria-label="Conversation history"
              >
                <MessageScrollerContent className="thread">
                  {chat.turns.map((turn) => {
                    const active = turn.id === chat.activeTurnId;
                    const response =
                      turn.body.status === "complete" ? turn.body.value : null;
                    const intentChanged =
                      response &&
                      response.preferences.revision !==
                        turn.request.preferences.revision;
                    const researchSubject = turn.prepared?.preferences.productDescription.trim();
                    return (
                      <MessageScrollerItem
                        key={turn.id}
                        messageId={turn.id}
                        scrollAnchor
                      >
                        <section
                          data-testid="conversation-turn"
                          data-turn-id={turn.id}
                          data-active={active}
                          className="conversation-turn"
                        >
                          <Message align="end">
                            <MessageContent>
                              <Bubble align="end" variant="muted">
                                <BubbleContent data-testid="user-message">
                                  {turn.message}
                                </BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                          <Message>
                            <MessageContent
                              className="assistant-content"
                              data-testid="assistant-message"
                            >
                              <span className="assistant-name">fieldnote</span>
                              {turn.body.status === "pending" && (
                                <Trace role="status" className="pending-message" aria-live="polite">
                                  <TraceLine status="running">
                                    <TraceIcon>
                                      {turn.body.phase === "research" ? <Search /> : <TextSearch />}
                                    </TraceIcon>
                                    <TraceTitle className="shimmer-none">
                                      {turn.body.phase === "research"
                                        ? researchSubject && researchSubject.length <= 120
                                          ? `Searching sources for ${researchSubject}`
                                          : "Searching product sources"
                                        : turn.request.edit
                                          ? "Applying your preferences"
                                          : "Understanding your request"}
                                    </TraceTitle>
                                  </TraceLine>
                                </Trace>
                              )}
                              {turn.body.status === "failed" && (
                                <Alert variant="destructive">
                                  <AlertDescription>
                                    {turn.body.message}
                                  </AlertDescription>
                                </Alert>
                              )}
                              {turn.body.status === "cancelled" && (
                                <p className="metadata" role="status">
                                  Response stopped.
                                </p>
                              )}
                              {(turn.body.status === "failed" ||
                                turn.body.status === "cancelled" ||
                                response?.kind === "research-unavailable") &&
                                chat.retryTurnId === turn.id && (
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      chat.send({
                                        type: "retry",
                                        origin: turn.id,
                                      })
                                    }
                                  >
                                    Retry
                                  </Button>
                                )}
                              {response?.kind === "question" && (
                                <BudgetQuestion
                                  currency={
                                    response.preferences.region === "SG"
                                      ? "SGD"
                                      : "USD"
                                  }
                                  active={active}
                                  onReply={(message) =>
                                    chat.send({
                                      type: "reply",
                                      origin: turn.id,
                                      message,
                                    })
                                  }
                                  onSkip={() =>
                                    chat.send({
                                      type: "skip-budget",
                                      origin: turn.id,
                                    })
                                  }
                                />
                              )}
                              {(response?.kind === "research" ||
                                response?.kind === "research-unavailable") && (
                                <LiveResearchResults outcome={response} />
                              )}
                              {(response?.kind === "message" ||
                                response?.kind === "clarification") && (
                                <p className="ordinary-message">
                                  {response.message}
                                </p>
                              )}
                              {active && response?.kind === "clarification" &&
                                response.preferences.pendingChange?.kind === "money" &&
                                response.preferences.pendingChange.missingSlot === "currency" && (
                                  <div className="currency-choices" aria-label="Budget currency">
                                    {(["SGD", "USD"] as const).map((currency) => (
                                      <Button
                                        key={currency}
                                        variant="outline"
                                        onClick={() => chat.send({
                                          type: "reply",
                                          origin: turn.id,
                                          questionId: response.preferences.pendingChange!.id,
                                          message: currency,
                                        })}
                                      >
                                        {currency}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              {turn.prepared?.notes
                                .filter(
                                  (note) => !response?.notes.includes(note),
                                )
                                .map((note) => (
                                  <p className="metadata" key={note}>
                                    {note}
                                  </p>
                                ))}
                              {response?.notes.length ? (
                                <Collapsible className="response-details">
                                  <CollapsibleTrigger
                                    render={<Button variant="ghost" />}
                                  >
                                    Response notes
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <ul className="preference-notes">
                                      {response.notes.map((note) => (
                                        <li key={note}>{note}</li>
                                      ))}
                                    </ul>
                                  </CollapsibleContent>
                                </Collapsible>
                              ) : null}
                              {active &&
                                response &&
                                response.preferences.productDescription &&
                                response.kind !== "question" &&
                                (response.kind !== "message" ||
                                  turn.request.edit ||
                                  intentChanged) &&
                                !editor && (
                                  <div className="intent-summary">
                                    {response.preferences.budget &&
                                      JSON.stringify(response.preferences.budget) !== JSON.stringify(turn.request.preferences.budget) && (
                                      <p className="metadata">
                                        {response.preferences.budget.currency}{" "}
                                        {response.preferences.budget.minimum !==
                                        undefined
                                          ? `${response.preferences.budget.minimum.toLocaleString("en-SG")}–${response.preferences.budget.amount.toLocaleString("en-SG")}`
                                          : `${response.preferences.budget.amount.toLocaleString("en-SG")} maximum`}
                                      </p>
                                    )}
                                    <Collapsible>
                                      <CollapsibleTrigger
                                        render={<Button variant="ghost" />}
                                      >
                                        Current preferences
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <p>
                                          {
                                            response.preferences
                                              .productDescription
                                          }
                                        </p>
                                        <p>
                                          {response.preferences.region === "SG"
                                            ? "Singapore"
                                            : "United States"}{" "}
                                          ·{" "}
                                          {response.preferences.budget
                                            ? response.preferences.budget
                                                .minimum !== undefined
                                              ? `${response.preferences.budget.currency} ${response.preferences.budget.minimum.toLocaleString("en-SG")}–${response.preferences.budget.amount.toLocaleString("en-SG")}`
                                              : `${response.preferences.budget.currency} ${response.preferences.budget.amount} maximum`
                                            : "No budget cap"}
                                        </p>
                                        <ul>
                                          {response.preferences.criteria.map(
                                            (criterion) => (
                                              <li key={criterion.id}>
                                                {criterion.strength === "hard"
                                                  ? "Required"
                                                  : "Flexible"}{" "}
                                                · {criterion.wording}
                                              </li>
                                            ),
                                          )}
                                        </ul>
                                      </CollapsibleContent>
                                    </Collapsible>
                                    <Button
                                      variant="ghost"
                                      className="edit-preferences"
                                      onClick={() =>
                                        chat.send({
                                          type: "open-editor",
                                          origin: turn.id,
                                        })
                                      }
                                    >
                                      Edit preferences
                                    </Button>
                                    {(turn.request.edit || intentChanged) && (
                                      <Button
                                        variant="outline"
                                        onClick={() =>
                                          chat.send({
                                            type: "compare",
                                            origin: turn.id,
                                          })
                                        }
                                      >
                                        Compare options
                                      </Button>
                                    )}
                                  </div>
                                )}
                              {editor?.turnId === turn.id && (
                                <Card
                                  className="inline-editor"
                                  aria-label="Edit preferences"
                                >
                                  <CardContent>
                                    <div className="editor-header">
                                      <h2>Edit preferences</h2>
                                      <Button
                                        variant="ghost"
                                        onClick={() =>
                                          chat.send({ type: "close-editor" })
                                        }
                                      >
                                        Close preferences
                                      </Button>
                                    </div>
                                    <PreferencePanel
                                      draft={editor}
                                      onChange={(patch) =>
                                        chat.send({ type: "edit", patch })
                                      }
                                      onUpdate={() =>
                                        chat.send({ type: "apply-editor" })
                                      }
                                    />
                                  </CardContent>
                                </Card>
                              )}
                            </MessageContent>
                          </Message>
                        </section>
                      </MessageScrollerItem>
                    );
                  })}
                </MessageScrollerContent>
              </MessageScrollerViewport>
            </MessageScroller>
            <div className="composer-dock">{composer}</div>
          </MessageScrollerProvider>
        )}
      </main>
    </div>
  );
}
