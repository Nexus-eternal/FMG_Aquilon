import { RealmData } from "@/components/realm-data";
import { tip } from "@/components/tooltips";
import type { Zone } from "@/generators/zones-generator";
import { validateZoneRules, ZONE_ENVIRONMENTS, type ZoneEnvironment, type ZoneRules } from "@/types/zone-rules";
import { ensureEl } from "@/utils";

export function editZoneRules(zone: Zone, changed: () => void): void {
  const root = ensureEl("zonesRules");
  root.hidden = false;
  root.replaceChildren();
  const title = document.createElement("h4");
  title.textContent = `Hazard rules · ${zone.name}`;
  root.append(title);
  const form = document.createElement("form");
  form.innerHTML = `<label><input class="native" id="zoneRulesEnabled" type="checkbox" /> Route warnings enabled</label>
    <fieldset><legend>Applies to</legend>${Object.entries(ZONE_ENVIRONMENTS)
      .map(
        ([id, name]) =>
          `<label style="margin-right:1em"><input class="native" type="checkbox" data-environment="${id}" /> ${name}</label>`
      )
      .join("")}</fieldset>
    <section style="display:grid;grid-template-columns:10em 17em;gap:.4em;align-items:center">
      <label for="zoneRulesSeverity">Severity:</label><select id="zoneRulesSeverity"><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option></select>
      <label for="zoneRulesRestricted">Restricted passage:</label><input class="native" id="zoneRulesRestricted" type="checkbox" />
      <label for="zoneRulesRequirements">Required equipment:</label><input id="zoneRulesRequirements" placeholder="Separate items with semicolons" />
      <label for="zoneRulesMovement">Movement multiplier:</label><input id="zoneRulesMovement" type="number" min="0.01" max="10" step="0.01" />
      ${["altitude", "depth"].map(prefix => `<label for="zoneRules${prefix}Min">${prefix === "altitude" ? "Air height" : "Water depth"} min / max (m):</label><div><input id="zoneRules${prefix}Min" aria-label="${prefix} minimum" type="number" min="0" style="width:7em" placeholder="Any" /> – <input id="zoneRules${prefix}Max" aria-label="${prefix} maximum" type="number" min="0" style="width:7em" placeholder="Any" /></div>`).join("")}
    </section>
    <p style="max-width:38em">Warnings only: routes remain editable. Hidden zones still warn. A shared footprint is painted on the world's base grid; no portals or automatic damage simulation.</p>
    <button type="submit" id="zoneRulesApply">Apply rules</button> <button type="button" id="zoneRulesClose">Close properties</button>`;
  root.append(form);
  const rules: ZoneRules = zone.rules ?? {
    enabled: true,
    environments: [zone.depth !== undefined ? "underwater" : RealmData.active === "sky" ? "sky" : "surface"],
    severity: "moderate",
    restricted: false,
    requirements: [],
    movement: 1
  };
  const input = (id: string) => ensureEl<HTMLInputElement>(`zoneRules${id}`);
  input("Enabled").checked = rules.enabled !== false;
  input("Restricted").checked = rules.restricted;
  input("Requirements").value = rules.requirements.join("; ");
  input("Movement").value = String(rules.movement);
  ensureEl<HTMLSelectElement>("zoneRulesSeverity").value = rules.severity;
  for (const checkbox of form.querySelectorAll<HTMLInputElement>("[data-environment]"))
    checkbox.checked = rules.environments.includes(checkbox.dataset.environment as ZoneEnvironment);
  for (const prefix of ["altitude", "depth"] as const)
    for (const bound of ["Min", "Max"] as const)
      input(`${prefix}${bound}`).value = String(rules[`${prefix}${bound}`] ?? "");
  ensureEl("zoneRulesClose").addEventListener("click", () => {
    root.hidden = true;
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const next: ZoneRules = {
      enabled: input("Enabled").checked,
      environments: [...form.querySelectorAll<HTMLInputElement>("[data-environment]:checked")].map(
        el => el.dataset.environment as ZoneEnvironment
      ),
      severity: ensureEl<HTMLSelectElement>("zoneRulesSeverity").value as ZoneRules["severity"],
      restricted: input("Restricted").checked,
      requirements: [
        ...new Set(
          input("Requirements")
            .value.split(";")
            .map(value => value.trim())
            .filter(Boolean)
        )
      ],
      movement: input("Movement").valueAsNumber
    };
    for (const prefix of ["altitude", "depth"] as const)
      for (const bound of ["Min", "Max"] as const) {
        const el = input(`${prefix}${bound}`);
        if (el.value !== "") next[`${prefix}${bound}`] = el.valueAsNumber;
      }
    try {
      validateZoneRules(next);
      RealmData.promoteZone(zone, pack);
      zone.rules = next;
      changed();
      tip("Zone rules applied. Routes are not blocked.");
    } catch (error) {
      tip((error as Error).message, false, "error");
    }
  });
}
