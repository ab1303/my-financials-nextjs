'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  pattern: z.string().min(1, 'Pattern required'),
  matchType: z.enum(['CONTAINS', 'STARTS_WITH', 'EXACT']),
  category: z.string().min(1),
  applyToPast: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface CategoryRuleDrawerProps {
  open: boolean;
  initialPattern: string;
  initialCategory: string;
  transactionDescription: string;
  onClose: () => void;
  onSaved: (ruleId: string) => void;
}

export default function CategoryRuleDrawer({
  open,
  initialPattern,
  initialCategory,
  transactionDescription,
  onClose,
  onSaved,
}: CategoryRuleDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const createMutation = trpc.categoryRule.create.useMutation();
  const applyPastMutation = trpc.categoryRule.applyToPast.useMutation();

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: `Auto: ${initialPattern}`,
      pattern: initialPattern,
      matchType: 'CONTAINS',
      category: initialCategory,
      applyToPast: true,
    },
  });

  const applyToPast = watch('applyToPast');

  // Reset form when drawer opens with new values
  useEffect(() => {
    if (open) {
      reset({
        name: `Auto: ${initialPattern}`,
        pattern: initialPattern,
        matchType: 'CONTAINS',
        category: initialCategory,
        applyToPast: true,
      });
    }
  }, [open, initialPattern, initialCategory, reset]);

  async function onSubmit(data: FormData) {
    try {
      // Create the rule
      const rule = await createMutation.mutateAsync({
        name: data.name,
        pattern: data.pattern,
        matchType: data.matchType,
        category: data.category,
      });

      // Apply to past transactions if checked
      if (data.applyToPast) {
        await applyPastMutation.mutateAsync({ ruleId: rule.id });
      }

      toast.success('Category rule saved');
      onSaved(rule.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save rule';
      toast.error(message);
    }
  }

  if (!mounted || !open) {
    return null;
  }

  const isLoading = isSubmitting || createMutation.isPending || applyPastMutation.isPending;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
        onClick={onClose}
        role="presentation"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Category Rule</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Context: &quot;{transactionDescription}&quot;
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Rule Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rule name
            </label>
            <input
              {...register('name')}
              type="text"
              id="name"
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-0 dark:focus:ring-amber-400"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>}
          </div>

          {/* Matches when description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Matches when description
            </label>
            <div className="flex gap-2">
              <select
                {...register('matchType')}
                disabled={isLoading}
                className="w-32 flex-shrink-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-0 dark:focus:ring-amber-400"
              >
                <option value="CONTAINS">contains</option>
                <option value="STARTS_WITH">starts with</option>
                <option value="EXACT">is exactly</option>
              </select>
              <input
                {...register('pattern')}
                type="text"
                disabled={isLoading}
                placeholder="e.g. paypal"
                className="min-w-0 flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-0 dark:focus:ring-amber-400"
              />
            </div>
            {errors.pattern && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.pattern.message}</p>
            )}
          </div>

          {/* Assign category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assign category
            </label>
            <input
              {...register('category')}
              type="text"
              id="category"
              disabled={true}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed opacity-75"
            />
          </div>

          {/* Apply to past transactions */}
          <div className="flex items-center gap-2 pt-2">
            <input
              {...register('applyToPast')}
              type="checkbox"
              id="applyToPast"
              disabled={isLoading}
              className="h-4 w-4 border border-gray-300 dark:border-gray-600 rounded accent-amber-500 dark:accent-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor="applyToPast" className="text-sm text-gray-700 dark:text-gray-300">
              Also apply to existing matching transactions
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 dark:bg-amber-500 rounded-md hover:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
