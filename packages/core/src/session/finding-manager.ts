import { FindingId } from "../types/common.js";
import {
  Finding,
  FindingState,
  FindingSeverity,
  FindingEvent,
  CreateFindingParams,
  createFinding,
  transitionFinding,
} from "../types/finding.js";

export class FindingManager {
  private findings = new Map<FindingId, Finding>();

  create(params: CreateFindingParams): Finding {
    const finding = createFinding(params);
    this.findings.set(finding.id, finding);
    return finding;
  }

  transition(id: FindingId, event: FindingEvent): void {
    transitionFinding(this.get(id), event);
  }

  get(id: FindingId): Finding {
    const f = this.findings.get(id);
    if (!f) throw new Error(`Finding ${id} not found`);
    return f;
  }

  getAll(): Finding[] {
    return [...this.findings.values()];
  }

  getByState(state: FindingState): Finding[] {
    return this.getAll().filter((f) => f.state === state);
  }

  getBySeverity(severity: FindingSeverity): Finding[] {
    return this.getAll().filter((f) => f.severity === severity);
  }

  hasBlocking(): boolean {
    return this.getBlocking().length > 0;
  }

  getBlocking(): Finding[] {
    return this.getAll().filter(
      (f) =>
        f.state !== "REJECTED" &&
        f.state !== "VERIFIED" &&
        (f.severity === "blocker" || f.severity === "major"),
    );
  }

  getAcceptedUnfixed(): Finding[] {
    return this.getAll().filter((f) => f.state === "ACCEPTED");
  }
}
