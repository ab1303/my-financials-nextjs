'use client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  onImportComplete?: () => void;
}

export default function CSVImportWizard({ isOpen }: Props) {
  if (!isOpen) return null;
  return <div data-testid="csv-wizard-stub">CSV Import Wizard (stub)</div>;
}