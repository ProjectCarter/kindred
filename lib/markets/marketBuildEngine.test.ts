import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyWorkerExit,
  isRetriableWorkerExit,
  shouldReconcileBootstrap,
} from "./marketBuildEngine.ts";

describe("marketBuildEngine", () => {
  it("classifies worker resource limit", () => {
    assert.equal(
      classifyWorkerExit(546, { code: "WORKER_RESOURCE_LIMIT" }),
      "http_546"
    );
    assert.equal(
      classifyWorkerExit(200, { code: "WORKER_RESOURCE_LIMIT" }),
      "resource_limit"
    );
  });

  it("marks timeout exits retriable", () => {
    assert.equal(isRetriableWorkerExit("gateway_timeout"), true);
    assert.equal(isRetriableWorkerExit("success"), false);
  });

  it("reconciles bootstrap only when thresholds met", () => {
    assert.equal(
      shouldReconcileBootstrap({
        catalog: "events",
        rowCount: 4,
        bootstrapComplete: false,
        phaseCheckpointComplete: true,
        allCategoryCheckpointsComplete: false,
      }),
      false
    );
    assert.equal(
      shouldReconcileBootstrap({
        catalog: "events",
        rowCount: 85,
        bootstrapComplete: false,
        phaseCheckpointComplete: true,
        allCategoryCheckpointsComplete: false,
      }),
      true
    );
    assert.equal(
      shouldReconcileBootstrap({
        catalog: "activities",
        rowCount: 915,
        bootstrapComplete: false,
        phaseCheckpointComplete: false,
        allCategoryCheckpointsComplete: true,
      }),
      true
    );
  });
});
