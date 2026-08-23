import React from "react";
import { DEMO_NOTICE } from "./siteContent";

/**
 * Persistent, non-dismissible notice that the data on this site is simulated.
 *
 * Mounted outside the welcome/plots switch in App so it is unconditionally
 * present on every screen. role="note" rather than a live region: the content
 * is static and present at first paint, and live regions that already exist on
 * load are never announced.
 */
export default function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <span className="demo-banner-badge" aria-hidden="true">
        Demo
      </span>
      <span className="demo-banner-text">{DEMO_NOTICE}</span>
    </div>
  );
}
