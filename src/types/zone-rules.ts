export const ZONE_ENVIRONMENTS = { surface: "Surface", sky: "Sky / Air", underwater: "Underwater" } as const;
export type ZoneEnvironment = keyof typeof ZONE_ENVIRONMENTS;
export interface ZoneRules {
  enabled?: boolean;
  environments: ZoneEnvironment[];
  severity: "low" | "moderate" | "high" | "critical";
  restricted: boolean;
  requirements: string[];
  movement: number;
  altitudeMin?: number;
  altitudeMax?: number;
  depthMin?: number;
  depthMax?: number;
}

export function validateZoneRules(rules: ZoneRules): void {
  if (!rules.environments.length || rules.environments.some(env => !(env in ZONE_ENVIRONMENTS)))
    throw new Error("Select at least one environment.");
  if (!["low", "moderate", "high", "critical"].includes(rules.severity)) throw new Error("Invalid severity.");
  if (!Number.isFinite(rules.movement) || rules.movement <= 0 || rules.movement > 10)
    throw new Error("Movement multiplier must be greater than 0 and at most 10.");
  for (const prefix of ["altitude", "depth"] as const) {
    const min = rules[`${prefix}Min`];
    const max = rules[`${prefix}Max`];
    if ([min, max].some(value => value !== undefined && (!Number.isFinite(value) || value < 0)))
      throw new Error("Height / depth bounds must be non-negative numbers or blank.");
    if (min !== undefined && max !== undefined && min > max) throw new Error("Minimum cannot exceed maximum.");
  }
}
