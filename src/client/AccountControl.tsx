import { useId, useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { AccountState } from "../domain/workspace";

export type AccountControlProps = {
  account: AccountState | { status: "loading" };
  onReload: () => Promise<void>;
  onAuthenticated: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDelete: () => Promise<void>;
};
export function AccountControl({ account, onReload, onAuthenticated, onSignOut, onDelete }: AccountControlProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The account request failed. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); setError(""); setConfirmDelete(false); } }}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Account" />}><UserRound /></SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{account.status === "signed-in" ? "Your saved conversation" : "Your account"}</SheetTitle>
          <SheetDescription>Sign in to save your conversation. Guest messages are never uploaded.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          {account.status === "loading" ? <p role="status">Checking your account...</p> : account.status === "guest-only" ? <p>Accounts are not configured. Guest conversation stays in this tab until refresh.</p> : account.status === "unavailable" ? <>
            <p>Account persistence is unavailable. Reconnect before editing saved conversation.</p>
            <Button variant="outline" disabled={busy} onClick={() => void perform(onReload)}>Reload account</Button>
          </> : account.status === "signed-in" ? <>
            <p className="break-all">{account.user.email}</p>
            <p>Saved turns and preferences expire after 30 days. History keeps up to 50 whole turns and 256 KiB. Older turns are removed when needed.</p>
            <p>Deleting saved data clears shopping messages and preferences. Your sign-in account remains. Full account deletion and password recovery are unavailable.</p>
            {confirmDelete ? <>
              <p>Delete all saved shopping messages and preferences?</p>
              <Button variant="destructive" disabled={busy} onClick={() => void perform(async () => { await onDelete(); setConfirmDelete(false); })}>Confirm delete saved data</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>Keep saved data</Button>
            </> : <Button variant="outline" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete saved data</Button>}
            <Button variant="outline" disabled={busy} onClick={() => void perform(async () => { await onSignOut(); setOpen(false); })}>Sign out</Button>
          </> : <>
            <p>Email verification and password recovery are unavailable. Use an account only for local development.</p>
            <form className="flex flex-col gap-4" onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const fields = new FormData(form);
              const body = { email: String(fields.get("email") ?? ""), password: String(fields.get("password") ?? ""), ...(register ? { name: String(fields.get("name") ?? "") } : {}) };
              void perform(async () => {
                const response = await fetch(`/api/auth/${register ? "sign-up" : "sign-in"}/email`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
                if (!response.ok) throw new Error(register ? "Account creation failed. Use a valid email and a password of 12 to 128 characters, or sign in." : "Sign-in failed. Check your email and password.");
                form.reset();
                await onAuthenticated();
                setOpen(false);
              });
            }}>
              {register && <Field><FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel><Input id={`${id}-name`} name="name" autoComplete="name" maxLength={100} required disabled={busy} /></Field>}
              <Field><FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel><Input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} /></Field>
              <Field><FieldLabel htmlFor={`${id}-password`}>Password</FieldLabel><Input id={`${id}-password`} name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={12} maxLength={128} required disabled={busy} /></Field>
              <Button type="submit" disabled={busy}>{busy ? "Working..." : register ? "Create account" : "Sign in"}</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => { setRegister(!register); setError(""); }}>{register ? "Use an existing account" : "Create an account"}</Button>
            </form>
          </>}
          {error && <p role="alert">{error}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
