import capture from "./research-corpus/native-alignment/captured-fields.json" with { type: "json" };
import type { NativeObservation } from "../../src/server/page-evidence";

export { capture };
export const captureLabel = "Automated replay of captured diagnostic fields. Derived HTTP envelope, not current evidence.";
export const nativeObservations: NativeObservation[] = JSON.parse(capture.fields.native.text).observations;
export const capturedReplay = {
  requestId: "automated-derived-second-call-replay",
  costDollars: { total: 0.007 },
  results: capture.fields.results.map((source) => ({
    title: source.title.text,
    url: source.url.text,
    highlights: source.highlights.map((highlight) => highlight.text),
  })),
  output: { content: { observations: nativeObservations } },
};
export const normalized = (text: string) => text.replace(/\s+/g, " ").trim();
export const ath = {
  name: "ATH-M50xBT2",
  category: capture.fields.results[0].highlights[0].text.slice(123, 230),
  driver: capture.fields.results[0].highlights[0].text.slice(231, 400),
  microphone: capture.fields.results[0].highlights[0].text.slice(1212, 1360),
  controls: capture.fields.results[0].highlights[0].text.slice(1361, 1520),
  battery: capture.fields.results[0].highlights[0].text.slice(1522, 1756),
};
