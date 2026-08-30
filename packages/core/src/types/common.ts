/**
 * Branded ID types prevent accidental mixing of different ID types.
 * SessionId, AgentId, EventId are all strings at runtime but distinct at type level.
 */

export type SessionId = string & { readonly __brand: "SessionId" };
export type AgentId = string & { readonly __brand: "AgentId" };
export type EventId = string & { readonly __brand: "EventId" };
export type FindingId = string & { readonly __brand: "FindingId" };
export type RoundNumber = number & { readonly __brand: "RoundNumber" };

export function sessionId(value: string): SessionId {
  if (!value) throw new Error("SessionId cannot be empty");
  return value as SessionId;
}

export function agentId(value: string): AgentId {
  if (!value) throw new Error("AgentId cannot be empty");
  return value as AgentId;
}

export function eventId(value: string): EventId {
  if (!value) throw new Error("EventId cannot be empty");
  return value as EventId;
}

export function findingId(value: string): FindingId {
  if (!value) throw new Error("FindingId cannot be empty");
  return value as FindingId;
}

export function roundNumber(value: number): RoundNumber {
  if (value < 0) throw new Error("RoundNumber cannot be negative");
  return value as RoundNumber;
}

export type Timestamp = string & { readonly __brand: "Timestamp" };

export function now(): Timestamp {
  return new Date().toISOString() as Timestamp;
}

export type DurationMs = number & { readonly __brand: "DurationMs" };

export function durationMs(ms: number): DurationMs {
  if (ms < 0) throw new Error("DurationMs cannot be negative");
  return ms as DurationMs;
}

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}
