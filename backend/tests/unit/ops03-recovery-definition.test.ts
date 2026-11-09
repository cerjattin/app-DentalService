import { describe, expect, it } from "vitest";
import { canonicalRecoveryDefinition } from "../../src/infrastructure/database/qa-recovery.js";

describe("Recovery schema definition comparison", () => {
  it("recognizes PostgreSQL's equivalent literal array coercions after dump/restore", () => {
    const source =
      "CHECK (state::text = ANY (ARRAY['PREPARED'::character varying, 'UNCERTAIN'::character varying]::text[]))";
    const restored =
      "CHECK (state::text = ANY (ARRAY['PREPARED'::character varying::text, 'UNCERTAIN'::character varying::text]))";
    expect(canonicalRecoveryDefinition(source)).toBe(
      canonicalRecoveryDefinition(restored),
    );
    const sourceIndex =
      "CREATE UNIQUE INDEX example ON public.t USING btree (batch_id) WHERE ((state)::text = ANY ((ARRAY['PREPARED'::character varying, 'UNCERTAIN'::character varying])::text[]))";
    const restoredIndex =
      "CREATE UNIQUE INDEX example ON public.t USING btree (batch_id) WHERE ((state)::text = ANY (ARRAY[('PREPARED'::character varying)::text, ('UNCERTAIN'::character varying)::text]))";
    expect(canonicalRecoveryDefinition(sourceIndex)).toBe(
      canonicalRecoveryDefinition(restoredIndex),
    );
  });
  it("preserves differences in values, ordering, predicates and bounded varchar casts", () => {
    const scalar = "CHECK (lower('A'::character varying) = 'a'::text)";
    expect(canonicalRecoveryDefinition(scalar)).toBe(scalar);
    const before = "CHECK (state = ANY (ARRAY['A'::text, 'B'::text]))";
    for (const other of [
      "CHECK (state = ANY (ARRAY['A'::text, 'C'::text]))",
      "CHECK (state = ANY (ARRAY['B'::text, 'A'::text]))",
      "CHECK (other = ANY (ARRAY['A'::text, 'B'::text]))",
      "CHECK (state = ANY (ARRAY['A'::character varying(1), 'B'::text]))",
    ])
      expect(canonicalRecoveryDefinition(before)).not.toBe(
        canonicalRecoveryDefinition(other),
      );
  });
});
