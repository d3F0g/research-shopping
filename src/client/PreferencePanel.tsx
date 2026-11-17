import type {
  Category,
  Feature,
  Preferences,
  Priority,
} from "../domain/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { featureOptions, priorityOptions } from "./preference-options";

type PreferencePanelProps = {
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
};

export function PreferencePanel({
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
}: PreferencePanelProps) {
  const category = preferences.hard.category;
  const changeHard = (patch: Partial<Preferences["hard"]>) =>
    onChange({ ...preferences, hard: { ...preferences.hard, ...patch } });
  const changeSoft = (patch: Partial<Preferences["soft"]>) =>
    onChange({ ...preferences, soft: { ...preferences.soft, ...patch } });

  function toggleFeature(feature: Feature, checked: boolean) {
    const current = preferences.hard.requiredFeatures;
    changeHard({
      requiredFeatures: checked
        ? [...current, feature]
        : current.filter((item) => item !== feature),
    });
  }

  function togglePriority(priority: Priority, checked: boolean) {
    const current = preferences.soft.priorities;
    changeSoft({
      priorities: checked
        ? [priority, ...current.filter((item) => item !== priority)]
        : current.filter((item) => item !== priority),
    });
  }

  return (
    <div className="preferences-panel">
      <FieldGroup>
        {editorNote && (
          <p className="preference-edit-note" role="status">
            {editorNote}
          </p>
        )}
        <FieldSet>
          <FieldLegend className="flex items-center gap-2 text-sm">
            Hard limits <Badge variant="outline">Required</Badge>
          </FieldLegend>
          <FieldDescription className="text-xs">
            Every result must meet these boundaries.
          </FieldDescription>
          <Field>
            <FieldLabel htmlFor="category">Product type</FieldLabel>
            <NativeSelect
              id="category"
              value={category ?? ""}
              onChange={(event) =>
                onCategoryChange(
                  (event.target.value || null) as Category | null,
                )
              }
            >
              <NativeSelectOption value="">
                Choose a category
              </NativeSelectOption>
              <NativeSelectOption value="headphones">
                Headphones
              </NativeSelectOption>
              <NativeSelectOption value="laptops">Laptops</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field data-invalid={Boolean(budgetError)}>
            <FieldLabel htmlFor="budget-amount">Maximum budget</FieldLabel>
            <div className="budget-row">
              <NativeSelect
                aria-label="Budget currency"
                value={budgetCurrencyDraft}
                onChange={(event) =>
                  onBudgetCurrencyChange(event.target.value as "SGD" | "USD")
                }
              >
                <NativeSelectOption value="SGD">SGD</NativeSelectOption>
                <NativeSelectOption value="USD">USD</NativeSelectOption>
              </NativeSelect>
              <Input
                id="budget-amount"
                aria-label="Maximum budget amount"
                inputMode="decimal"
                type="number"
                min="1"
                step="1"
                placeholder="No cap"
                value={budgetDraft}
                aria-invalid={Boolean(budgetError)}
                aria-describedby={budgetError ? "budget-error" : undefined}
                onChange={(event) =>
                  onBudgetInput(event.target.value, budgetCurrencyDraft)
                }
              />
            </div>
            {budgetError && (
              <FieldError id="budget-error">{budgetError}</FieldError>
            )}
            {preferences.hard.budget && !budgetError && (
              <Button
                variant="link"
                className="justify-start px-0"
                onClick={() => onBudgetInput("", budgetCurrencyDraft)}
              >
                Clear budget cap
              </Button>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="region">Offer region</FieldLabel>
            <NativeSelect
              id="region"
              value={preferences.hard.region}
              onChange={(event) =>
                changeHard({ region: event.target.value as "SG" | "US" })
              }
            >
              <NativeSelectOption value="SG">
                Singapore · SGD
              </NativeSelectOption>
              <NativeSelectOption value="US">
                United States · USD
              </NativeSelectOption>
            </NativeSelect>
            <FieldDescription className="text-xs">
              Sample offers only. Shipping is not checked.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="excluded-brands">Brands to exclude</FieldLabel>
            <Input
              id="excluded-brands"
              value={brandDraft}
              placeholder="For example, Bose, Sony"
              onChange={(event) => onBrandDraft(event.target.value)}
            />
            <FieldDescription className="text-xs">
              Separate brands with commas.
            </FieldDescription>
          </Field>
          {category && (
            <FieldSet className="gap-1">
              <FieldLegend variant="label">Must have</FieldLegend>
              {featureOptions[category].map((option) => (
                <Field
                  key={option.value}
                  orientation="horizontal"
                  className="choice-row"
                >
                  <Checkbox
                    id={`feature-${option.value}`}
                    checked={preferences.hard.requiredFeatures.includes(
                      option.value,
                    )}
                    onCheckedChange={(checked) =>
                      toggleFeature(option.value, checked)
                    }
                  />
                  <FieldLabel
                    htmlFor={`feature-${option.value}`}
                    className="font-normal"
                  >
                    {option.label}
                  </FieldLabel>
                </Field>
              ))}
            </FieldSet>
          )}
          {preferences.hard.pendingConstraint && (
            <Alert>
              <AlertTitle>Unresolved hard requirement</AlertTitle>
              <AlertDescription>
                <p>{preferences.hard.pendingConstraint}</p>
                <Button
                  variant="outline"
                  onClick={() => changeHard({ pendingConstraint: null })}
                >
                  Drop this requirement
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </FieldSet>
        <Separator />
        <FieldSet>
          <FieldLegend className="flex items-center gap-2 text-sm">
            Preferences <Badge variant="secondary">Flexible</Badge>
          </FieldLegend>
          <Field>
            <FieldLabel htmlFor="use-case">Use case</FieldLabel>
            <Input
              id="use-case"
              maxLength={160}
              value={preferences.soft.useCase}
              placeholder="Flights, writing, study…"
              onChange={(event) => changeSoft({ useCase: event.target.value })}
            />
          </Field>
          {category && (
            <FieldSet className="gap-1">
              <FieldLegend variant="label">What matters more?</FieldLegend>
              {priorityOptions[category].map((option) => (
                <Field
                  key={option.value}
                  orientation="horizontal"
                  className="choice-row"
                >
                  <Checkbox
                    id={`priority-${option.value}`}
                    checked={preferences.soft.priorities.includes(option.value)}
                    onCheckedChange={(checked) =>
                      togglePriority(option.value, checked)
                    }
                  />
                  <FieldLabel
                    htmlFor={`priority-${option.value}`}
                    className="font-normal"
                  >
                    {option.label}
                  </FieldLabel>
                  {preferences.soft.priorities.includes(option.value) && (
                    <span
                      className="priority-order"
                      aria-label={`Priority ${preferences.soft.priorities.indexOf(option.value) + 1}`}
                    >
                      {preferences.soft.priorities.indexOf(option.value) + 1}
                    </span>
                  )}
                </Field>
              ))}
              <FieldDescription className="text-xs">
                The most recently selected priority has the most influence.
              </FieldDescription>
            </FieldSet>
          )}
          <Field>
            <FieldLabel htmlFor="response-length">Answer length</FieldLabel>
            <NativeSelect
              id="response-length"
              value={preferences.soft.responseLength}
              onChange={(event) =>
                changeSoft({
                  responseLength: event.target.value as "concise" | "expanded",
                })
              }
            >
              <NativeSelectOption value="concise">Concise</NativeSelectOption>
              <NativeSelectOption value="expanded">
                More detail
              </NativeSelectOption>
            </NativeSelect>
          </Field>
        </FieldSet>
        {showUpdate && (
          <Button
            className="h-10 w-full"
            onClick={onUpdate}
            disabled={Boolean(budgetError)}
          >
            Update comparison
          </Button>
        )}
      </FieldGroup>
    </div>
  );
}
