import { Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PreferenceDraft } from "./useConversation";

type DraftFields = Pick<
  PreferenceDraft,
  | "description"
  | "criteria"
  | "budget"
  | "minimumBudget"
  | "currency"
  | "region"
  | "responseLength"
>;
export function PreferencePanel({
  draft,
  onChange,
  onUpdate,
}: {
  draft: PreferenceDraft;
  onChange: (patch: Partial<DraftFields>) => void;
  onUpdate: () => void;
}) {
  return (
    <form
      className="preferences-panel"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onUpdate();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="product-description">
            What you're looking for
          </FieldLabel>
          <Textarea
            id="product-description"
            maxLength={4000}
            value={draft.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
          <FieldDescription>
            Keep your use case and any details that matter. Changing products
            keeps your criteria until you remove them.
          </FieldDescription>
        </Field>
        <div className="intent-criteria" aria-label="Shopping criteria">
          <p className="text-sm font-medium">Your criteria</p>
          <p className="metadata">
            Required criteria must be supported before an option can be
            recommended. Flexible preferences guide the comparison.
          </p>
          {draft.criteria.map((criterion, index) => (
            <div
              className="intent-criterion"
              key={criterion.id ?? `new-${index}`}
            >
              <Field>
                <FieldLabel htmlFor={`criterion-${index}`}>
                  Criterion {index + 1}
                </FieldLabel>
                <Input
                  id={`criterion-${index}`}
                  value={criterion.wording}
                  maxLength={400}
                  onChange={(event) =>
                    onChange({
                      criteria: draft.criteria.map((item, i) =>
                        i === index
                          ? { ...item, wording: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`strength-${index}`}>
                  Importance
                </FieldLabel>
                <NativeSelect
                  id={`strength-${index}`}
                  aria-label={`Importance for criterion ${index + 1}`}
                  value={criterion.strength}
                  onChange={(event) =>
                    onChange({
                      criteria: draft.criteria.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              strength: event.target.value as
                                "hard" | "flexible",
                            }
                          : item,
                      ),
                    })
                  }
                >
                  <NativeSelectOption value="hard">Required</NativeSelectOption>
                  <NativeSelectOption value="flexible">
                    Flexible
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove criterion ${index + 1}`}
                onClick={() =>
                  onChange({
                    criteria: draft.criteria.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={draft.criteria.length >= 12}
            onClick={() =>
              onChange({
                criteria: [
                  ...draft.criteria,
                  { id: null, wording: "", strength: "flexible" },
                ],
              })
            }
          >
            <Plus aria-hidden="true" /> Add criterion
          </Button>
          {draft.criteria.length >= 12 && (
            <p className="metadata">
              Up to 12 criteria. Replace or remove one to add another.
            </p>
          )}
        </div>
        <Field>
          <FieldLabel htmlFor="budget-currency">Budget currency</FieldLabel>
          <NativeSelect
            id="budget-currency"
            aria-label="Budget currency"
            value={draft.currency}
            onChange={(event) =>
              onChange({ currency: event.target.value as "SGD" | "USD" })
            }
          >
            <NativeSelectOption value="SGD">SGD</NativeSelectOption>
            <NativeSelectOption value="USD">USD</NativeSelectOption>
          </NativeSelect>
        </Field>
        <div className="budget-row">
          <Field>
            <FieldLabel htmlFor="budget-minimum">Minimum budget</FieldLabel>
            <Input
              id="budget-minimum"
              aria-label="Minimum budget amount"
              inputMode="decimal"
              value={draft.minimumBudget}
              placeholder="No minimum"
              onChange={(event) =>
                onChange({ minimumBudget: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="budget-amount">Maximum budget</FieldLabel>
            <Input
              id="budget-amount"
              aria-label="Maximum budget amount"
              inputMode="decimal"
              value={draft.budget}
              placeholder="No cap"
              onChange={(event) => onChange({ budget: event.target.value })}
            />
          </Field>
        </div>
        <p className="metadata">
          Clear Minimum to remove the floor. Clear both amounts to remove the
          budget. Market changes do not convert your budget.
        </p>
        <Field>
          <FieldLabel htmlFor="region">Research market</FieldLabel>
          <NativeSelect
            id="region"
            value={draft.region}
            onChange={(event) =>
              onChange({ region: event.target.value as "SG" | "US" })
            }
          >
            <NativeSelectOption value="SG">Singapore</NativeSelectOption>
            <NativeSelectOption value="US">United States</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="response-length">Answer length</FieldLabel>
          <NativeSelect
            id="response-length"
            value={draft.responseLength}
            onChange={(event) =>
              onChange({
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
        {draft.error && (
          <Alert variant="destructive">
            <AlertDescription>{draft.error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit">Save preferences</Button>
        <p className="metadata">
          Saving does not run research. Compare again when you're ready.
        </p>
      </FieldGroup>
    </form>
  );
}
