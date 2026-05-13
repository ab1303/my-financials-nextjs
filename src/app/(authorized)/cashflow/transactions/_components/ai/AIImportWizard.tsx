'use client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  onImportComplete?: () => void;
}

export default function AIImportWizard({ isOpen }: Props) {
  if (!isOpen) return null;
  return <div data-testid="ai-wizard-stub">AI Import Wizard (stub)</div>;
}