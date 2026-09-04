export const APP_TITLE = "NW Michigan Water Quality Database";

// Row-level `Provenance` values in NWMIWS_Site_Data.csv. Written by
// scripts/data/ingest_measured_samples.py; see data/source/README.md.
export const PROVENANCE = Object.freeze({
  MEASURED: "measured",
  SIMULATED: "simulated",
});

// Simplified deliberately: which sites/parameters are real is growing and
// changing as data comes in (see data/source/README.md and the per-row
// `Provenance` column), so a banner enumerating it needs updating every time
// that set changes. A plain "demonstration site" notice is accurate on its
// own and doesn't need to track that churn. Per-chart precision is still
// handled separately by describeProvenance.
export const DEMO_NOTICE = "Demonstration site.";

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
