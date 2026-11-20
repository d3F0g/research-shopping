import { createRoot } from "react-dom/client";
import { useFieldnote } from "../../src/client/useFieldnote";

function Hook() {
  const chat = useFieldnote();
  Object.assign(window, { fixtureChat: chat });
  return <>
    <h1>Fixture hook lifecycle</h1>
    <pre data-testid="state">{JSON.stringify({ state: chat.state, account: chat.account, ready: chat.ready, error: chat.error, draft: chat.draft })}</pre>
    <label>Fixture draft<input value={chat.draft} onChange={(event) => chat.setDraft(event.target.value)} /></label>
    <button onClick={() => void chat.reload()}>Fixture reload</button>
    <button onClick={() => void chat.send(chat.draft)} disabled={!chat.ready}>Fixture send</button>
  </>;
}
createRoot(document.getElementById("root")!).render(<Hook />);
