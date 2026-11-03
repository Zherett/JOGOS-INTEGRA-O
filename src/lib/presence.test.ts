import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computePresenceStatus,
  formatPresenceTooltip,
  computePresenceSummary,
  PRESENCE_ONLINE_MAX_AGE_MS,
  PRESENCE_IDLE_MAX_AGE_MS,
  PRESENCE_DISCONNECT_MAX_AGE_MS,
} from "./presence.ts";

describe("Player Presence System (computePresenceStatus)", () => {
  const BASE_NOW = 1_000_000_000_000;

  it("returns offline for missing or invalid record", () => {
    assert.equal(computePresenceStatus(null, BASE_NOW), "offline");
    assert.equal(computePresenceStatus(undefined, BASE_NOW), "offline");
    assert.equal(computePresenceStatus({ lastSeenAt: 0 }, BASE_NOW), "offline");
  });

  it("returns offline if tab disconnected (lastSeenAt older than 2 minutes)", () => {
    // Interacted 1 minute ago, but heartbeat stopped 3 minutes ago
    const record = {
      lastSeenAt: BASE_NOW - (PRESENCE_DISCONNECT_MAX_AGE_MS + 1000),
      lastActiveAt: BASE_NOW - 60_000,
    };
    assert.equal(computePresenceStatus(record, BASE_NOW), "offline");
  });

  it("returns online (green) when user interacted within 5 minutes and heartbeat is alive", () => {
    // Interacted 2 minutes ago, heartbeat 10 seconds ago
    const record = {
      lastSeenAt: BASE_NOW - 10_000,
      lastActiveAt: BASE_NOW - 2 * 60 * 1000,
    };
    assert.equal(computePresenceStatus(record, BASE_NOW), "online");

    // Exactly at 5 minute threshold
    const boundaryRecord = {
      lastSeenAt: BASE_NOW - 5_000,
      lastActiveAt: BASE_NOW - PRESENCE_ONLINE_MAX_AGE_MS,
    };
    assert.equal(computePresenceStatus(boundaryRecord, BASE_NOW), "online");
  });

  it("returns idle (gray) when user is connected but has had no interaction between 5 and 10 minutes", () => {
    // Interacted 6 minutes ago, heartbeat 15 seconds ago
    const record = {
      lastSeenAt: BASE_NOW - 15_000,
      lastActiveAt: BASE_NOW - 6 * 60 * 1000,
    };
    assert.equal(computePresenceStatus(record, BASE_NOW), "idle");

    // Exactly at 10 minute threshold
    const boundaryRecord = {
      lastSeenAt: BASE_NOW - 5_000,
      lastActiveAt: BASE_NOW - PRESENCE_IDLE_MAX_AGE_MS,
    };
    assert.equal(computePresenceStatus(boundaryRecord, BASE_NOW), "idle");
  });

  it("returns offline (red) when user has not interacted for over 10 minutes even if heartbeat was pulsed", () => {
    // Interacted 10 minutes and 1 second ago
    const record = {
      lastSeenAt: BASE_NOW - 10_000,
      lastActiveAt: BASE_NOW - (PRESENCE_IDLE_MAX_AGE_MS + 1000),
    };
    assert.equal(computePresenceStatus(record, BASE_NOW), "offline");
  });

  it("formats human-readable tooltips correctly for each state", () => {
    const onlineTooltip = formatPresenceTooltip("online");
    assert.ok(onlineTooltip.includes("Online"));

    const idleTooltip = formatPresenceTooltip("idle", {
      lastActiveAt: BASE_NOW - 7 * 60 * 1000,
      lastSeenAt: BASE_NOW,
    }, BASE_NOW);
    assert.ok(idleTooltip.includes("Inativo"));
    assert.ok(idleTooltip.includes("7 min"));

    const offlineTooltip = formatPresenceTooltip("offline");
    assert.equal(offlineTooltip, "Offline");
  });
});
