import type { Category, Feature, Priority } from "../domain/contracts";

export const featureOptions: Record<
  Category,
  { value: Feature; label: string }[]
> = {
  headphones: [
    { value: "active-noise-cancelling", label: "Active noise cancelling" },
    { value: "wireless", label: "Wireless" },
    { value: "multipoint", label: "Connect to two devices" },
    { value: "long-battery-life", label: "Long battery life" },
    { value: "lightweight", label: "Lightweight" },
  ],
  laptops: [
    { value: "oled-display", label: "OLED display" },
    { value: "high-memory", label: "At least 32 GB memory" },
    { value: "long-battery", label: "Long battery life" },
    { value: "portable", label: "Portable" },
  ],
};

export const priorityOptions: Record<
  Category,
  { value: Priority; label: string }[]
> = {
  headphones: [
    { value: "comfort", label: "Comfort" },
    { value: "sound-quality", label: "Sound" },
    { value: "noise-cancelling", label: "Noise cancelling" },
    { value: "battery-life", label: "Battery" },
    { value: "value", label: "Value" },
  ],
  laptops: [
    { value: "performance", label: "Performance" },
    { value: "display-quality", label: "Display" },
    { value: "portability", label: "Portability" },
    { value: "battery-life", label: "Battery" },
    { value: "value", label: "Value" },
  ],
};
