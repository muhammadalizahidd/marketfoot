import type { Tone } from "@/components/admin/ui";

export const statusLabels: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Brouillon", tone: "off" },
  pending_validation: { label: "En attente de validation", tone: "warn" },
  active: { label: "En cours", tone: "ok" },
  finished: { label: "Terminée", tone: "off" },
};
