export * from "../shared/types";

import type { Pillar } from "../shared/types";

/** Sidebar colour per pillar. Presentation only. */
export const PILLAR_COLORS: Record<Pillar, string> = {
  "Social proof and client results": "#00CAEA",
  "Educational content about digital marketing": "#009AB8",
  "Pain points of business owners": "#E07A5F",
  "What makes WebScaleLabs different": "#8D6CD9",
  "Services and what they actually do for a business": "#3E9A6A",
};

export const PILLAR_SHORT: Record<Pillar, string> = {
  "Social proof and client results": "Social proof",
  "Educational content about digital marketing": "Educational",
  "Pain points of business owners": "Pain points",
  "What makes WebScaleLabs different": "Why us",
  "Services and what they actually do for a business": "Services",
};
