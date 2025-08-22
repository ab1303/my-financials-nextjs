import { useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { toast } from 'react-toastify';
import { produce } from 'immer';

import { trpc } from '@/server/trpc/client';
import { TRPCError } from '@trpc/server';

import type { OptionType } from '@/types';
import type { BeneficiaryEnumType } from '@prisma/client';

type BeneficiarySelectionCellProps = {
  defaultOptions: Array<OptionType>;
  beneficiaryType: BeneficiaryEnumType;
  beneficiaryId: string;
  onSelectionChange: (beneficiaryId?: string) => void;
};

export default function BeneficiarySelectionCell({
  defaultOptions,
  beneficiaryId,
  onSelectionChange,
}: BeneficiarySelectionCellProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<OptionType[]>(defaultOptions);
  // const [value, setValue] = useState<OptionType | null>();

  const selectedOptionValue = options.find((o) => o.id == beneficiaryId);

  const addIndividualBeneficiaryMutation =
    trpc.individual.addIndividualBeneficiary.useMutation({
      onError(error: unknown, {}) {
        if (error instanceof TRPCError) {
          toast.error(error.message);
        }
      },

      onSuccess({ beneficiaryId }, { name }) {
        const newOption: OptionType = { id: beneficiaryId, label: name };
        setOptions(
          produce((draft) => {
            draft.push({
              id: beneficiaryId,
              label: name,
            });
          })
        );
        setIsLoading(false);
        onSelectionChange(newOption.id);
        toast.success('Created invidiual beneficiary!');
      },
    });

  const handleCreate = (inputValue: string) => {
    setIsLoading(true);
    addIndividualBeneficiaryMutation.mutate({ name: inputValue });
  };

  return (
    <CreatableSelect
      isClearable
      isDisabled={isLoading}
      isLoading={isLoading}
      onChange={(newValue) => onSelectionChange(newValue?.id)}
      onCreateOption={handleCreate}
      options={options}
      value={selectedOptionValue}
    />
  );
}
