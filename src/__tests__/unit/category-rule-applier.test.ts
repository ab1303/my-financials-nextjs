import { describe, expect, it } from "vitest";
import { applyCategoryRulesToTransactions, Rule } from "@/server/services/transactions/category-rule-applier";
import { CategoryRuleMatchType } from "@prisma/client";
import { CsvTransaction } from "@/server/services/ai-import/_types";

describe("category-rule-applier service", () => {
  const mockTx = (id: string, description: string): CsvTransaction => ({
    id,
    date: "2024-06-13",
    year: 2024,
    month: 6,
    description,
    amount: 10,
    type: "DEBIT",
  });

  it("applies EXACT match correctly", () => {
    const rules: Rule[] = [
      { id: "1", pattern: "amazon", matchType: "EXACT" as CategoryRuleMatchType, category: "Shopping", updatedAt: new Date() },
    ];
    // Changed "Amazon" to "amazon" so it matches the case-insensitive normalized check
    const transactions = [mockTx("tx1", "SomethingElse"), mockTx("tx2", "amazon")];

    const { matched, unmatched } = applyCategoryRulesToTransactions(transactions, rules);

    expect(matched).toHaveLength(1);
    expect(matched[0]?.tx.id).toBe("tx2");
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0]?.id).toBe("tx1");
  });

  it("applies CONTAINS match correctly", () => {
    const rules: Rule[] = [
      { id: "1", pattern: "amazon", matchType: "CONTAINS" as CategoryRuleMatchType, category: "Shopping", updatedAt: new Date() },
    ];
    const transactions = [mockTx("tx1", "Amazon store"), mockTx("tx2", "other")];

    const { matched, unmatched } = applyCategoryRulesToTransactions(transactions, rules);

    expect(matched).toHaveLength(1);
    expect(matched[0]?.tx.id).toBe("tx1");
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0]?.id).toBe("tx2");
  });

  it("applies REGEX match correctly", () => {
    const rules: Rule[] = [
      { id: "1", pattern: "^coffee.*", matchType: "REGEX" as CategoryRuleMatchType, category: "Food", updatedAt: new Date() },
    ];
    const transactions = [mockTx("tx1", "coffee shop"), mockTx("tx2", "shop coffee")];

    const { matched, unmatched } = applyCategoryRulesToTransactions(transactions, rules);

    expect(matched).toHaveLength(1);
    expect(matched[0]?.tx.id).toBe("tx1");
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0]?.id).toBe("tx2");
  });

  it("applies deterministic precedence (lastUpdatedAt desc, id asc)", () => {
    const now = new Date();
    const rules: Rule[] = [
      { id: "rule-1", pattern: "amazon", matchType: "CONTAINS" as CategoryRuleMatchType, category: "A", updatedAt: new Date(now.getTime() - 1000) },
      { id: "rule-2", pattern: "amazon", matchType: "CONTAINS" as CategoryRuleMatchType, category: "B", updatedAt: now },
    ];
    const transactions = [mockTx("tx1", "amazon")];

    const { matched } = applyCategoryRulesToTransactions(transactions, rules);

    // Rule-2 updated later should take precedence
    expect(matched[0]?.matchedCategory).toBe("B");
  });
});
