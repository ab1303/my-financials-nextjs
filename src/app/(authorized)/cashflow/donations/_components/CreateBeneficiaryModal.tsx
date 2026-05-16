'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BeneficiaryEnumType } from '@prisma/client';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';

const createBeneficiarySchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type CreateBeneficiaryValues = z.infer<typeof createBeneficiarySchema>;

interface CreateBeneficiaryModalProps {
  isOpen: boolean;
  beneficiaryType: BeneficiaryEnumType;
  initialName?: string;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
}

export default function CreateBeneficiaryModal({
  isOpen,
  beneficiaryType,
  initialName = '',
  onClose,
  onCreated,
}: CreateBeneficiaryModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const utils = trpc.useUtils();

  const createIndividual = trpc.individual.create.useMutation({
    onSuccess: (data) => {
      void utils.individual.getAllIndividuals.invalidate();
      onCreated(data.id, data.name);
      toast.success(`Individual "${data.name}" created`);
    },
    onError: (err) => {
      toast.error(err.message ?? 'Failed to create individual');
    },
  });

  const createBusiness = trpc.business.create.useMutation({
    onSuccess: (data) => {
      void utils.business.getBusinessesByType.invalidate();
      onCreated(data.id, data.name);
      toast.success(`Business "${data.name}" created`);
    },
    onError: (err) => {
      toast.error(err.message ?? 'Failed to create business');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBeneficiaryValues>({
    resolver: zodResolver(createBeneficiarySchema),
    defaultValues: { name: initialName },
  });

  // Sync initial name when it changes (e.g. user typed in Creatable and triggered modal)
  useEffect(() => {
    if (isOpen) {
      reset({ name: initialName });
    }
  }, [isOpen, initialName, reset]);

  const isPending = createIndividual.isPending || createBusiness.isPending;
  const typeLabel = beneficiaryType === BeneficiaryEnumType.INDIVIDUAL ? 'Individual' : 'Business';

  const onSubmit = (values: CreateBeneficiaryValues) => {
    if (beneficiaryType === BeneficiaryEnumType.INDIVIDUAL) {
      createIndividual.mutate({ name: values.name });
    } else {
      createBusiness.mutate({ name: values.name });
    }
  };

  const handleClose = () => {
    reset({ name: '' });
    onClose();
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Create ${typeLabel}`}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
          Add {typeLabel}
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Quick-add a new {typeLabel.toLowerCase()} beneficiary. You can update
          their full details later in the Relationships page.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              htmlFor="beneficiary-name"
              className="block cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Name
            </label>
            <input
              id="beneficiary-name"
              {...register('name')}
              autoFocus
              disabled={isPending}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-600"
              placeholder={
                beneficiaryType === BeneficiaryEnumType.INDIVIDUAL
                  ? 'e.g. Jane Smith'
                  : 'e.g. Red Cross Australia'
              }
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
