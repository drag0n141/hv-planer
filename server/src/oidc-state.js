import { randomBytes } from "node:crypto";

const STATE_TTL_MS = 10 * 60_000;
const CODE_TTL_MS = 60_000;
const MAX_ENTRIES = 5000; // Schutz gegen Speicherfüllung durch massenhafte /initiate-Aufrufe

/**
 * Speicher im RAM für laufende Anmeldungen (state → PKCE-Verifier, Nonce, Rücksprungziel)
 * und für einmalige Austausch-Codes (code → angemeldeter Nutzer).
 * Der Server läuft mit genau einer Instanz, ein gemeinsamer Speicher ist daher nicht nötig.
 */
export class OidcStateStore {
  #states = new Map();
  #codes = new Map();
  #timer;

  constructor() {
    this.#timer = setInterval(() => this.cleanup(), 5 * 60_000);
    this.#timer.unref();
  }

  #put(map, key, value, ttl) {
    if (map.size >= MAX_ENTRIES) map.delete(map.keys().next().value); // ältesten verdrängen
    map.set(key, { ...value, expiresAt: Date.now() + ttl });
  }

  storeState(state, data) {
    this.#put(this.#states, state, data, STATE_TTL_MS);
  }

  /** Liefert und löscht den State (einmalig verwendbar). */
  takeState(state) {
    const e = this.#states.get(state);
    this.#states.delete(state);
    return e && e.expiresAt > Date.now() ? e : null;
  }

  createExchangeCode(result) {
    const code = randomBytes(32).toString("hex");
    this.#put(this.#codes, code, { result }, CODE_TTL_MS);
    return code;
  }

  /** Liefert und löscht den Code (einmalig verwendbar). */
  consumeExchangeCode(code) {
    const e = this.#codes.get(code);
    this.#codes.delete(code);
    return e && e.expiresAt > Date.now() ? e.result : null;
  }

  cleanup() {
    const now = Date.now();
    for (const m of [this.#states, this.#codes]) for (const [k, v] of m) if (v.expiresAt <= now) m.delete(k);
  }

  close() {
    clearInterval(this.#timer);
  }
}
