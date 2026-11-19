import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function HeldReplyDetails({ detail }: { detail: string }) {
  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
        Full evidence and conditions
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="whitespace-pre-wrap break-words pt-2">{detail}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
