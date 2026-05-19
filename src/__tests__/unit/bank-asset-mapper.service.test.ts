import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { dbClientMock } from '@/__tests__/mocks/db-client.mock';

import { mapBankAssetData } from '@/server/services/ai-import/bank-asset-mapper.service';

describe('mapBankAssetData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbClientMock.financialAccount.findMany.mockReset();
    dbClientMock.bankBalanceSnapshot.findFirst.mockReset();
    dbClientMock.bankBalanceSnapshot.create.mockReset();
    dbClientMock.bankBalanceRecord.upsert.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Scenario 1: No matching accounts → returns success:false with error', async () => {
    dbClientMock.financialAccount.findMany.mockResolvedValueOnce([] as never);
    const input = {
      entries: [{ accountName: 'Savings', balance: 100 }],
      confidence: 0.9,
      warnings: [],
    };
    const result = await mapBankAssetData(input as any, new Date('2024-01-01'), 'user-1');
    expect(result.success).toBe(false);
    expect(result.entriesCreated).toBe(0);
    expect(result.errors.some(e => e.toLowerCase().includes('could not match account'))).toBe(true);
  });

  it('Scenario 2: Exact match → creates snapshot and entry', async () => {
    dbClientMock.financialAccount.findMany.mockResolvedValueOnce([
      {
        id: 'acc-1',
        name: 'Savings',
        institutionId: 'bank-1',
        institution: { id: 'bank-1', name: 'CommBank' },
      },
    ] as never);
    dbClientMock.bankBalanceSnapshot.findFirst.mockResolvedValueOnce(null as never);
    dbClientMock.bankBalanceSnapshot.create.mockResolvedValueOnce({ id: 'snap-1' } as never);
    dbClientMock.bankBalanceRecord.upsert.mockResolvedValue({} as never);
    const input = {
      entries: [{ accountName: 'Savings', balance: 500 }],
      confidence: 0.95,
      warnings: [],
    };
    const result = await mapBankAssetData(input as any, new Date('2024-01-01'), 'user-1');
    expect(result.success).toBe(true);
    expect(result.entriesCreated).toBe(1);
    expect(result.snapshotId).toBe('snap-1');
  });

  it('Scenario 3: bankName scoping — scopes to correct institution', async () => {
    dbClientMock.financialAccount.findMany.mockResolvedValueOnce([
      {
        id: 'acc-1',
        name: 'Savings',
        institutionId: 'bank-1',
        institution: { id: 'bank-1', name: 'CommBank' },
      },
      {
        id: 'acc-2',
        name: 'Savings',
        institutionId: 'bank-2',
        institution: { id: 'bank-2', name: 'ANZ' },
      },
    ] as never);
    dbClientMock.bankBalanceSnapshot.findFirst.mockResolvedValueOnce(null as never);
    dbClientMock.bankBalanceSnapshot.create.mockResolvedValueOnce({ id: 'snap-2' } as never);
    dbClientMock.bankBalanceRecord.upsert.mockResolvedValue({} as never);
    const input = {
      bankName: 'CommBank',
      entries: [{ accountName: 'Savings', balance: 200 }],
      confidence: 0.9,
      warnings: [],
    };
    const result = await mapBankAssetData(input as any, new Date('2024-01-02'), 'user-2');
    expect(result.success).toBe(true);
    expect(result.entriesCreated).toBe(1);
    expect(result.snapshotId).toBe('snap-2');
    expect(result.warnings.some(w => w.toLowerCase().includes('matched entries to bank'))).toBe(true);
  });

  it('Scenario 4: Zero/negative balance → skipped with warning', async () => {
    dbClientMock.financialAccount.findMany.mockResolvedValueOnce([
      {
        id: 'acc-1',
        name: 'Savings',
        institutionId: 'bank-1',
        institution: { id: 'bank-1', name: 'CommBank' },
      },
    ] as never);
    dbClientMock.bankBalanceSnapshot.findFirst.mockResolvedValueOnce(null as never);
    const input = {
      entries: [{ accountName: 'Savings', balance: 0 }],
      confidence: 0.8,
      warnings: [],
    };
    const result = await mapBankAssetData(input as any, new Date('2024-01-03'), 'user-3');
    expect(result.success).toBe(false);
    expect(result.entriesCreated).toBe(0);
    expect(result.warnings.some(w => w.toLowerCase().includes('balance must be positive'))).toBe(true);
  });

  it('Scenario 5: Existing snapshot for same date → upserts into it', async () => {
    dbClientMock.financialAccount.findMany.mockResolvedValueOnce([
      {
        id: 'acc-1',
        name: 'Savings',
        institutionId: 'bank-1',
        institution: { id: 'bank-1', name: 'CommBank' },
      },
    ] as never);
    dbClientMock.bankBalanceSnapshot.findFirst.mockResolvedValueOnce({ id: 'existing-snap' } as never);
    dbClientMock.bankBalanceRecord.upsert.mockResolvedValue({} as never);
    const input = {
      entries: [{ accountName: 'Savings', balance: 100 }],
      confidence: 0.9,
      warnings: [],
    };
    const result = await mapBankAssetData(input as any, new Date('2024-01-04'), 'user-4');
    expect(result.snapshotId).toBe('existing-snap');
    expect(result.warnings.some(w => w.toLowerCase().includes('snapshot already exists'))).toBe(true);
    expect(dbClientMock.bankBalanceSnapshot.create).not.toHaveBeenCalled();
  });

  it('Scenario 6: Duplicate match in batch → skips second, warns', async () => {
    dbClientMock.financialAccount.findMany.mockResolvedValueOnce([
      {
        id: 'acc-1',
        name: 'Savings',
        institutionId: 'bank-1',
        institution: { id: 'bank-1', name: 'CommBank' },
      },
    ] as never);
    dbClientMock.bankBalanceSnapshot.findFirst.mockResolvedValueOnce(null as never);
    dbClientMock.bankBalanceSnapshot.create.mockResolvedValueOnce({ id: 'snap-3' } as never);
    dbClientMock.bankBalanceRecord.upsert.mockResolvedValue({} as never);
    const input = {
      entries: [
        { accountName: 'Savings', balance: 100 },
        { accountName: 'Savings', balance: 200 },
      ],
      confidence: 0.9,
      warnings: [],
    };
    const result = await mapBankAssetData(input as any, new Date('2024-01-05'), 'user-5');
    expect(result.entriesCreated).toBe(1);
    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.toLowerCase().includes('duplicate'))).toBe(true);
  });
});
