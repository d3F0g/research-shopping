import { useId, useState } from "react";
import type { Preferences } from "../domain/contracts";
import { validBudgetAmount } from "../domain/preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function BudgetQuestion({
  preferences,
  active,
  onReply,
  onSkip,
}: {
  preferences: Preferences;
  active: boolean;
  onReply: (message: string) => void;
  onSkip: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(false);
  const id = useId();
  const currency = preferences.hard.region === "SG" ? "SGD" : "USD";
  const caps =
    preferences.hard.category === "laptops"
      ? [1000, 1500, 2000]
      : [150, 300, 500];
  return (
    <Card className="question-card">
      <CardContent>
        <h2>Any budget in mind?</h2>
        <p className="metadata">
          Optional. A cap helps narrow the options.
        </p>
        {active ? (
          <>
            <div className="quick-choices">
              {caps.map((cap) => (
                <Button
                  key={cap}
                  variant="outline"
                  onClick={() => onReply(`under ${currency} ${cap}`)}
                >
                  {currency} {cap.toLocaleString("en-SG")}
                </Button>
              ))}
            </div>
            <form
              className="budget-question-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!validBudgetAmount(Number(amount))) setError(true);
                else onReply(`under ${currency} ${Number(amount)}`);
              }}
            >
              <Field>
                <FieldLabel htmlFor={id}>Budget amount</FieldLabel>
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  placeholder={`Custom ${currency} amount`}
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setError(false);
                  }}
                  aria-invalid={error}
                />
                {error && (
                  <FieldError>
                    Use a positive amount up to 1,000,000 with at most two
                    decimal places.
                  </FieldError>
                )}
              </Field>
              <Button type="submit" variant="secondary">
                Apply budget
              </Button>
            </form>
            <Button variant="ghost" onClick={onSkip}>
              Skip budget
            </Button>
          </>
        ) : (
          <p className="metadata">
            You can change the budget in a new message.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
