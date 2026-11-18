import { AccountControl } from "./AccountControl";
import { useEffect, useState } from "react";
import { LiveResearchResults } from "./LiveResearchResults";
import { ArrowUp, Moon, Plus, Square, Sun } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
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
import { Handoff, Results } from "./ResearchResults";
import { WebResearch } from "./WebResearch";
import { useTheme } from "./theme-provider";
import { useConversation } from "./useConversation";

export function App() {
  const chat = useConversation();
  const [accountOpen, setAccountOpen] = useState(false);
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
      <InputGroup className="prompt-input">
        <InputGroupTextarea
          aria-label="Message"
          value={chat.draft}
          disabled={chat.accountBlocked}
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
              disabled={
                chat.accountBlocked ||
                !chat.draft.trim() ||
                Boolean(editor?.error)
              }
            >
              <ArrowUp aria-hidden="true" />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      <p className="composer-note">
        {fixtureMode
          ? "Sample catalog. Prices and stock are fixture data."
          : "Source-backed research. Prices and stock need verification."}
      </p>
    </form>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand-lockup">
          fieldnote
          <span className="fixture-marker">
            {fixtureMode ? "Fixture data" : "Web research"}
          </span>
        </span>
        <div className="topbar-right">
          <AccountControl
            chat={chat}
            open={accountOpen}
            setOpen={setAccountOpen}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button
            variant="ghost"
            className="new-chat"
            aria-label="New chat"
            title={
              chat.account.status === "signed-in"
                ? "Clear saved conversation and preferences."
                : "Start a new chat. Conversation stays in this tab until refresh."
            }
            disabled={chat.accountBlocked}
            onClick={() => chat.send({ type: "reset" })}
          >
            <Plus aria-hidden="true" />
            <span>New chat</span>
          </Button>
        </div>
      </header>
      {chat.accountError && !accountOpen && (
        <div className="account-banner" role="alert">
          <span>{chat.accountError}</span>
          <Button variant="ghost" onClick={() => void chat.reloadAccount()}>
            Reload account
          </Button>
        </div>
      )}
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
                      "Wireless headphones for long flights, under S$500",
                  })
                }
              >
                Headphones for flights
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  chat.send({
                    type: "submit",
                    message:
                      "A light laptop for writing and travel, under S$2,000",
                  })
                }
              >
                A laptop for everyday work
              </Button>
            </div>
          </div>
        ) : (
          <>
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
                        turn.body.status === "complete"
                          ? turn.body.value
                          : null;
                      const selectionError =
                        turn.selection.status === "failed"
                          ? turn.selection.message
                          : turn.selection.status === "complete" &&
                              turn.selection.value.kind === "error"
                            ? turn.selection.value.message
                            : null;
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
                                <span className="assistant-name">
                                  fieldnote
                                </span>
                                {turn.body.status === "pending" && (
                                  <p role="status" className="pending-message">
                                    {fixtureMode
                                      ? "Waiting for the sample service…"
                                      : "Researching sources…"}
                                    <span className="sr-only">
                                      {fixtureMode
                                        ? "The sample service has not returned a response yet."
                                        : "No research response has returned yet."}
                                    </span>
                                  </p>
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
                                  turn.body.status === "cancelled") &&
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
                                {turn.body.status === "question" && (
                                  <BudgetQuestion
                                    preferences={turn.body.preferences}
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
                                  response?.kind ===
                                    "research-unavailable") && (
                                  <LiveResearchResults outcome={response} />
                                )}
                                {response &&
                                  response.kind !== "research" &&
                                  response.kind !== "research-unavailable" && (
                                    <Results
                                      outcome={response}
                                      active={active}
                                      onSelect={(candidate) =>
                                        chat.send({
                                          type: "select",
                                          origin: turn.id,
                                          productId: candidate.product.id,
                                        })
                                      }
                                      onRetry={() =>
                                        chat.send({
                                          type: "retry",
                                          origin: turn.id,
                                        })
                                      }
                                      selectingId={turn.selectingId}
                                      selectionError={selectionError}
                                    />
                                  )}
                                {response?.kind === "clarification" &&
                                  response.reason === "category" &&
                                  !response.preferences.hard.category &&
                                  !response.preferences.hard
                                    .pendingConstraint &&
                                  active && (
                                    <Card className="question-card category-question">
                                      <CardContent>
                                        <div className="quick-choices">
                                          <Button
                                            variant="outline"
                                            onClick={() =>
                                              chat.send({
                                                type: "reply",
                                                origin: turn.id,
                                                message: "Headphones",
                                              })
                                            }
                                          >
                                            Headphones
                                          </Button>
                                          <Button
                                            variant="outline"
                                            onClick={() =>
                                              chat.send({
                                                type: "reply",
                                                origin: turn.id,
                                                message: "Laptops",
                                              })
                                            }
                                          >
                                            Laptops
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  )}
                                {response?.kind === "recommendations" && (
                                  <WebResearch
                                    state={turn.sources}
                                    active={
                                      active &&
                                      turn.selection.status !== "pending"
                                    }
                                    onRequest={() =>
                                      chat.send({
                                        type: "sources",
                                        origin: turn.id,
                                      })
                                    }
                                  />
                                )}
                                {turn.selection.status === "cancelled" && (
                                  <p className="metadata" role="status">
                                    Product check stopped.
                                  </p>
                                )}
                                {turn.selection.status === "complete" &&
                                  turn.selection.value.kind === "handoff" && (
                                    <Handoff
                                      result={turn.selection.value}
                                      active={active}
                                    />
                                  )}
                                {active &&
                                  response &&
                                  response.kind !== "message" &&
                                  !editor && (
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
                                        preferences={editor.preferences}
                                        onChange={(preferences) =>
                                          chat.send({
                                            type: "edit-preferences",
                                            preferences,
                                          })
                                        }
                                        onUpdate={() =>
                                          chat.send({ type: "apply-editor" })
                                        }
                                        onCategoryChange={(category) =>
                                          chat.send({
                                            type: "edit-category",
                                            category,
                                          })
                                        }
                                        onBudgetInput={(value, currency) =>
                                          chat.send({
                                            type: "edit-budget",
                                            value,
                                            currency,
                                          })
                                        }
                                        onBudgetCurrencyChange={(currency) =>
                                          chat.send({
                                            type: "edit-currency",
                                            currency,
                                          })
                                        }
                                        budgetDraft={editor.budget}
                                        budgetCurrencyDraft={editor.currency}
                                        budgetError={editor.error}
                                        brandDraft={editor.brands}
                                        onBrandDraft={(value) =>
                                          chat.send({
                                            type: "edit-brands",
                                            value,
                                          })
                                        }
                                        editorNote={editor.note}
                                        showUpdate
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
          </>
        )}
      </main>
    </div>
  );
}
