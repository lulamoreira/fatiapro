import { describe, it, expect } from "vitest";
import { custoChamadaUSD } from "./ia";

describe("custoChamadaUSD", () => {
  it("aplica a fórmula com cache (Sonnet 2/10)", () => {
    // 1000×2 + 500×10 + 2000×0,20 + 400×2×1,25 = 2000+5000+400+1000 = 8400 → 0,0084
    expect(custoChamadaUSD({ input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000, cache_creation_input_tokens: 400 }, 2, 10)).toBeCloseTo(0.0084, 10);
  });
});
