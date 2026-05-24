import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRule,
  deleteRule,
  listRules,
  toggleRule,
  findSimilarTransactions,
  runCategoryRules,
  applyRuleToPast,
} from "@/server/services/transactions/category-rule.service";

const mockRuleCreate = vi.fn();
const mockRuleFindMany = vi.fn();
const mockRuleFindUnique = vi.fn();
const mockRuleUpdate = vi.fn();
const mockRuleDelete = vi.fn();
const mockRuleUpdateMany = vi.fn();

const mockTransactionFindMany = vi.fn();
const mockTransactionCount = vi.fn();
const mockTransactionUpdateMany = vi.fn();

const mockPrisma = {
  categoryRule: {
    create: mockRuleCreate,
    findMany: mockRuleFindMany,
    findUnique: mockRuleFindUnique,
    update: mockRuleUpdate,
    delete: mockRuleDelete,
    updateMany: mockRuleUpdateMany,
  },
  transaction: {
    findMany: mockTransactionFindMany,
    count: mockTransactionCount,
    updateMany: mockTransactionUpdateMany,
  },
} as any;

describe("category-rule service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRule", () => {
    it("persists rule and returns mapped item", async () => {
      mockRuleCreate.mockResolvedValue({
        id: "rule-1",
        userId: "user-1",
        name: "Test Rule",
        pattern: "test",
        matchType: "CONTAINS",
        category: "Shopping",
        isActive: true,
        appliedCount: 0,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      });

      const result = await createRule({
        prisma: mockPrisma,
        userId: "user-1",
        name: "Test Rule",
        pattern: "test",
        matchType: "CONTAINS",
        category: "Shopping",
      });

      expect(mockRuleCreate).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: "rule-1",
        name: "Test Rule",
        pattern: "test",
        matchType: "CONTAINS",
        category: "Shopping",
        isActive: true,
        appliedCount: 0,
      });
      expect(result.createdAt).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  describe("listRules", () => {
    it("returns all rules for user ordered by createdAt desc", async () => {
      mockRuleFindMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "Rule 1",
          pattern: "test",
          matchType: "CONTAINS",
          category: "Shopping",
          isActive: true,
          appliedCount: 5,
          createdAt: new Date("2024-01-02"),
        },
        {
          id: "rule-2",
          name: "Rule 2",
          pattern: "amazon",
          matchType: "STARTS_WITH",
          category: "Online",
          isActive: false,
          appliedCount: 0,
          createdAt: new Date("2024-01-01"),
        },
      ]);

      const result = await listRules({
        prisma: mockPrisma,
        userId: "user-1",
      });

      expect(mockRuleFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe("Rule 1");
      expect(result[1]?.name).toBe("Rule 2");
    });
  });

  describe("toggleRule", () => {
    it("updates isActive status", async () => {
      mockRuleFindUnique.mockResolvedValue({
        id: "rule-1",
        userId: "user-1",
      });

      await toggleRule({
        prisma: mockPrisma,
        userId: "user-1",
        ruleId: "rule-1",
        isActive: false,
      });

      expect(mockRuleUpdate).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        data: { isActive: false },
      });
    });

    it("throws error if rule not owned by user", async () => {
      mockRuleFindUnique.mockResolvedValue({
        id: "rule-1",
        userId: "other-user",
      });

      await expect(
        toggleRule({
          prisma: mockPrisma,
          userId: "user-1",
          ruleId: "rule-1",
          isActive: false,
        }),
      ).rejects.toThrow("Rule not found");
    });
  });

  describe("deleteRule", () => {
    it("throws error if rule not owned by user", async () => {
      mockRuleFindUnique.mockResolvedValue({
        id: "rule-1",
        userId: "other-user",
      });

      await expect(
        deleteRule({
          prisma: mockPrisma,
          userId: "user-1",
          ruleId: "rule-1",
        }),
      ).rejects.toThrow("Rule not found or not authorized");

      expect(mockRuleDelete).not.toHaveBeenCalled();
    });
  });

  describe("findSimilarTransactions", () => {
    it("returns correct count for CONTAINS pattern", async () => {
      mockTransactionCount.mockResolvedValue(3);

      const result = await findSimilarTransactions({
        prisma: mockPrisma,
        userId: "user-1",
        description: "Amazon store purchase today",
      });

      expect(result).toBe(3);
      expect(mockTransactionCount).toHaveBeenCalled();
      // Verify the call was made with pattern matching
      const callArgs = mockTransactionCount.mock.calls[0][0];
      expect(callArgs.where.userId).toBe("user-1");
      expect(callArgs.where.description).toBeDefined();
    });

    it("excludes transaction if provided", async () => {
      mockTransactionCount.mockResolvedValue(2);

      const result = await findSimilarTransactions({
        prisma: mockPrisma,
        userId: "user-1",
        description: "test description",
        excludeTransactionId: "tx-exclude",
      });

      const callArgs = mockTransactionCount.mock.calls[0][0];
      expect(callArgs.where.id.not).toBe("tx-exclude");
    });
  });

  describe("runCategoryRules", () => {
    it("applies matching rules to import transactions", async () => {
      mockRuleFindMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "Test Rule",
          pattern: "amazon",
          matchType: "CONTAINS",
          category: "Shopping",
          isActive: true,
          appliedCount: 0,
        },
      ]);

      mockTransactionFindMany.mockResolvedValue([
        {
          id: "tx-1",
          description: "Amazon store purchase",
          category: "Uncategorized",
          source: "LLM_CLASSIFIED",
          status: "PENDING",
        },
        {
          id: "tx-2",
          description: "Bank transfer",
          category: "Transfer",
          source: "LLM_CLASSIFIED",
          status: "PENDING",
        },
      ]);

      const result = await runCategoryRules({
        prisma: mockPrisma,
        userId: "user-1",
        importSessionId: "session-1",
      });

      expect(result.rulesRan).toBe(1);
      expect(result.appliedCount).toBe(1);
      expect(mockTransactionUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ["tx-1"] } },
        data: {
          category: "Shopping",
          source: "USER_OVERRIDE",
        },
      });
    });

    it("skips non-LLM_CLASSIFIED transactions", async () => {
      mockRuleFindMany.mockResolvedValue([
        {
          id: "rule-1",
          pattern: "test",
          matchType: "CONTAINS",
          category: "Shopping",
        },
      ]);

      mockTransactionFindMany.mockResolvedValue([]);

      const result = await runCategoryRules({
        prisma: mockPrisma,
        userId: "user-1",
        importSessionId: "session-1",
      });

      expect(mockTransactionFindMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          importSessionId: "session-1",
          source: "LLM_CLASSIFIED",
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });
      expect(result.appliedCount).toBe(0);
    });
  });

  describe("applyRuleToPast", () => {
    it("throws if rule not owned by user", async () => {
      mockRuleFindUnique.mockResolvedValue({
        id: "rule-1",
        userId: "other-user",
      });

      await expect(
        applyRuleToPast({
          prisma: mockPrisma,
          userId: "user-1",
          ruleId: "rule-1",
        }),
      ).rejects.toThrow("Rule not found or not authorized");
    });
  });
});
