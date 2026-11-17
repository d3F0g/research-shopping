import { useEffect, useRef, useState } from "react";
import {
  defaultPreferences,
  type Candidate,
  type Category,
  type Feature,
  type Preferences,
  type Priority,
  type SelectionResult,
  type Source,
  type TurnResult,
} from "../domain/contracts";
import { isApprovedUrl } from "../domain/merchant-links";
import { runTurn, selectProduct } from "./api";

const starterPrompts = [
  "Wireless headphones for long flights, under S$500",
  "A light laptop for writing and travel, under S$2,000",
  "Noise cancelling headphones under S$100",
];

const featureOptions: Record<Category, { value: Feature; label: string }[]> = {
  headphones: [
    { value: "active-noise-cancelling", label: "Active noise cancelling" },
    { value: "wireless", label: "Wireless" },
    { value: "multipoint", label: "Connect to two devices" },
    { value: "long-battery-life", label: "Long battery life" },
    { value: "lightweight", label: "Lightweight" },
  ],
  laptops: [
    { value: "oled-display", label: "OLED display" },
    { value: "high-memory", label: "At least 32 GB memory" },
    { value: "long-battery", label: "Long battery life" },
    { value: "portable", label: "Portable" },
  ],
};

const priorityOptions: Record<Category, { value: Priority; label: string }[]> = {
  headphones: [
    { value: "comfort", label: "Comfort" },
    { value: "sound-quality", label: "Sound" },
    { value: "noise-cancelling", label: "Noise cancelling" },
    { value: "battery-life", label: "Battery" },
    { value: "value", label: "Value" },
  ],
  laptops: [
    { value: "performance", label: "Performance" },
    { value: "display-quality", label: "Display" },
    { value: "portability", label: "Portability" },
    { value: "battery-life", label: "Battery" },
    { value: "value", label: "Value" },
  ],
};

function currencySymbol(currency: string) {
  return currency === "SGD" ? "S$" : "US$";
}

function SourceReference({ source, productUrl }: { source: Source; productUrl: string }) {
  const href = isApprovedUrl(source.url) && source.url === productUrl ? source.url : null;
  const date = new Date(source.capturedAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <span className="source-reference">
      {href ? (
        <a className="source-link" href={href} target="_blank" rel="noopener noreferrer">Manufacturer reference/model page <span aria-hidden="true">↗</span></a>
      ) : <span className="source-name">{source.name} · synthetic fixture source</span>}
      <small>Synthetic fixture timestamp · {date}</small>
    </span>
  );
}

function ProductGlyph({ category }: { category: Category }) {
  return (
    <div className={`product-glyph ${category}`} aria-hidden="true">
      {category === "headphones" ? (
        <svg viewBox="0 0 120 100" fill="none">
          <path d="M25 57V46a35 35 0 0 1 70 0v11" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
          <rect x="18" y="51" width="22" height="37" rx="10" fill="currentColor" />
          <rect x="80" y="51" width="22" height="37" rx="10" fill="currentColor" />
          <path d="M39 72h42" stroke="#d8e3cf" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 120 100" fill="none">
          <rect x="22" y="20" width="76" height="54" rx="5" stroke="currentColor" strokeWidth="5" />
          <path d="M14 82h92l-8-8H22l-8 8Z" fill="currentColor" />
          <path d="M49 82h22" stroke="#d8e3cf" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

function PreferencePanel({
  preferences,
  onChange,
  onUpdate,
  onCategoryChange,
  onBudgetInput,
  onBudgetCurrencyChange,
  budgetDraft,
  budgetCurrencyDraft,
  budgetError,
  brandDraft,
  onBrandDraft,
  editorNote,
  showUpdate,
}: {
  preferences: Preferences;
  onChange: (next: Preferences) => void;
  onUpdate: () => void;
  onCategoryChange: (category: Category | null) => void;
  onBudgetInput: (raw: string, currency: "SGD" | "USD") => void;
  onBudgetCurrencyChange: (currency: "SGD" | "USD") => void;
  budgetDraft: string;
  budgetCurrencyDraft: "SGD" | "USD";
  budgetError: string | null;
  brandDraft: string;
  onBrandDraft: (value: string) => void;
  editorNote: string | null;
  showUpdate: boolean;
}) {
  const category = preferences.hard.category;
  const changeHard = (patch: Partial<Preferences["hard"]>) =>
    onChange({ ...preferences, hard: { ...preferences.hard, ...patch } });
  const changeSoft = (patch: Partial<Preferences["soft"]>) =>
    onChange({ ...preferences, soft: { ...preferences.soft, ...patch } });

  function toggleFeature(feature: Feature, checked: boolean) {
    const current = preferences.hard.requiredFeatures;
    changeHard({ requiredFeatures: checked ? [...current, feature] : current.filter((item) => item !== feature) });
  }

  function togglePriority(priority: Priority, checked: boolean) {
    const current = preferences.soft.priorities;
    changeSoft({ priorities: checked ? [priority, ...current.filter((item) => item !== priority)] : current.filter((item) => item !== priority) });
  }

  return (
    <aside className="preferences-panel" aria-labelledby="preferences-heading">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">YOUR FILTERS</p>
          <h2 id="preferences-heading">Set the boundaries</h2>
        </div>
        <span className="edit-mark">EDITABLE</span>
      </div>
      {editorNote && <p className="preference-edit-note" role="status">{editorNote}</p>}

      <label className="field-label" htmlFor="category">Product type</label>
      <select
        id="category"
        value={category ?? ""}
        onChange={(event) => onCategoryChange((event.target.value || null) as Category | null)}
      >
        <option value="">Choose a category</option>
        <option value="headphones">Headphones</option>
        <option value="laptops">Laptops</option>
      </select>

      <div className="field-label budget-label">Maximum budget <span>HARD LIMIT</span></div>
      <div className="budget-row">
        <select
          aria-label="Budget currency"
          value={budgetCurrencyDraft}
          onChange={(event) => onBudgetCurrencyChange(event.target.value as "SGD" | "USD")}
        >
          <option value="SGD">SGD</option>
          <option value="USD">USD</option>
        </select>
        <input
          aria-label="Maximum budget amount"
          inputMode="decimal"
          type="number"
          min="1"
          step="1"
          placeholder="No cap"
          value={budgetDraft}
          aria-invalid={Boolean(budgetError)}
          aria-describedby={budgetError ? "budget-error" : undefined}
          onChange={(event) => onBudgetInput(event.target.value, budgetCurrencyDraft)}
        />
      </div>
      {budgetError && <p id="budget-error" className="budget-error" role="alert">{budgetError}</p>}
      {preferences.hard.budget && !budgetError && <button className="clear-budget" type="button" onClick={() => onBudgetInput("", budgetCurrencyDraft)}>Clear budget cap</button>}

      <label className="field-label" htmlFor="region">Offer region</label>
      <select
        id="region"
        value={preferences.hard.region}
        onChange={(event) => changeHard({ region: event.target.value as "SG" | "US" })}
      >
        <option value="SG">Singapore · SGD</option>
        <option value="US">United States · USD</option>
      </select>
      <p className="field-hint">Sample offers use this region. Shipping is not checked.</p>

      <label className="field-label" htmlFor="excluded-brands">Brands to exclude <span>HARD LIMIT</span></label>
      <input
        id="excluded-brands"
        className="text-input"
        type="text"
        value={brandDraft}
        placeholder="For example, Bose"
        onChange={(event) => onBrandDraft(event.target.value)}
      />

      {category && (
        <fieldset className="choice-group">
          <legend>Must have <span>HARD LIMIT</span></legend>
          {featureOptions[category].map((option) => (
            <label className="check-row" key={option.value}>
              <input
                type="checkbox"
                checked={preferences.hard.requiredFeatures.includes(option.value)}
                onChange={(event) => toggleFeature(option.value, event.target.checked)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      {preferences.hard.pendingConstraint && (
        <div className="pending-constraint" role="note">
          <p>Unresolved hard requirement</p>
          <span>{preferences.hard.pendingConstraint}</span>
          <button type="button" onClick={() => changeHard({ pendingConstraint: null })}>Drop this requirement</button>
        </div>
      )}

      <label className="field-label" htmlFor="use-case">Use case</label>
      <input
        id="use-case"
        className="text-input"
        type="text"
        maxLength={160}
        value={preferences.soft.useCase}
        placeholder="Flights, writing, study…"
        onChange={(event) => changeSoft({ useCase: event.target.value })}
      />

      {category && (
        <fieldset className="choice-group priority-group">
          <legend>What matters more? <span>FLEXIBLE</span></legend>
          <div className="priority-chips">
            {priorityOptions[category].map((option) => {
              const selected = preferences.soft.priorities.includes(option.value);
              return (
                <label className={`priority-chip ${selected ? "selected" : ""}`} key={option.value}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => togglePriority(option.value, event.target.checked)}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          <p className="priority-hint">The first selected priority has the most influence.</p>
        </fieldset>
      )}

      <label className="field-label" htmlFor="response-length">Answer length <span>ADAPTS</span></label>
      <select
        id="response-length"
        value={preferences.soft.responseLength}
        onChange={(event) => changeSoft({ responseLength: event.target.value as "concise" | "expanded" })}
      >
        <option value="concise">Concise</option>
        <option value="expanded">More detail</option>
      </select>

      {showUpdate && <button className="update-filters" type="button" onClick={onUpdate} disabled={Boolean(budgetError)}>Update comparison <span aria-hidden="true">↗</span></button>}
    </aside>
  );
}

function ClaimDetails({ candidate }: { candidate: Candidate }) {
  return (
    <details className="evidence-details">
      <summary>Evidence and limits <span aria-hidden="true">＋</span></summary>
      <p className="fixture-explainer">Claims are synthetic fixture data. Manufacturer reference/model pages provide context only. They do not verify these claims, price, stock, or delivery.</p>
      {candidate.product.claims.length === 0 ? <p className="unknown-claim">No product claims are recorded in this fixture.</p> : (
        <ul className="claim-list">
          {candidate.product.claims.map((claim, index) => (
            <li key={`${claim.key}-${index}`}>
              {claim.status === "supported" && (
                <>
                  <span className="claim-state supported">SAMPLE CLAIM</span>
                  <strong>{claim.key.replaceAll("-", " ")}</strong>
                  <span>{claim.value}</span>
                  <div className="source-references">{claim.sources.map((source) => <SourceReference key={source.id} source={source} productUrl={candidate.product.productUrl} />)}</div>
                </>
              )}
              {claim.status === "unknown" && (
                <>
                  <span className="claim-state unknown">UNKNOWN</span>
                  <strong>{claim.key.replaceAll("-", " ")}</strong>
                  <span>{claim.note}</span>
                </>
              )}
              {claim.status === "conflict" && (
                <>
                  <span className="claim-state conflict">CONFLICTING SAMPLE CLAIMS</span>
                  <strong>{claim.key.replaceAll("-", " ")}</strong>
                  {claim.observations.map((observation, observationIndex) => (
                    <span key={`${observation.source.id}-${observationIndex}`}>
                      {observation.value} · {observation.source.name}
                      <SourceReference source={observation.source} productUrl={candidate.product.productUrl} />
                    </span>
                  ))}
                  <small>These fixture records disagree. The comparison does not use this claim as a reason.</small>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function ProductCard({
  candidate,
  index,
  onSelect,
  selecting,
}: {
  candidate: Candidate;
  index: number;
  onSelect: () => void;
  selecting: boolean;
}) {
  const offer = candidate.offer;
  const currency = currencySymbol(offer.price.currency);
  const date = new Date(offer.observedAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <article className={`product-card ${index === 0 ? "top-pick" : ""}`}>
      <div className="card-art-row">
        <ProductGlyph category={candidate.product.category} />
        <span className="rank-label">{index === 0 ? "BEST FIT · SAMPLE" : `OPTION 0${index + 1} · SAMPLE`}</span>
      </div>
      <div className="product-copy">
        <p className="product-brand">{candidate.product.brand} <span>· {candidate.product.category === "headphones" ? "Headphones" : "Laptop"}</span></p>
        <h3>{candidate.product.name}</h3>
        <p className="product-summary">{candidate.product.summary}</p>
        <ul className="reason-list">
          {candidate.reasons.map((reason) => <li key={reason}><span aria-hidden="true">✓</span>{reason}</li>)}
        </ul>
      </div>
      <div className="offer-box">
        <div className="offer-price-line">
          <strong>{currency}{offer.price.amount.toLocaleString("en-SG")}</strong>
          <span className="sample-badge">SAMPLE</span>
        </div>
        <p>Sample price · fixture only</p>
        <div className="stock-line">
          <span className={`stock-dot ${offer.availability === "sample-in-stock" ? "shown" : "unknown"}`} />
          <span>{offer.availability === "sample-in-stock" ? "Sample says in stock" : offer.availability === "sample-unavailable" ? "Sample says unavailable" : "Stock unknown"}</span>
        </div>
        <small>Fixture snapshot · {date} · {offer.region}</small>
      </div>
      <ClaimDetails candidate={candidate} />
      <button className="select-product" type="button" onClick={onSelect} disabled={selecting}>
        {selecting ? "Checking sample link…" : "Select this product"}
        {!selecting && <span aria-hidden="true">↗</span>}
      </button>
    </article>
  );
}

function Results({
  outcome,
  onSelect,
  onRetry,
  selectingId,
  selectionError,
}: {
  outcome: TurnResult | null;
  onSelect: (candidate: Candidate) => void;
  onRetry: () => void;
  selectingId: string | null;
  selectionError: string | null;
}) {
  if (!outcome) {
    return (
      <div className="empty-results">
        <div className="empty-mark" aria-hidden="true">✳</div>
        <p className="section-kicker">YOUR RESEARCH WILL APPEAR HERE</p>
        <h2>A useful answer, with the trade-offs close by.</h2>
        <p>Start with a request, then adjust the hard limits and priorities as you go.</p>
        <div className="empty-footnote"><span className="status-dot" />Fixture demo · no live inventory</div>
      </div>
    );
  }

  return (
    <section className="results-area" aria-live="polite" aria-labelledby="results-heading">
      <div className="results-header">
        <div>
          <p className="section-kicker">RESEARCH SUMMARY</p>
          <h2 id="results-heading">Your shortlist</h2>
        </div>
        <span className="fixture-label">DEMO DATA</span>
      </div>
      {outcome.kind !== "recommendations" && <PreferenceNotes notes={outcome.notes} />}
      {outcome.kind === "recommendations" && (
        <>
          <div className="answer-first"><span className="answer-tick" aria-hidden="true">↗</span><p>{outcome.answer}</p></div>
          <PreferenceNotes notes={outcome.notes} />
          <div className="shortlist-heading"><h3>{outcome.candidates.length} options that fit</h3><span>HARD LIMITS APPLIED</span></div>
          <div className="product-grid">
            {outcome.candidates.map((candidate, index) => (
              <ProductCard
                key={candidate.product.id}
                candidate={candidate}
                index={index}
                onSelect={() => onSelect(candidate)}
                selecting={selectingId === candidate.product.id}
              />
            ))}
          </div>
          {selectionError && <p role="alert" className="selection-error">{selectionError}</p>}
        </>
      )}
      {outcome.kind === "clarification" && (
        <div className="message-panel clarification-panel">
          <span className="message-icon" aria-hidden="true">?</span>
          <div><h3>One thing to clarify</h3><p>{outcome.message}</p></div>
        </div>
      )}
      {outcome.kind === "no-match" && (
        <div className="message-panel no-match-panel">
          <span className="message-icon" aria-hidden="true">⌕</span>
          <div><h3>No sample option meets these limits</h3><p>{outcome.message}</p><p className="no-relax-note">The demo kept your hard limits. Edit them if you want to explore a wider set.</p></div>
        </div>
      )}
      {outcome.kind === "error" && (
        <div className="message-panel error-panel" role="alert">
          <span className="message-icon" aria-hidden="true">!</span>
          <div><h3>Research paused</h3><p>{outcome.message}</p><button className="text-action" onClick={onRetry}>Try again</button></div>
        </div>
      )}
    </section>
  );
}

function Handoff({ result, onReset }: { result: Extract<SelectionResult, { kind: "handoff" }>; onReset: () => void }) {
  const price = result.offer.price;
  return (
    <section className="handoff-panel" aria-labelledby="handoff-heading">
      <div className="handoff-icon" aria-hidden="true">↗</div>
      <div className="handoff-content">
        <p className="section-kicker">PRODUCT PAGE HANDOFF</p>
        <h2 id="handoff-heading">{result.productName}</h2>
        <p>{result.label}</p>
        <div className="handoff-offer">
          <strong>{currencySymbol(price.currency)}{price.amount.toLocaleString("en-SG")}</strong>
          <span>Sample price · fixture only</span>
        </div>
        <p className="handoff-domain">Merchant host <code>{new URL(result.productUrl).hostname}</code></p>
        <a className="merchant-link" href={result.productUrl} target="_blank" rel="noopener noreferrer">
          Open manufacturer product page <span aria-hidden="true">↗</span>
        </a>
        <p className="handoff-caveat">The link passed the demo’s HTTPS and approved-host checks. The sample price and stock were not checked live.</p>
        <button className="text-action" type="button" onClick={onReset}>Start a new search</button>
      </div>
    </section>
  );
}

function PreferenceNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="preference-notes">
      {notes.map((note) => <li key={note}><span aria-hidden="true">i</span>{note}</li>)}
    </ul>
  );
}

export function App() {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [input, setInput] = useState("");
  const [budgetDraft, setBudgetDraft] = useState("");
  const [budgetCurrencyDraft, setBudgetCurrencyDraft] = useState<"SGD" | "USD">("SGD");
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [brandDraft, setBrandDraft] = useState("");
  const [editorNote, setEditorNote] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TurnResult | null>(null);
  const [lastMessage, setLastMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Extract<SelectionResult, { kind: "handoff" }> | null>(null);
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
    if (preferences.hard.budget?.currency) setBudgetCurrencyDraft(preferences.hard.budget.currency);
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
      editPreferences({ ...preferences, hard: { ...preferences.hard, budget: null } });
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
    editPreferences({ ...preferences, hard: { ...preferences.hard, budget: { amount, currency } } });
  }

  function editBudgetCurrency(currency: "SGD" | "USD") {
    setBudgetCurrencyDraft(currency);
    if (budgetError || !budgetDraft.trim()) return;
    const amount = Number(budgetDraft);
    if (Number.isFinite(amount) && amount > 0) {
      editPreferences({ ...preferences, hard: { ...preferences.hard, budget: { amount, currency } } });
    }
  }

  function editCategory(category: Category | null) {
    const featureSet = new Set(category ? featureOptions[category].map(({ value }) => value) : []);
    const prioritySet = new Set(category ? priorityOptions[category].map(({ value }) => value) : []);
    const removedFeatures = preferences.hard.requiredFeatures.filter((feature) => !featureSet.has(feature));
    const removedPriorities = preferences.soft.priorities.filter((priority) => !prioritySet.has(priority));
    const next: Preferences = {
      hard: {
        ...preferences.hard,
        category,
        requiredFeatures: preferences.hard.requiredFeatures.filter((feature) => featureSet.has(feature)),
      },
      soft: {
        ...preferences.soft,
        priorities: preferences.soft.priorities.filter((priority) => prioritySet.has(priority)),
      },
    };
    editPreferences(next);
    const removed = [...removedFeatures.map((feature) => feature.replaceAll("-", " ")), ...removedPriorities.map((priority) => `${priority.replaceAll("-", " ")} priority`)];
    setEditorNote(removed.length ? `Cleared ${removed.join(", ")} because they do not apply to ${category ?? "an unspecified category"}.` : null);
  }

  function commitBrandDraft() {
    if (budgetError) return null;
    const excludedBrands = brandDraft.split(",").map((brand) => brand.trim()).filter(Boolean);
    const unchanged = excludedBrands.length === preferences.hard.excludedBrands.length
      && excludedBrands.every((brand, index) => brand === preferences.hard.excludedBrands[index]);
    if (unchanged) return preferences;
    const next = { ...preferences, hard: { ...preferences.hard, excludedBrands } };
    editPreferences(next);
    return next;
  }

  function updateEditedOptions() {
    const next = commitBrandDraft();
    if (next) void submitTurn("", next);
  }

  async function submitTurn(message: string, requestPreferences: Preferences = preferences) {
    if (budgetError) {
      setNetworkError("Fix the budget amount or clear the cap before researching.");
      return;
    }
    const text = message.trim();
    if (!text && !requestPreferences.hard.category) {
      setNetworkError("Tell us what kind of product you need, or choose a category first.");
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
      const result = await runTurn(requestText, requestPreferences, controller.signal);
      if (id !== turnId.current || revision !== preferenceRevision.current || promptRevision !== inputRevision.current) return;
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
      if (controller.signal.aborted || id !== turnId.current || revision !== preferenceRevision.current || promptRevision !== inputRevision.current) return;
      setNetworkError(error instanceof Error ? error.message : "Research could not finish. Try again.");
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
      const result = await selectProduct(candidate.product.id, preferences, controller.signal);
      if (id !== selectionId.current) return;
      if (result.kind === "error") setSelectionError(result.message);
      else setSelection(result);
    } catch (error) {
      if (controller.signal.aborted || id !== selectionId.current) return;
      setSelectionError(error instanceof Error ? error.message : "The sample handoff is unavailable.");
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand-lockup" href="/" onClick={(event) => event.preventDefault()} aria-label="Fieldnote research home">
          <span className="brand-symbol" aria-hidden="true">f</span>
          <span>fieldnote</span>
          <i>RESEARCH STUDIO</i>
        </a>
        <div className="topbar-right">
          <span className="demo-status"><span /> FIXTURE MODE</span>
          <button className="reset-button" type="button" onClick={reset}>Reset session <span aria-hidden="true">↺</span></button>
        </div>
      </header>

      <main className="page-content">
        <section className="page-intro">
          <div className="intro-copy">
            <p className="section-kicker">A LITTLE CLARITY BEFORE YOU BUY</p>
            <h1>Research first.<br /><em>Choose with care.</em></h1>
          </div>
          <p className="intro-side-note">A focused product shortlist, built around what matters to you. Sample data is labeled throughout.</p>
        </section>

        <section className="workspace" aria-label="Product research workspace">
          <PreferencePanel
            preferences={preferences}
            onChange={editPreferences}
            onUpdate={updateEditedOptions}
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
          <div className="research-column">
            <form className="request-card" onSubmit={(event) => {
              event.preventDefault();
              const next = commitBrandDraft();
              if (next) void submitTurn(outcome ? "" : input, next);
            }}>
              <div className="request-card-header">
                <div><p className="section-kicker">TELL US WHAT YOU NEED</p><label htmlFor="request">Start with the outcome, not a model number.</label></div>
                <span className="request-step">01 / 03</span>
              </div>
              <textarea
                id="request"
                value={input}
                maxLength={2000}
                rows={3}
                placeholder="For example, headphones for long flights under S$500…"
                onChange={(event) => editInput(event.target.value)}
              />
              <div className="starter-prompts" aria-label="Example requests">
                {starterPrompts.map((prompt, index) => (
                  <button key={prompt} type="button" className="starter-pill" onClick={() => {
                    editInput(prompt);
                    const next = commitBrandDraft();
                    if (next) void submitTurn(prompt, next);
                  }}>
                    <span>0{index + 1}</span>{prompt}
                  </button>
                ))}
              </div>
              <div className="request-submit-row">
                <span><span className="lock-mark" aria-hidden="true">◌</span> Preferences stay in this tab</span>
                <button className="submit-button" type="submit" disabled={loading || Boolean(budgetError)}>
                  {loading ? "Researching…" : lastMessage && !input ? "Update shortlist" : "Research options"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </form>

            {networkError && (
              <div className="network-error" role="alert">
                <span>{networkError}</span>
                {lastMessage && <button className="text-action" type="button" onClick={() => {
                  const next = commitBrandDraft();
                  if (next) void submitTurn(lastMessage, next);
                }}>Retry</button>}
              </div>
            )}
            {loading && <div className="loading-state" role="status"><span className="loading-orbit" />Checking the sample catalog against your limits…</div>}

            {selection ? (
              <Handoff result={selection} onReset={reset} />
            ) : (
              <Results
                outcome={outcome}
                onSelect={(candidate) => void handleSelect(candidate)}
                onRetry={() => {
                  const next = commitBrandDraft();
                  if (next) void submitTurn(lastMessage || input, next);
                }}
                selectingId={selectingId}
                selectionError={selectionError}
              />
            )}
          </div>
        </section>

        <footer className="site-footer">
          <span>FIELDNOTE · RESEARCH WORKSPACE</span>
          <span>Demo catalog · offers are samples, not live inventory</span>
        </footer>
      </main>
    </div>
  );
}
