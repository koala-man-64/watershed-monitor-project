export const APP_TITLE = "NW Michigan Water Quality Database";

// Row-level `Provenance` values in NWMIWS_Site_Data.csv. Written by
// scripts/data/ingest_platte_tp.py; see data/source/README.md.
export const PROVENANCE = Object.freeze({
  MEASURED: "measured",
  SIMULATED: "simulated",
});

// The one real series currently in the dataset. Keep this in step with whatever
// the ingest script marks `measured` — the banner below names it explicitly so
// visitors are never left to assume the rest is real too.
export const MEASURED_SERIES_SUMMARY =
  "Platte Lake (Big Platte) total phosphorus for 2020-2025";

export const DEMO_NOTICE =
  `Demonstration site — values are simulated except ${MEASURED_SERIES_SUMMARY}, ` +
  "which shows real measurements.";

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
