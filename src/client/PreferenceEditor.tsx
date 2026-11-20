import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import type { ConversationState, PrepareInput } from "../domain/conversation";

export function PreferenceEditor({
  state,
  onApply,
}: {
  state: ConversationState;
  onApply: (
    edit: NonNullable<PrepareInput["edit"]>,
    revision: number,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState<
    NonNullable<PrepareInput["edit"]>["requirements"]
  >([]);
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [currency, setCurrency] = useState("");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  function toggle(value: boolean) {
    if (value) {
      setDescription(state.intent.originalText);
      setRequirements(
        state.intent.requirements
          .filter((r) => r.kind !== "request")
          .map(({ id, text, strength }) => ({ id, text, strength })),
      );
      setMinimum(state.intent.budget?.minimum?.toString() ?? "");
      setMaximum(state.intent.budget?.maximum?.toString() ?? "");
      setCurrency(state.intent.budget?.currency ?? "");
      setRevision(state.revision);
      setError("");
    }
    setOpen(value);
  }
  return (
    <Collapsible open={open} onOpenChange={toggle}>
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
        Current request and preferences
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card size="sm">
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const lo = minimum ? Number(minimum) : undefined,
                  hi = maximum ? Number(maximum) : undefined;
                if (lo !== undefined && hi !== undefined && lo > hi) {
                  setError("Minimum cannot exceed maximum.");
                  return;
                }
                setSaving(true);
                void onApply(
                  {
                    description,
                    requirements,
                    budget:
                      lo !== undefined || hi !== undefined
                        ? { minimum: lo, maximum: hi, currency }
                        : null,
                  },
                  revision,
                )
                  .then(() => setOpen(false))
                  .catch(() =>
                    setError(
                      "The edit could not be applied. Your prior preferences remain active.",
                    ),
                  )
                  .finally(() => setSaving(false));
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="request-description">Shopping objective</Label>
                <Textarea
                  id="request-description"
                  value={description}
                  required
                  maxLength={2000}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              {requirements.map((r, i) => (
                <div className="space-y-2" key={r.id}>
                  <Label htmlFor={`requirement-${i}`}>
                    Requirement {i + 1}
                  </Label>
                  <Input
                    id={`requirement-${i}`}
                    required
                    maxLength={2000}
                    value={r.text}
                    onChange={(e) =>
                      setRequirements((items) =>
                        items.map((row) =>
                          row.id === r.id
                            ? { ...row, text: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <NativeSelect
                      aria-label={`Requirement ${i + 1} strength`}
                      value={r.strength}
                      onChange={(e) =>
                        setRequirements((items) =>
                          items.map((row) =>
                            row.id === r.id
                              ? {
                                  ...row,
                                  strength: e.target.value as
                                    "hard" | "flexible",
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      <NativeSelectOption value="hard">
                        Must have
                      </NativeSelectOption>
                      <NativeSelectOption value="flexible">
                        Prefer
                      </NativeSelectOption>
                    </NativeSelect>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setRequirements((items) =>
                          items.filter((row) => row.id !== r.id),
                        )
                      }
                    >
                      Remove requirement {i + 1}
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={requirements.length >= 23}
                onClick={() =>
                  setRequirements((items) => [
                    ...items,
                    { id: crypto.randomUUID(), text: "", strength: "hard" },
                  ])
                }
              >
                Add requirement
              </Button>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="minimum-budget">Minimum</Label>
                  <Input
                    id="minimum-budget"
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    value={minimum}
                    onChange={(e) => setMinimum(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maximum-budget">Maximum</Label>
                  <Input
                    id="maximum-budget"
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    value={maximum}
                    onChange={(e) => setMaximum(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget-currency">Currency</Label>
                  <Input
                    id="budget-currency"
                    value={currency}
                    required={Boolean(minimum || maximum)}
                    pattern="[A-Z]{3}"
                    maxLength={3}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    placeholder="SGD"
                  />
                </div>
              </div>
              <p className="text-muted-foreground">
                Blank bounds remove the budget. Must-have requirements are never
                relaxed automatically.
              </p>
              {error && <p role="alert">{error}</p>}
              <Button type="submit" disabled={saving}>
                Apply and research
              </Button>
            </form>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
