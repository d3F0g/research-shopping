import { useLayoutEffect } from "react";
import { ArrowUp, Moon, Plus, Square, Sun, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Card, CardContent } from "@/components/ui/card";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
} from "@/components/ui/message-scroller";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Trace, TraceLine, TraceIcon, TraceTitle } from "@/components/ui/trace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTheme } from "./theme-provider";
import { ResearchAnswer } from "./ResearchAnswer";
import { AccountControl } from "./AccountControl";
import { useFieldnote } from "./useFieldnote";
import { PreferenceEditor } from "./PreferenceEditor";

function ResponseAnchor({ id }: { id: string | null }) {
  const { scrollToMessage } = useMessageScroller();
  useLayoutEffect(() => {
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      scrollToMessage(id, { align: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [id, scrollToMessage]);
  return null;
}

export function App() {
  const {
    state,
    account,
    draft,
    setDraft,
    activity,
    error,
    ready,
    focusMessage,
    send,
    stop,
    reset,
    reload,
    authenticated,
    signOut,
    deleteSaved,
  } = useFieldnote();
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <span className="font-medium">Fieldnote</span>
        <div className="flex items-center gap-1">
          <AccountControl
            account={account}
            onReload={reload}
            onAuthenticated={authenticated}
            onSignOut={signOut}
            onDelete={deleteSaved}
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
          <Button variant="ghost" onClick={reset} aria-label="New chat">
            <Plus />
            New chat
          </Button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <MessageScrollerProvider
          autoScroll={false}
          defaultScrollPosition="start"
        >
          <ResponseAnchor id={focusMessage} />
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
                {state.messages.length === 0 && (
                  <div className="flex min-h-48 flex-1 items-center justify-center">
                    <h1 className="text-center font-medium">
                      What are you looking for?
                    </h1>
                  </div>
                )}
                {state.messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    style={{ contentVisibility: "visible" }}
                  >
                    <Message align={message.role === "user" ? "end" : "start"}>
                      <MessageContent>
                        <Bubble
                          align={message.role === "user" ? "end" : "start"}
                          variant={message.role === "user" ? "muted" : "ghost"}
                        >
                          <BubbleContent>
                            <p className="whitespace-pre-wrap">
                              {message.text}
                            </p>
                          </BubbleContent>
                        </Bubble>
                        {message.research && (
                          <ResearchAnswer snapshot={message.research} />
                        )}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
                {state.intent.originalText && (
                  <PreferenceEditor
                    state={state}
                    onApply={(edit, revision) =>
                      send(
                        "Updated shopping preferences.",
                        undefined,
                        edit,
                        revision,
                      )
                    }
                  />
                )}
                {state.pending?.kind === "currency" && (
                  <Card size="sm">
                    <CardContent className="space-y-3">
                      <p>{state.pending.originalRequest}</p>
                      <p className="text-muted-foreground">
                        Saved range:{" "}
                        {state.pending.minimum !== undefined
                          ? `${state.pending.minimum} to `
                          : "up to "}
                        {state.pending.maximum ?? "no maximum"}. Choose the
                        currency to continue.
                      </p>
                      <div className="flex gap-2">
                        {["SGD", "USD"].map((unit) => (
                          <Button
                            key={unit}
                            variant="outline"
                            disabled={Boolean(activity)}
                            onClick={() => send(unit, state.pending!.id)}
                          >
                            {unit}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {activity && (
                  <div role="status">
                    <Trace>
                      <TraceLine status="running">
                        <TraceIcon>
                          <Search />
                        </TraceIcon>
                        <TraceTitle>
                          {activity === "preparing"
                            ? "Saving your request"
                            : "Requesting source-backed research from Exa"}
                        </TraceTitle>
                      </TraceLine>
                    </Trace>
                  </div>
                )}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
        <div className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <InputGroup>
              <InputGroupTextarea
                aria-label="Message"
                rows={1}
                maxLength={2000}
                placeholder="Describe what you want to buy…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <InputGroupAddon align="block-end">
                <span className="text-xs text-muted-foreground">
                  {state.intent.budget
                    ? `${state.intent.budget.currency} ${state.intent.budget.minimum ?? 0}–${state.intent.budget.maximum ?? "no maximum"}`
                    : ""}
                </span>
                {activity && (
                  <InputGroupButton
                    className="ml-auto"
                    type="button"
                    size="icon-sm"
                    aria-label="Stop research"
                    onClick={stop}
                  >
                    <Square />
                  </InputGroupButton>
                )}
                <InputGroupButton
                  className={activity ? "" : "ml-auto"}
                  type="submit"
                  variant="default"
                  size="icon-sm"
                  aria-label="Send message"
                  disabled={!ready || !draft.trim()}
                >
                  <ArrowUp />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Shopping submissions can trigger a paid Exa call. Viewing existing
            evidence is free.
          </p>
        </div>
      </main>
    </div>
  );
}
