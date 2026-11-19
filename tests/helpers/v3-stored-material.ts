import storedConversation from "../fixtures/stored-conversation-v3.json";
import { StoredConversationV3Schema } from "../../src/domain/workspace-history-v3";

export function actualStoredConversationV3() { return StoredConversationV3Schema.parse(storedConversation.state); }
