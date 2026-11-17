import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  defaultPreferences,
  type Candidate,
  type Category,
  type Preferences,
  type SelectionResult,
  type TurnResponse,
} from "../domain/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { runTurn, selectProduct } from "./api";
import { PreferencePanel } from "./PreferencePanel";
import { featureOptions, priorityOptions } from "./preference-options";
import { Handoff, Results } from "./ResearchResults";

const starterPrompts = [
  "Wireless headphones for long flights, under S$500",
  "A light laptop for writing and travel, under S$2,000",
  "Noise cancelling headphones under S$100",
];

export function App() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setMobile(query.matches);
      setFiltersOpen(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const [input, setInput] = useState("");
  const [budgetDraft, setBudgetDraft] = useState("");
  const [budgetCurrencyDraft, setBudgetCurrencyDraft] = useState<"SGD" | "USD">(
    "SGD",
  );
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [brandDraft, setBrandDraft] = useState("");
  const [editorNote, setEditorNote] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TurnResponse | null>(null);
  const [lastMessage, setLastMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Extract<
    SelectionResult,
    { kind: "handoff" }
  > | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const turnId = useRef(0);
  const selectionId = useRef(0);
  const preferenceRevision = useRef(0);
  const inputRevision = useRef(0);
  const turnController = useRef<AbortController | null>(null);
  const selectionController = useRef<AbortController | null>(null);

  useEffect(() => {
    setBrandDraft(preferences.hard.excludedBrands.join(", "));
  }, [preferences.hard.excludedBrands]);

  useEffect(() => {
    setBudgetDraft(preferences.hard.budget?.amount.toString() ?? "");
    if (preferences.hard.budget?.currency)
      setBudgetCurrencyDraft(preferences.hard.budget.currency);
  }, [preferences.hard.budget?.amount, preferences.hard.budget?.currency]);

  function cancelWork() {
    turnId.current += 1;
    selectionId.current += 1;
    turnController.current?.abort();
    selectionController.current?.abort();
    turnController.current = null;
    selectionController.current = null;
    setLoading(false);
    setSelectingId(null);
  }

  function editPreferences(next: Preferences) {
    preferenceRevision.current += 1;
    cancelWork();
    setPreferences(next);
    setOutcome(null);
    setSelection(null);
    setSelectionError(null);
    setNetworkError(null);
  }

  function editInput(next: string) {
    inputRevision.current += 1;
    cancelWork();
    setInput(next);
    setOutcome(null);
    setSelection(null);
    setSelectionError(null);
    setNetworkError(null);
  }

  function editBrandDraft(next: string) {
    cancelWork();
    setBrandDraft(next);
    setOutcome(null);
    setSelection(null);
    setSelectionError(null);
    setNetworkError(null);
  }

  function editBudget(raw: string, currency: "SGD" | "USD") {
    setBudgetDraft(raw);
    if (!raw.trim()) {
      setBudgetError(null);
      editPreferences({
        ...preferences,
        hard: { ...preferences.hard, budget: null },
      });
      return;
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBudgetError("Enter a positive amount, or clear the budget cap.");
      cancelWork();
      setOutcome(null);
      setSelection(null);
      setSelectionError(null);
      setNetworkError(null);
      return;
    }
    setBudgetError(null);
    editPreferences({
      ...preferences,
      hard: { ...preferences.hard, budget: { amount, currency } },
    });
  }

  function editBudgetCurrency(currency: "SGD" | "USD") {
    setBudgetCurrencyDraft(currency);
    if (budgetError || !budgetDraft.trim()) return;
    const amount = Number(budgetDraft);
    if (Number.isFinite(amount) && amount > 0) {
      editPreferences({
        ...preferences,
        hard: { ...preferences.hard, budget: { amount, currency } },
      });
    }
  }

  function editCategory(category: Category | null) {
    const featureSet = new Set(
      category ? featureOptions[category].map(({ value }) => value) : [],
    );
    const prioritySet = new Set(
      category ? priorityOptions[category].map(({ value }) => value) : [],
    );
    const removedFeatures = preferences.hard.requiredFeatures.filter(
      (feature) => !featureSet.has(feature),
    );
    const removedPriorities = preferences.soft.priorities.filter(
      (priority) => !prioritySet.has(priority),
    );
    const next: Preferences = {
      hard: {
        ...preferences.hard,
        category,
        requiredFeatures: preferences.hard.requiredFeatures.filter((feature) =>
          featureSet.has(feature),
        ),
      },
      soft: {
        ...preferences.soft,
        priorities: preferences.soft.priorities.filter((priority) =>
          prioritySet.has(priority),
        ),
      },
    };
    editPreferences(next);
    const removed = [
      ...removedFeatures.map((feature) => feature.replaceAll("-", " ")),
      ...removedPriorities.map(
        (priority) => `${priority.replaceAll("-", " ")} priority`,
      ),
    ];
    setEditorNote(
      removed.length
        ? `Cleared ${removed.join(", ")} because they do not apply to ${category ?? "an unspecified category"}.`
        : null,
    );
  }

  function commitBrandDraft() {
    if (budgetError) return null;
    const excludedBrands = brandDraft
      .split(",")
      .map((brand) => brand.trim())
      .filter(Boolean);
    const unchanged =
      excludedBrands.length === preferences.hard.excludedBrands.length &&
      excludedBrands.every(
        (brand, index) => brand === preferences.hard.excludedBrands[index],
      );
    if (unchanged) return preferences;
    const next = {
      ...preferences,
      hard: { ...preferences.hard, excludedBrands },
    };
    editPreferences(next);
    return next;
  }

  function updateEditedOptions() {
    const next = commitBrandDraft();
    if (next) void submitTurn("", next);
  }

  async function submitTurn(
    message: string,
    requestPreferences: Preferences = preferences,
  ) {
    if (budgetError) {
      setNetworkError(
        "Fix the budget amount or clear the cap before researching.",
      );
      return;
    }
    const text = message.trim();
    if (!text && !requestPreferences.hard.category) {
      setNetworkError(
        "Tell us what kind of product you need, or choose a category first.",
      );
      return;
    }
    const requestText = text || "Show options";
    cancelWork();
    const id = ++turnId.current;
    const revision = preferenceRevision.current;
    const promptRevision = inputRevision.current;
    const controller = new AbortController();
    turnController.current = controller;
    setLoading(true);
    setNetworkError(null);
    setOutcome(null);
    setSelection(null);
    setSelectionError(null);
    setLastMessage(requestText);

    try {
      const result = await runTurn(
        requestText,
        requestPreferences,
        controller.signal,
      );
      if (
        id !== turnId.current ||
        revision !== preferenceRevision.current ||
        promptRevision !== inputRevision.current
      )
        return;
      setOutcome(result);
      if ("preferences" in result && result.preferences) {
        preferenceRevision.current += 1;
        setPreferences(result.preferences);
      }
      if (result.kind !== "error") {
        inputRevision.current += 1;
        setInput("");
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        id !== turnId.current ||
        revision !== preferenceRevision.current ||
        promptRevision !== inputRevision.current
      )
        return;
      setNetworkError(
        error instanceof Error
          ? error.message
          : "Research could not finish. Try again.",
      );
    } finally {
      if (id === turnId.current) {
        setLoading(false);
        turnController.current = null;
      }
    }
  }

  async function handleSelect(candidate: Candidate) {
    selectionController.current?.abort();
    const id = ++selectionId.current;
    const controller = new AbortController();
    selectionController.current = controller;
    setSelection(null);
    setSelectionError(null);
    setSelectingId(candidate.product.id);
    try {
      const result = await selectProduct(
        candidate.product.id,
        preferences,
        controller.signal,
      );
      if (id !== selectionId.current) return;
      if (result.kind === "error") setSelectionError(result.message);
      else setSelection(result);
    } catch (error) {
      if (controller.signal.aborted || id !== selectionId.current) return;
      setSelectionError(
        error instanceof Error
          ? error.message
          : "The sample handoff is unavailable.",
      );
    } finally {
      if (id === selectionId.current) {
        setSelectingId(null);
        selectionController.current = null;
      }
    }
  }

  function reset() {
    cancelWork();
    preferenceRevision.current += 1;
    inputRevision.current += 1;
    setPreferences(defaultPreferences());
    setInput("");
    setBudgetDraft("");
    setBudgetCurrencyDraft("SGD");
    setBudgetError(null);
    setBrandDraft("");
    setEditorNote(null);
    setOutcome(null);
    setLastMessage("");
    setSelection(null);
    setSelectionError(null);
    setNetworkError(null);
  }

  const preferenceEditor = (
    <PreferencePanel
      preferences={preferences}
      onChange={editPreferences}
      onUpdate={() => {
        if (!budgetError) setFiltersOpen(false);
        updateEditedOptions();
      }}
      onCategoryChange={editCategory}
      onBudgetInput={editBudget}
      onBudgetCurrencyChange={editBudgetCurrency}
      budgetDraft={budgetDraft}
      budgetCurrencyDraft={budgetCurrencyDraft}
      budgetError={budgetError}
      brandDraft={brandDraft}
      onBrandDraft={editBrandDraft}
      editorNote={editorNote}
      showUpdate={Boolean(lastMessage)}
    />
  );

  const examples = (
    <div className="starter-prompts" aria-label="Example requests">
      {starterPrompts.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          size="sm"
          className="starter-pill"
          onClick={() => {
            editInput(prompt);
            const next = commitBrandDraft();
            if (next) void submitTurn(prompt, next);
          }}
        >
          {prompt}
          <ArrowUpRight aria-hidden="true" />
        </Button>
      ))}
    </div>
  );

  return (
    <div className={`app-shell ${lastMessage ? "has-request" : ""}`}>
      <header className="topbar">
        <a
          className="brand-lockup"
          href="/"
          onClick={(event) => event.preventDefault()}
          aria-label="Fieldnote research home"
        >
          <span className="brand-symbol" aria-hidden="true">
            <Search />
          </span>
          <span>fieldnote</span>
        </a>
        <div className="topbar-right">
          <Badge variant="outline" className="demo-status">
            FIXTURE MODE
          </Badge>
          <Button variant="ghost" onClick={reset} className="reset-button">
            <RotateCcw aria-hidden="true" />
            Reset session
          </Button>
        </div>
      </header>
      <main className="page-content">
        <section className="page-intro">
          <div>
            <p className="section-kicker">PRODUCT RESEARCH</p>
            <h1>Find what fits.</h1>
          </div>
          <p>
            A considered shortlist, with evidence and tradeoffs.
            <br className="desktop-break" /> Explore sample headphones and
            laptops.
          </p>
        </section>
        <section className="workspace" aria-label="Product research workspace">
          {mobile ? (
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger
                render={<Button variant="outline" className="filter-trigger" />}
              >
                <SlidersHorizontal aria-hidden="true" />
                Filters and preferences
                <Badge variant="secondary">
                  {preferences.hard.budget
                    ? `${preferences.hard.budget.currency} ${preferences.hard.budget.amount.toLocaleString("en-SG")}`
                    : "No budget cap"}
                </Badge>
              </SheetTrigger>
              <SheetContent side="right" className="filter-sheet">
                <SheetHeader>
                  <SheetTitle>Your filters</SheetTitle>
                  <SheetDescription>
                    Hard limits are required. Preferences shape the ranking.
                  </SheetDescription>
                </SheetHeader>
                <div className="sheet-editor">{preferenceEditor}</div>
              </SheetContent>
            </Sheet>
          ) : (
            <Card
              className="preference-card"
              role="complementary"
              aria-labelledby="preferences-heading"
            >
              <CardHeader>
                <h2 id="preferences-heading">
                  <SlidersHorizontal aria-hidden="true" />
                  Your filters
                </h2>
              </CardHeader>
              <CardContent>{preferenceEditor}</CardContent>
            </Card>
          )}
          <div className="research-column">
            <Card className="request-card">
              <CardContent>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const next = commitBrandDraft();
                    if (next) void submitTurn(outcome ? "" : input, next);
                  }}
                >
                  <FieldLabel htmlFor="request" className="request-label">
                    Start with the outcome, not a model number.
                  </FieldLabel>
                  <InputGroup className="prompt-input">
                    <InputGroupTextarea
                      id="request"
                      value={input}
                      maxLength={2000}
                      rows={2}
                      placeholder="For example, headphones for long flights under S$500…"
                      onChange={(event) => editInput(event.target.value)}
                    />
                    <InputGroupAddon
                      align="block-end"
                      className="request-submit-row"
                    >
                      <span className="metadata">
                        Preferences stay in this tab
                      </span>
                      <InputGroupButton
                        variant="default"
                        size="sm"
                        className="submit-button min-h-10 px-3"
                        type="submit"
                        disabled={loading || Boolean(budgetError)}
                      >
                        {loading
                          ? "Researching…"
                          : lastMessage && !input
                            ? "Update shortlist"
                            : "Research options"}
                        <ArrowUpRight aria-hidden="true" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <div className="examples-section">
                    {lastMessage ? (
                      <Collapsible>
                        <CollapsibleTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-0"
                            />
                          }
                        >
                          Example requests
                        </CollapsibleTrigger>
                        <CollapsibleContent>{examples}</CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <>
                        <p className="metadata">Try a request</p>
                        {examples}
                      </>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
            <MessageScrollerProvider autoScroll={false}>
              <MessageScroller className="conversation-scroller">
                <MessageScrollerViewport
                  className="conversation-viewport"
                  aria-label="Current research exchange"
                >
                  <MessageScrollerContent>
                    {lastMessage &&
                      (outcome || loading || networkError || selection) && (
                        <MessageScrollerItem
                          messageId={`request-${turnId.current}`}
                          scrollAnchor
                        >
                          <Message align="end">
                            <MessageContent>
                              <Bubble align="end" variant="muted">
                                <BubbleContent>{lastMessage}</BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      )}
                    <MessageScrollerItem
                      messageId={`response-${turnId.current}`}
                    >
                      <Message>
                        <MessageContent>
                          {networkError && (
                            <Alert
                              variant="destructive"
                              className="network-error"
                            >
                              <AlertDescription>
                                <p>{networkError}</p>
                                {lastMessage && (
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      const next = commitBrandDraft();
                                      if (next)
                                        void submitTurn(lastMessage, next);
                                    }}
                                  >
                                    Retry
                                  </Button>
                                )}
                              </AlertDescription>
                            </Alert>
                          )}
                          {loading ? (
                            <div className="loading-state" role="status">
                              <Search aria-hidden="true" />
                              <p>
                                Research request in progress.
                                <span>
                                  The sample service has not returned a response
                                  yet.
                                </span>
                              </p>
                            </div>
                          ) : selection ? (
                            <Handoff result={selection} onReset={reset} />
                          ) : (
                            <Results
                              outcome={outcome}
                              onSelect={(candidate) =>
                                void handleSelect(candidate)
                              }
                              onRetry={() => {
                                const next = commitBrandDraft();
                                if (next)
                                  void submitTurn(lastMessage || input, next);
                              }}
                              selectingId={selectingId}
                              selectionError={selectionError}
                            />
                          )}
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            </MessageScrollerProvider>
          </div>
        </section>
        <footer className="site-footer">
          <span>Fieldnote · Research workspace</span>
          <span>Fixture demo. Prices, claims, and stock are synthetic.</span>
        </footer>
      </main>
    </div>
  );
}
