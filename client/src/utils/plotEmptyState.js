export function getNoDataMessage(cfg) {
  const hasSelectedSites = Array.isArray(cfg?.selectedSites) && cfg.selectedSites.length > 0;
  const hasParameter = Boolean(cfg?.parameter && String(cfg.parameter).trim());

  if (!hasSelectedSites) {
    return "Select one or more sites on map";
  }

  if (!hasParameter) {
    return "Select Parameter";
  }

  return "No Data Available for Site, Year, and Parameter Selections";
}

/**
 * Message for a plot slot that has never been configured. This is a distinct
 * state from "configured but no matching rows": the user's map and filter
 * selections may be perfectly valid, they simply have not pressed the matching
 * Update button yet. Reporting "select sites" here is wrong and misleading.
 */
export function getUnconfiguredPlotMessage(slotLabel) {
  return slotLabel
    ? `No plot configured yet. Choose your filters, then press Update ${slotLabel}.`
    : "No plot configured yet. Choose your filters, then press an Update Plot button.";
}
