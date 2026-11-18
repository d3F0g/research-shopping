import { useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { useConversation } from "./useConversation";

export function AccountControl({
  chat,
  open,
  setOpen,
}: {
  chat: ReturnType<typeof useConversation>;
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const signedIn = chat.account.status === "signed-in";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" aria-label="Account" />}
      >
        <UserRound />
      </DialogTrigger>
      <DialogContent className="account-dialog">
        <DialogHeader>
          <DialogTitle>
            {signedIn ? "Your saved conversation" : "Your account"}
          </DialogTitle>
          <DialogDescription>
            {signedIn
              ? "Preferences and conversation are saved to this account."
              : "Sign in to keep preferences and conversation across visits. Guest messages are never uploaded."}
          </DialogDescription>
        </DialogHeader>
        {chat.account.status === "loading" ? (
          <p>Checking your account…</p>
        ) : chat.account.status === "guest-only" ? (
          <p>
            Accounts are not configured. You can continue as a guest. Your
            conversation stays in this tab until refresh.
          </p>
        ) : chat.account.status === "unavailable" ? (
          <div>
            <p>
              Account persistence is unavailable. Reload the account connection
              before continuing.
            </p>
            <Button variant="outline" onClick={() => void chat.reloadAccount()}>
              Reload account
            </Button>
          </div>
        ) : signedIn ? (
          <>
            <p className="account-email">
              {chat.account.status === "signed-in" && chat.account.user.email}
            </p>
            <p className="account-retention">
              Saved turns expire after 30 days. Current preferences expire 30
              days after your last change. History keeps up to 50 turns and 256
              KiB. Older whole turns are removed when needed.
            </p>
            <p className="account-retention">
              New chat and Delete saved data clear this conversation and its
              preferences. Your sign-in account remains. Full account deletion
              is not available.
            </p>
            {confirmDelete ? (
              <div className="account-actions">
                <p>Delete all saved messages and preferences?</p>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await chat.deleteSaved();
                    setBusy(false);
                    setConfirmDelete(false);
                  }}
                >
                  Confirm delete saved data
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep saved data
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                Delete saved data
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await chat.authenticate("sign-out");
                setBusy(false);
                if (ok) setOpen(false);
              }}
            >
              Sign out
            </Button>
          </>
        ) : (
          <form
            className="account-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setBusy(true);
              const ok = await chat.authenticate(
                register ? "sign-up/email" : "sign-in/email",
                {
                  email: String(data.get("email")),
                  password: String(data.get("password")),
                  ...(register ? { name: String(data.get("name")) } : {}),
                },
              );
              setBusy(false);
              if (ok) {
                setRegister(false);
                setOpen(false);
              }
            }}
          >
            {register && (
              <Field>
                <FieldLabel htmlFor="account-name">Name</FieldLabel>
                <Input
                  id="account-name"
                  name="name"
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="account-email">Email</FieldLabel>
              <Input
                id="account-email"
                name="email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="account-password">Password</FieldLabel>
              <Input
                id="account-password"
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={12}
                maxLength={128}
                required
              />
            </Field>
            <p className="account-retention">
              Local accounts use email as an identifier. Email verification,
              password recovery, and social sign-in are not available. Use at
              least 12 characters.
            </p>
            <Button type="submit" disabled={busy}>
              {register ? "Create account" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setRegister(!register)}
            >
              {register ? "Use an existing account" : "Create a local account"}
            </Button>
          </form>
        )}
        {chat.accountError && <p role="alert">{chat.accountError}</p>}
      </DialogContent>
    </Dialog>
  );
}
