import { ArenaState, ArenaEvent, TRANSITION_TABLE, TERMINAL_STATES } from "./types/state-machine.js";
import { ArenaError, ErrorCode } from "./errors/arena-error.js";

interface TransitionRecord {
  from: ArenaState;
  to: ArenaState;
  event: ArenaEvent;
  timestamp: string;
}

export class ArenaStateMachine {
  private _state: ArenaState;
  private _history: TransitionRecord[] = [];
  private _previousState: ArenaState | null = null;

  constructor(initialState: ArenaState) { this._state = initialState; }

  get state(): ArenaState { return this._state; }
  get history(): readonly TransitionRecord[] { return this._history; }
  get isTerminal(): boolean { return (TERMINAL_STATES as readonly ArenaState[]).includes(this._state); }
  get previousState(): ArenaState | null { return this._previousState; }

  transition(event: ArenaEvent): void {
    const transitions = TRANSITION_TABLE[this._state];
    const target = transitions?.[event];
    if (!target) {
      throw new ArenaError(ErrorCode.PROTOCOL_TRANSITION_INVALID,
        "Cannot transition from " + this._state + " on event " + JSON.stringify(event),
        { currentState: this._state, event, allowedEvents: Object.keys(transitions ?? {}) });
    }
    this._previousState = this._state;
    this._state = target;
    this._history.push({ from: this._previousState, to: this._state, event, timestamp: new Date().toISOString() });
  }

  forceState(state: ArenaState): void {
    this._previousState = this._state;
    this._state = state;
    this._history.push({ from: this._previousState, to: this._state, event: "recover" as ArenaEvent, timestamp: new Date().toISOString() });
  }
}
