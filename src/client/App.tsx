import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Moon, Plus, Square, Sun, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Card, CardContent } from "@/components/ui/card";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageScroller, MessageScrollerProvider, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton, useMessageScroller } from "@/components/ui/message-scroller";
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { Trace, TraceLine, TraceIcon, TraceTitle } from "@/components/ui/trace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTheme } from "./theme-provider";
import { api, getSession, prepare, research } from "./api";
import { ResearchAnswer } from "./ResearchAnswer";
import { initialConversation, type ConversationState } from "../domain/conversation";
import type { PrepareInput } from "../domain/conversation";
import { PreferenceEditor } from "./PreferenceEditor";

function ResponseAnchor({ id }: { id: string | null }) {
  const { scrollToMessage } = useMessageScroller();
  useLayoutEffect(() => { if (!id) return; const frame = requestAnimationFrame(() => scrollToMessage(id, { align: "start", behavior: "instant" })); return () => cancelAnimationFrame(frame); }, [id, scrollToMessage]);
  return null;
}

export function App() {
  const [state, setState] = useState(initialConversation);
  const [draft, setDraft] = useState("");
  const [activity, setActivity] = useState<"preparing" | "researching" | null>(null);
  const [error, setError] = useState("");
  const [focusMessage, setFocusMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  const { theme, setTheme } = useTheme();
  useEffect(() => { let mounted = true; getSession().then((r) => { if (mounted) { setState(r.state); setReady(true); } }).catch(() => { if (mounted) setError("The server is unavailable. Your draft stays here. Refresh when it is running."); }); return () => { mounted = false; }; }, []);
  async function send(text: string, questionId?: string, edit?: PrepareInput["edit"], expectedRevision?: number) {
    if (!text.trim() || !ready) return;
    const previous = active.current;
    previous?.abort();
    const controller = new AbortController(); active.current = controller;
    const own = ++generation.current;
    setError(""); setActivity("preparing"); setDraft("");
    try {
      if (previous) { await api("/api/cancel", {}); if (generation.current !== own) return; }
      const prepared = await prepare({ phase: "prepare", operationId: crypto.randomUUID(), message: text, ...(questionId ? { questionId } : {}), ...(edit ? { edit, expectedRevision } : {}) }, controller.signal);
      if (generation.current !== own) return;
      setState(prepared.state); setFocusMessage(prepared.state.messages.at(-1)?.id ?? null);
      if (prepared.kind === "prepared") {
        setActivity("researching");
        const result = await research(prepared.preparedId, controller.signal);
        if (generation.current === own) { setState(result.state); setFocusMessage(result.state.messages.at(-1)?.id ?? null); }
      }
    } catch {
      if (!controller.signal.aborted && generation.current === own) { setError("The request could not finish. Your accepted preferences are retained. No automatic retry was sent."); setDraft(text); }
    } finally { if (generation.current === own) { active.current = null; setActivity(null); } }
  }
  async function stop() {
    generation.current++; active.current?.abort(); active.current = null; setActivity(null);
    try { const r = await api<{ state: ConversationState }>("/api/cancel", {}); setState(r.state); } catch { setError("The server could not confirm cancellation. No automatic retry was sent."); }
  }
  async function reset() {
    generation.current++; active.current?.abort(); active.current = null; setActivity(null); setError("");
    try { const r = await api<{ state: ConversationState }>("/api/new-chat", {}); setState(r.state); setDraft(""); } catch { setError("The server could not start a new chat. Your history stays visible."); }
  }
  return <div className="flex h-dvh min-h-0 flex-col"><header className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 sm:px-6"><span className="font-medium">Fieldnote</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun /> : <Moon />}</Button><Button variant="ghost" onClick={reset} aria-label="New chat"><Plus />New chat</Button></div></header><main className="flex min-h-0 flex-1 flex-col"><MessageScrollerProvider autoScroll={false} defaultScrollPosition="last-anchor"><ResponseAnchor id={focusMessage} /><MessageScroller className="flex-1"><MessageScrollerViewport><MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">{state.messages.length === 0 && <div className="flex min-h-48 flex-1 items-center justify-center"><h1 className="text-center font-medium">What are you looking for?</h1></div>}{state.messages.map((message) => <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === "user"}><Message align={message.role === "user" ? "end" : "start"}><MessageContent><Bubble align={message.role === "user" ? "end" : "start"} variant={message.role === "user" ? "muted" : "ghost"}><BubbleContent><p className="whitespace-pre-wrap">{message.text}</p></BubbleContent></Bubble>{message.research && <ResearchAnswer snapshot={message.research} />}</MessageContent></Message></MessageScrollerItem>)}{state.intent.originalText && <PreferenceEditor state={state} onApply={(edit, revision) => send("Updated shopping preferences.", undefined, edit, revision)} />}{state.pending?.kind === "currency" && <Card size="sm"><CardContent className="space-y-3"><p>{state.pending.originalRequest}</p><p className="text-muted-foreground">Saved range: {state.pending.minimum !== undefined ? `${state.pending.minimum} to ` : "up to "}{state.pending.maximum ?? "no maximum"}. Choose the currency to continue.</p><div className="flex gap-2">{["SGD", "USD"].map((unit) => <Button key={unit} variant="outline" disabled={Boolean(activity)} onClick={() => send(unit, state.pending!.id)}>{unit}</Button>)}</div></CardContent></Card>}{activity && <div role="status"><Trace><TraceLine status="running"><TraceIcon><Search /></TraceIcon><TraceTitle>{activity === "preparing" ? "Saving your request" : "Requesting source-backed research from Exa"}</TraceTitle></TraceLine></Trace></div>}{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</MessageScrollerContent></MessageScrollerViewport><MessageScrollerButton /></MessageScroller></MessageScrollerProvider><div className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6"><form onSubmit={(event) => { event.preventDefault(); void send(draft); }}><InputGroup><InputGroupTextarea aria-label="Message" rows={1} maxLength={2000} placeholder="Describe what you want to buy…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); } }} /><InputGroupAddon align="block-end"><span className="text-xs text-muted-foreground">{state.intent.budget ? `${state.intent.budget.currency} ${state.intent.budget.minimum ?? 0}–${state.intent.budget.maximum ?? "no maximum"}` : ""}</span>{activity && <InputGroupButton className="ml-auto" type="button" size="icon-sm" aria-label="Stop research" onClick={stop}><Square /></InputGroupButton>}<InputGroupButton className={activity ? "" : "ml-auto"} type="submit" variant="default" size="icon-sm" aria-label="Send message" disabled={!ready || !draft.trim()}><ArrowUp /></InputGroupButton></InputGroupAddon></InputGroup></form><p className="mt-2 text-center text-xs text-muted-foreground">Shopping submissions can trigger a paid Exa call. Viewing existing evidence is free.</p></div></main></div>;
}
