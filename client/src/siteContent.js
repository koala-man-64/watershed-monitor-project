export const APP_TITLE = "NW Michigan Water Quality Database";

// Row-level `Provenance` values in NWMIWS_Site_Data.csv. Written by
// scripts/data/ingest_measured_samples.py; see data/source/README.md.
export const PROVENANCE = Object.freeze({
  MEASURED: "measured",
  SIMULATED: "simulated",
});

// The real series currently in the dataset. Keep this in step with whatever
// the ingest script marks `measured` — the banner below names it explicitly so
// visitors are never left to assume the rest is real too. Coverage varies by
// site, parameter and year (see data/source/README.md); this names what's
// real without implying every year or every parameter is covered uniformly —
// per-chart precision is handled separately by describeProvenance.
export const MEASURED_SERIES_SUMMARY =
  "Platte Lake (Big Platte) and the seven Leelanau Conservancy lakes " +
  "(Big & Little Glen, Cedar, Lime, Little Traverse, and North & South Lake " +
  "Leelanau) — total phosphorus, nitrate, chlorophyll-a, and Secchi depth " +
  "across most of their historical record";

// "simulated except X" already carries that X is real, so the trailing
// "which shows real measurements" was redundant and made the banner wrap.
export const DEMO_NOTICE =
  `Demonstration site — values are simulated except ${MEASURED_SERIES_SUMMARY}.`;

// TODO: Replace this placeholder before the site is presented as anything other
// than a demonstration. Fill in the confirmed public contact: a role or team
// name plus a monitored shared inbox. Do not publish an individual's personal
// phone number or personal email address.
export const SUPPORT_CONTACT = {
  organization: "NW Michigan Water Quality Database project team",
  status: "Contact details are not published yet for this demonstration site.",
};

export const CONTACT_DETAILS = [
  { label: "Contact", value: SUPPORT_CONTACT.organization },
  { label: "Status", value: SUPPORT_CONTACT.status },
];
