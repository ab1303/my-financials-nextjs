'use client';

import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import { CreatableAppSelect } from '@/components/ui/CreatableAppSelect';
import { CGTEligibilityWarning } from '@/components/ui/CGTEligibilityWarning';

type SelectOption = { value: string; label: string };
import { NumericFormat } from 'react-number-format';

import { Modal } from '@/components/ui/Modal';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components';
import { trpc } from '@/server/trpc/client';
import { createStockSnapshotSchema } from '@/server/schema/stock-asset.schema';

import type { CreateStockSnapshotInput } from '@/server/schema/stock-asset.schema';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  brokerageAccounts: Array<{
    id: string;
    name: string;
  }>;
}

type FormData = CreateStockSnapshotInput;

const CURRENCY_OPTIONS = [
  { value: 'AUD', label: 'AUD' },
  { value: 'USD', label: 'USD' },
];

const TERM_OPTIONS = [
  { value: 'SHORT_TERM', label: 'Short Term (< 12 months)' },
  { value: 'MID_TERM', label: 'Mid Term (12-36 months)' },
  { value: 'LONG_TERM', label: 'Long Term (> 36 months)' },
];

export default function NewSnapshotModal({
  isOpen,
  onClose,
  onSuccess,
  brokerageAccounts,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAccounts, setCreatedAccounts] = useState<Array<{ id: string; name: string }>>([]);
  // Track buy date mode per holding index: 'month' (quick-pick) or 'exact' (full date)
  const [buyDateModes, setBuyDateModes] = useState<Record<number, 'exact' | 'month'>>({});
  const utils = trpc.useUtils();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(createStockSnapshotSchema),
    defaultValues: {
      snapshotDate: new Date(),
      holdings: [
        {
          ticker: '',
          companyName: '',
          quantity: 0,
          buyPrice: 0,
          buyDate: new Date(),
          currentPrice: 0,
          currency: 'AUD',
          plannedTerm: 'MID_TERM',
          accountId: brokerageAccounts?.[0]?.id || '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'holdings',
  });

  const { data: latestSnapshot, isLoading: isLoadingPrefill } =
    trpc.stockAsset.getMostRecentSnapshot.useQuery(
      {},
      { enabled: isOpen },
    );

  const createBrokerageAccount = trpc.business.create.useMutation({
    onSuccess: (data, variables) => {
      const newAccount = { id: data.id, name: data.name };
      setCreatedAccounts((prev) => [...prev, newAccount]);
      void utils.business.getBusinessesByType.invalidate({ type: 'BROKERAGE' });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create brokerage account');
    },
  });

  const handleCreateBrokerageAccount = async (inputValue: string, onChange: (value: string) => void) => {
    const result = await createBrokerageAccount.mutateAsync({ name: inputValue, type: 'BROKERAGE' });
    onChange(result.id);
  };

  const createSnapshot = trpc.stockAsset.createSnapshot.useMutation({
    onSuccess: () => {
      toast.success('Snapshot created successfully!');
      utils.stockAsset.getSnapshots.invalidate();
      reset();
      setCreatedAccounts([]);
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create snapshot');
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Process holdings to convert month input to dates when in month mode
      const processedData = {
        ...data,
        holdings: data.holdings.map((holding, index) => {
          const mode = buyDateModes[index] ?? 'month'; // default to month
          
          // If in month mode and buyDate has a value, parse it to first day of month
          if (mode === 'month' && holding.buyDate) {
            const dateStr = holding.buyDate.toString();
            if (dateStr.includes('-') && !dateStr.includes(':')) {
              // Format is likely "YYYY-MM" from month input
              const parts = dateStr.split('-');
              const year = parts[0];
              const month = parts[1];
              if (year && month) {
                return {
                  ...holding,
                  buyDate: new Date(parseInt(year), parseInt(month) - 1, 1),
                };
              }
            }
          }
          
          return holding;
        }),
      };
      
      await createSnapshot.mutateAsync(processedData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setCreatedAccounts([]);
    setBuyDateModes({}); // Reset buy date modes
    onClose();
  };

  const handlePrefill = () => {
    if (!latestSnapshot?.holdings?.length) return;

    const prefillHoldings = latestSnapshot.holdings.map((h) => ({
      ticker: h.ticker,
      companyName: h.companyName,
      quantity: Number(h.quantity),
      buyPrice: Number(h.buyPrice),
      buyDate: h.buyDate,
      currentPrice: 0,        // user must enter today's price
      currency: h.currency,
      plannedTerm: h.plannedTerm,
      accountId: h.accountId,
      salePrice: null,        // sales are historical, do not carry over
      saleDate: null,
      soldQuantity: null,
    }));

    reset({
      snapshotDate: new Date(),
      holdings: prefillHoldings,
    });
  };

  const allBrokerageAccounts = [...brokerageAccounts, ...createdAccounts];
  const accountOptions = allBrokerageAccounts.map((account) => ({
    value: account.id,
    label: account.name,
  }));

  return (
    <Modal show={isOpen} onClose={handleClose} panelClassName='max-w-4xl'>
      <Modal.Header>
        <span className='text-xl font-semibold text-foreground'>
          New Stock Snapshot
        </span>
        <p className='text-sm text-muted-foreground mt-1'>
          Record your current stock portfolio position
        </p>
      </Modal.Header>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
        <Modal.Body variant='spacious'>
          {/* Snapshot Date */}
          <div>
            <Label htmlFor='snapshotDate'>Snapshot Date *</Label>
            <input
              {...register('snapshotDate')}
              type='date'
              className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
            />
            {errors.snapshotDate && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.snapshotDate.message}
              </p>
            )}
          </div>

          {/* Holdings */}
          <div>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-lg font-semibold text-foreground'>
                Stock Holdings
              </h3>
              {latestSnapshot && (
                <Button
                  type='button'
                  variant='secondary'
                  onClick={handlePrefill}
                  disabled={isLoadingPrefill}
                >
                  {isLoadingPrefill ? 'Loading...' : '↩ Prefill from previous'}
                </Button>
              )}
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className='mb-6 p-4 border border-border rounded-lg bg-muted/30'
              >
                <div className='flex justify-between items-center mb-4'>
                  <h4 className='font-medium text-foreground'>
                    Holding #{index + 1}
                  </h4>
                  {fields.length > 1 && (
                    <button
                      type='button'
                      onClick={() => remove(index)}
                      className='text-destructive hover:text-destructive/80 flex items-center gap-1'
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  )}
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {/* Account Selection */}
                  <div className='md:col-span-2'>
                    <Label htmlFor={`holdings.${index}.accountId`}>
                      Brokerage Account *
                    </Label>
                    <Controller
                      name={`holdings.${index}.accountId`}
                      control={control}
                      render={({ field }) => (
                        <CreatableAppSelect<SelectOption>
                          {...field}
                          options={accountOptions}
                          value={accountOptions.find((opt) => opt.value === field.value) ?? null}
                          onChange={(selected) => field.onChange(selected?.value ?? '')}
                          onCreateOption={(inputValue) => handleCreateBrokerageAccount(inputValue, field.onChange)}
                          isLoading={createBrokerageAccount.isPending}
                          formatCreateLabel={(inputValue) => `+ Create \"${inputValue}\"`}
                          className='mt-1'
                        />
                      )}
                    />
                    {errors.holdings?.[index]?.accountId && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.accountId?.message}
                      </p>
                    )}
                  </div>

                  {/* Ticker */}
                  <div>
                    <Label htmlFor={`holdings.${index}.ticker`}>
                      Ticker Symbol *
                    </Label>
                    <input
                      {...register(`holdings.${index}.ticker`)}
                      type='text'
                      placeholder='e.g., CBA'
                      className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                    />
                    {errors.holdings?.[index]?.ticker && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.ticker?.message}
                      </p>
                    )}
                  </div>

                  {/* Company Name */}
                  <div>
                    <Label htmlFor={`holdings.${index}.companyName`}>
                      Company Name *
                    </Label>
                    <input
                      {...register(`holdings.${index}.companyName`)}
                      type='text'
                      placeholder='e.g., Commonwealth Bank'
                      className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                    />
                    {errors.holdings?.[index]?.companyName && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.companyName?.message}
                      </p>
                    )}
                  </div>

                  {/* Currency */}
                  <div>
                    <Label htmlFor={`holdings.${index}.currency`}>
                      Currency *
                    </Label>
                    <Controller
                      name={`holdings.${index}.currency`}
                      control={control}
                      render={({ field }) => (
                        <Select<SelectOption>
                          {...field}
                          options={CURRENCY_OPTIONS}
                          value={CURRENCY_OPTIONS.find(
                            (opt) => opt.value === field.value,
                          )}
                          onChange={(selected) =>
                            field.onChange(selected?.value)
                          }
                          className='mt-1'
                        />
                      )}
                    />
                    {errors.holdings?.[index]?.currency && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.currency?.message}
                      </p>
                    )}
                  </div>

                  {/* Quantity */}
                  <div>
                    <Label htmlFor={`holdings.${index}.quantity`}>
                      Quantity *
                    </Label>
                    <Controller
                      name={`holdings.${index}.quantity`}
                      control={control}
                      render={({ field }) => (
                        <NumericFormat
                          value={field.value}
                          onValueChange={(values) => {
                            field.onChange(values.floatValue ?? 0);
                          }}
                          onBlur={field.onBlur}
                          allowNegative={false}
                          decimalScale={6}
                          placeholder='0.000000'
                          className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                        />
                      )}
                    />
                    {errors.holdings?.[index]?.quantity && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.quantity?.message}
                      </p>
                    )}
                  </div>

                  {/* Buy Price */}
                  <div>
                    <Label htmlFor={`holdings.${index}.buyPrice`}>
                      Buy Price *
                    </Label>
                    <Controller
                      name={`holdings.${index}.buyPrice`}
                      control={control}
                      render={({ field }) => (
                        <NumericFormat
                          value={field.value}
                          onValueChange={(values) => {
                            field.onChange(values.floatValue ?? 0);
                          }}
                          onBlur={field.onBlur}
                          allowNegative={false}
                          decimalScale={2}
                          fixedDecimalScale
                          prefix='$'
                          placeholder='$0.00'
                          className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                        />
                      )}
                    />
                    {errors.holdings?.[index]?.buyPrice && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.buyPrice?.message}
                      </p>
                    )}
                  </div>

                  {/* Buy Date — Toggle between exact/month */}
                  <div>
                    <Label htmlFor={`holdings.${index}.buyDate`}>
                      Buy Date (Optional)
                    </Label>
                    
                    {/* Toggle between month and exact date */}
                    <div className='flex gap-3 mb-2'>
                      <label className='flex items-center gap-2 cursor-pointer text-sm'>
                        <input
                          type='radio'
                          value='month'
                          checked={(buyDateModes[index] ?? 'month') === 'month'}
                          onChange={() => setBuyDateModes(prev => ({ ...prev, [index]: 'month' }))}
                          className='w-4 h-4'
                        />
                        <span>Estimate (month/year)</span>
                      </label>
                      <label className='flex items-center gap-2 cursor-pointer text-sm'>
                        <input
                          type='radio'
                          value='exact'
                          checked={(buyDateModes[index] ?? 'month') === 'exact'}
                          onChange={() => setBuyDateModes(prev => ({ ...prev, [index]: 'exact' }))}
                          className='w-4 h-4'
                        />
                        <span>Exact date</span>
                      </label>
                    </div>

                    {/* Conditional input based on mode */}
                    {(buyDateModes[index] ?? 'month') === 'month' ? (
                      <input
                        {...register(`holdings.${index}.buyDate`)}
                        type='month'
                        placeholder='MM/YYYY'
                        className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                      />
                    ) : (
                      <input
                        {...register(`holdings.${index}.buyDate`)}
                        type='date'
                        className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                      />
                    )}

                    {/* CGT Eligibility Warning */}
                    <CGTEligibilityWarning 
                      buyDate={watch(`holdings.${index}.buyDate`)}
                      snapshotDate={watch('snapshotDate')}
                    />

                    {errors.holdings?.[index]?.buyDate && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.buyDate?.message}
                      </p>
                    )}
                  </div>

                  {/* Current Price */}{/* Current Price */}
                  <div>
                    <Label htmlFor={`holdings.${index}.currentPrice`}>
                      Current Price *
                    </Label>
                    <Controller
                      name={`holdings.${index}.currentPrice`}
                      control={control}
                      render={({ field }) => (
                        <NumericFormat
                          value={field.value}
                          onValueChange={(values) => {
                            field.onChange(values.floatValue ?? 0);
                          }}
                          onBlur={field.onBlur}
                          allowNegative={false}
                          decimalScale={2}
                          fixedDecimalScale
                          prefix='$'
                          placeholder='$0.00'
                          className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                        />
                      )}
                    />
                    {errors.holdings?.[index]?.currentPrice && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.currentPrice?.message}
                      </p>
                    )}
                  </div>

                  {/* Planned Term */}
                  <div>
                    <Label htmlFor={`holdings.${index}.plannedTerm`}>
                      Planned Holding Term *
                    </Label>
                    <Controller
                      name={`holdings.${index}.plannedTerm`}
                      control={control}
                      render={({ field }) => (
                        <Select<SelectOption>
                          {...field}
                          options={TERM_OPTIONS}
                          value={TERM_OPTIONS.find(
                            (opt) => opt.value === field.value,
                          )}
                          onChange={(selected) =>
                            field.onChange(selected?.value)
                          }
                          className='mt-1'
                        />
                      )}
                    />
                    {errors.holdings?.[index]?.plannedTerm && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.plannedTerm?.message}
                      </p>
                    )}
                  </div>

                  {/* Sale Price (Optional) */}
                  <div>
                    <Label htmlFor={`holdings.${index}.salePrice`}>
                      Sale Price (Optional)
                    </Label>
                    <Controller
                      name={`holdings.${index}.salePrice`}
                      control={control}
                      render={({ field }) => (
                        <NumericFormat
                          value={field.value ?? ''}
                          onValueChange={(values) => {
                            field.onChange(
                              values.floatValue === undefined
                                ? null
                                : values.floatValue,
                            );
                          }}
                          onBlur={field.onBlur}
                          allowNegative={false}
                          decimalScale={2}
                          fixedDecimalScale
                          prefix='$'
                          placeholder='$0.00'
                          className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                        />
                      )}
                    />
                    {errors.holdings?.[index]?.salePrice && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.salePrice?.message}
                      </p>
                    )}
                  </div>

                  {/* Sale Date (Optional) */}
                  <div>
                    <Label htmlFor={`holdings.${index}.saleDate`}>
                      Sale Date (Optional)
                    </Label>
                    <input
                      {...register(`holdings.${index}.saleDate`)}
                      type='date'
                      className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                    />
                    {errors.holdings?.[index]?.saleDate && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.saleDate?.message}
                      </p>
                    )}
                  </div>

                  {/* Sold Quantity (Optional) */}
                  <div>
                    <Label htmlFor={`holdings.${index}.soldQuantity`}>
                      Sold Quantity (Optional)
                    </Label>
                    <Controller
                      name={`holdings.${index}.soldQuantity`}
                      control={control}
                      render={({ field }) => (
                        <NumericFormat
                          value={field.value ?? ''}
                          onValueChange={(values) => {
                            field.onChange(
                              values.floatValue === undefined
                                ? null
                                : values.floatValue,
                            );
                          }}
                          onBlur={field.onBlur}
                          allowNegative={false}
                          decimalScale={6}
                          placeholder='0.000000'
                          className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                        />
                      )}
                    />
                    {errors.holdings?.[index]?.soldQuantity && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.holdings[index]?.soldQuantity?.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {errors.holdings &&
              typeof errors.holdings === 'object' &&
              'message' in errors.holdings && (
                <p className='mt-2 text-sm text-red-600'>
                  {(errors.holdings as any).message}
                </p>
              )}

            <button
              type='button'
              onClick={() =>
                append({
                  ticker: '',
                  companyName: '',
                  quantity: 0,
                  buyPrice: 0,
                  buyDate: new Date(),
                  currentPrice: 0,
                  currency: 'AUD',
                  plannedTerm: 'MID_TERM',
                  accountId: brokerageAccounts?.[0]?.id || '',
                })
              }
              className='flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium'
            >
              <Plus className='w-4 h-4' />
              Add Another Holding
            </button>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant='secondary'
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant='primary'
            type='submit'
            disabled={isSubmitting || createSnapshot.isPending}
          >
            {isSubmitting || createSnapshot.isPending
              ? 'Creating...'
              : 'Create Snapshot'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
