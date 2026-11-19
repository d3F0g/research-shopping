import { BudgetSchema } from "../domain/contracts";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function BudgetQuestion({
  currency,
  active,
  onReply,
  onSkip,
}: {
  currency: "SGD" | "USD";
  active: boolean;
  onReply: (message: string) => void;
  onSkip: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(false);
  const id = useId();
  return (
    <Card className="question-card">
      <CardContent>
        <h2>Any budget in mind?</h2>
        <p className="metadata">Optional. A cap helps narrow the options.</p>
        {active ? (
          <>
            <form
              noValidate
              className="budget-question-form"
              onSubmit={(event) => {
                event.preventDefault();
                const budget = BudgetSchema.safeParse({
                  amount: Number(amount),
                  currency,
                });
                if (!budget.success) setError(true);
                else
                  onReply(
                    `under ${budget.data.currency} ${budget.data.amount}`,
                  );
              }}
            >
              <Field>
                <FieldLabel htmlFor={id}>Budget amount</FieldLabel>
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="1000000"
                  step="0.01"
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
