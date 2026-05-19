'use client';

import { useState, useEffect } from 'react';
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
    institution: { id: string; name: string };
  }>;
  brokerageInstitutions: Array<{
    id: string;
    name: string;
    financialAccounts: Array<{ id: string; name: string }>;
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
  brokerageInstitutions,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Per-holding institution selection: { [holdingIndex]: { id, name } | null }
  const [selectedInstitutions, setSelectedInstitutions] = useState<Record<number, { id: string; name: string } | null>>({});
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
    setValue,
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
          accountId: '', // No default, must select institution/account
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

  // Create new institution (Business/BROKERAGE)
  const createInstitution = trpc.business.create.useMutation({
    onSuccess: async () => {
      await utils.business.getBrokeragesWithAccounts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create brokerage institution');
    },
  });

  // Create new sub-account under institution
  const createBrokerageSubAccount = trpc.stockAsset.createBrokerageSubAccount.useMutation({
    onSuccess: async () => {
      await utils.stockAsset.getBrokerageAccounts.invalidate();
      await utils.business.getBrokeragesWithAccounts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create brokerage account');
    },
  });

  // Helper: get account name from id
  const accountNameForId = (id: string) => {
    return brokerageAccounts.find(a => a.id === id)?.name ?? id;
  };

  // Handle institution creation (per holding)
  const handleCreateInstitution = async (
    inputValue: string,
    onInstitutionChange: (option: { value: string; label: string }) => void,
    holdingIdx: number
  ) => {
    const result = await createInstitution.mutateAsync({ name: inputValue, type: 'BROKERAGE' });
    const newInstitution = { id: result.id, name: result.name };
    setSelectedInstitutions(prev => ({ ...prev, [holdingIdx]: newInstitution }));
    onInstitutionChange({ value: result.id, label: result.name });
    // Reset accountId field for this holding
    setValue(`holdings.${holdingIdx}.accountId`, '');
  };

  // Handle sub-account creation (per holding)
  const handleCreateSubAccount = async (
    inputValue: string,
    onAccountChange: (option: { value: string; label: string }) => void,
    holdingIdx: number
  ) => {
    const institution = selectedInstitutions[holdingIdx];
    if (!institution) {
      toast.error('Select an institution first');
      return;
    }
    const result = await createBrokerageSubAccount.mutateAsync({
      businessId: institution.id,
      name: inputValue,
    });
    if (!result) return;
    onAccountChange({ value: result.id, label: result.name });
    // Set accountId field for this holding
    setValue(`holdings.${holdingIdx}.accountId`, result.id);
  };

  const createSnapshot = trpc.stockAsset.createSnapshot.useMutation({
    onSuccess: () => {
      toast.success('Snapshot created successfully!');
      utils.stockAsset.getSnapshots.invalidate();
      reset();
      setSelectedInstitutions({});
      setBuyDateModes({});
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
    setSelectedInstitutions({});
    setBuyDateModes({});
    onClose();
  };

  // Prefill from latest snapshot, including selectedInstitutions
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

    // Restore selectedInstitutions from prefilled holdings
    const prefillInstitutions: Record<number, { id: string; name: string }> = {};
    latestSnapshot.holdings.forEach((h, idx) => {
      if (h.account?.institution) {
        prefillInstitutions[idx] = {
          id: h.account.institution.id,
          name: h.account.institution.name,
        };
      }
    });
    setSelectedInstitutions(prefillInstitutions);

    reset({
      snapshotDate: new Date(),
      holdings: prefillHoldings,
    });
  };

  // Institution options for select
  const institutionOptions: SelectOption[] = brokerageInstitutions.map(inst => ({
    value: inst.id,
    label: inst.name,
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

            {fields.map((field, index) => {
              // Current selected institution for this holding
              const selectedInstitution = selectedInstitutions[index] || null;
              // Accounts for this institution
              const institution = selectedInstitution
                ? brokerageInstitutions.find(inst => inst.id === selectedInstitution.id)
                : undefined;
              const accountOptions: SelectOption[] = institution
                ? institution.financialAccounts.map(acc => ({
                    value: acc.id,
                    label: acc.name,
                  }))
                : [];

              return (
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
                        onClick={() => {
                          // Remove institution selection for this holding
                          setSelectedInstitutions(prev => {
                            const copy = { ...prev };
                            delete copy[index];
                            return copy;
                          });
                          remove(index);
                        }}
                        className='text-destructive hover:text-destructive/80 flex items-center gap-1'
                      >
                        <Trash2 size={16} />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {/* Institution Selection */}
                    <div className='md:col-span-2'>
                      <Label htmlFor={`holdings.${index}.institutionId`}>
                        Brokerage Institution *
                      </Label>
                      <CreatableAppSelect<SelectOption>
                        options={institutionOptions}
                        value={
                          selectedInstitution
                            ? { value: selectedInstitution.id, label: selectedInstitution.name }
                            : null
                        }
                        onChange={option => {
                          setSelectedInstitutions(prev => ({
                            ...prev,
                            [index]: option
                              ? { id: option.value, name: option.label }
                              : null,
                          }));
                          // Reset accountId field for this holding
                          setValue(`holdings.${index}.accountId`, '');
                        }}
                        onCreateOption={inputValue =>
                          handleCreateInstitution(
                            inputValue,
                            (option) => {
                              setSelectedInstitutions(prev => ({
                                ...prev,
                                [index]: { id: option.value, name: option.label },
                              }));
                              // Reset accountId field for this holding
                              setValue(`holdings.${index}.accountId`, '');
                            },
                            index
                          )
                        }
                        isLoading={createInstitution.isPending}
                        formatCreateLabel={inputValue => `+ Create "${inputValue}"`}
                        className='mt-1'
                        placeholder='Select or create institution…'
                        inputId={`holdings.${index}.institutionId`}
                      />
                    </div>

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
                            value={
                              field.value
                                ? accountOptions.find(opt => opt.value === field.value) ?? null
                                : null
                            }
                            onChange={selected => field.onChange(selected?.value ?? '')}
                            onCreateOption={inputValue =>
                              handleCreateSubAccount(
                                inputValue,
                                (option) => field.onChange(option.value),
                                index
                              )
                            }
                            isLoading={createBrokerageSubAccount.isPending}
                            formatCreateLabel={inputValue => `+ Create "${inputValue}"`}
                            className='mt-1'
                            isDisabled={!selectedInstitution}
                            placeholder={
                              selectedInstitution
                                ? 'Select or create account…'
                                : 'Select institution first'
                            }
                            inputId={`holdings.${index}.accountId`}
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
                      <Label htmlFor={`holdings.${index}.ticker`}>Ticker *</Label>
                      <input
                        {...register(`holdings.${index}.ticker`)}
                        type='text'
                        className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                        autoCapitalize='characters'
                        autoCorrect='off'
                        spellCheck={false}
                        inputMode='text'
                        autoComplete='off'
                        placeholder='e.g. CBA'
                      />
                      {errors.holdings?.[index]?.ticker && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.holdings[index]?.ticker?.message}
                        </p>
                      )}
                    </div>

                    {/* Company Name */}
                    <div>
                      <Label htmlFor={`holdings.${index}.companyName`}>Company Name *</Label>
                      <input
                        {...register(`holdings.${index}.companyName`)}
                        type='text'
                        className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                        autoCorrect='off'
                        spellCheck={false}
                        inputMode='text'
                        autoComplete='off'
                        placeholder='e.g. Commonwealth Bank'
                      />
                      {errors.holdings?.[index]?.companyName && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.holdings[index]?.companyName?.message}
                        </p>
                      )}
                    </div>

                    {/* Currency */}
                    <div>
                      <Label htmlFor={`holdings.${index}.currency`}>Currency *</Label>
                      <Controller
                        name={`holdings.${index}.currency`}
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={CURRENCY_OPTIONS}
                            value={CURRENCY_OPTIONS.find(opt => opt.value === field.value) ?? null}
                            onChange={selected => field.onChange(selected?.value ?? '')}
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

                    {/* Planned Term */}
                    <div>
                      <Label htmlFor={`holdings.${index}.plannedTerm`}>Planned Term *</Label>
                      <Controller
                        name={`holdings.${index}.plannedTerm`}
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            options={TERM_OPTIONS}
                            value={TERM_OPTIONS.find(opt => opt.value === field.value) ?? null}
                            onChange={selected => field.onChange(selected?.value ?? '')}
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

                    {/* Quantity */}
                    <div>
                      <Label htmlFor={`holdings.${index}.quantity`}>Quantity *</Label>
                      <Controller
                        name={`holdings.${index}.quantity`}
                        control={control}
                        render={({ field }) => (
                          <NumericFormat
                            {...field}
                            value={field.value}
                            allowNegative={false}
                            decimalScale={4}
                            allowLeadingZeros={false}
                            thousandSeparator
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                            onValueChange={values => field.onChange(values.floatValue ?? 0)}
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
                      <Label htmlFor={`holdings.${index}.buyPrice`}>Buy Price (per share) *</Label>
                      <Controller
                        name={`holdings.${index}.buyPrice`}
                        control={control}
                        render={({ field }) => (
                          <NumericFormat
                            {...field}
                            value={field.value}
                            allowNegative={false}
                            decimalScale={4}
                            allowLeadingZeros={false}
                            thousandSeparator
                            prefix='$'
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                            onValueChange={values => field.onChange(values.floatValue ?? 0)}
                          />
                        )}
                      />
                      {errors.holdings?.[index]?.buyPrice && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.holdings[index]?.buyPrice?.message}
                        </p>
                      )}
                    </div>

                    {/* Buy Date */}
                    <div>
                      <Label htmlFor={`holdings.${index}.buyDate`}>Buy Date *</Label>
                      <div className='flex gap-2 items-center'>
                        <select
                          value={buyDateModes[index] ?? 'month'}
                          onChange={e =>
                            setBuyDateModes(prev => ({
                              ...prev,
                              [index]: e.target.value as 'month' | 'exact',
                            }))
                          }
                          className='border border-input rounded-md px-2 py-1 text-sm'
                        >
                          <option value='month'>Month</option>
                          <option value='exact'>Exact</option>
                        </select>
                        <Controller
                          name={`holdings.${index}.buyDate`}
                          control={control}
                          render={({ field: { value, onChange, ...rest } }) =>
                            buyDateModes[index] === 'exact' ? (
                              <input
                                {...rest}
                                type='date'
                                value={value ? new Date(value).toISOString().split('T')[0] : ''}
                                onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
                                className='block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                              />
                            ) : (
                              <input
                                {...rest}
                                type='month'
                                value={value ? new Date(value).toISOString().slice(0, 7) : ''}
                                onChange={(e) => onChange(e.target.value ? new Date(e.target.value + '-01') : null)}
                                className='block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                              />
                            )
                          }
                        />
                      </div>
                      {errors.holdings?.[index]?.buyDate && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.holdings[index]?.buyDate?.message}
                        </p>
                      )}
                    </div>

                    {/* Current Price */}
                    <div>
                      <Label htmlFor={`holdings.${index}.currentPrice`}>Current Price (per share) *</Label>
                      <Controller
                        name={`holdings.${index}.currentPrice`}
                        control={control}
                        render={({ field }) => (
                          <NumericFormat
                            {...field}
                            value={field.value}
                            allowNegative={false}
                            decimalScale={4}
                            allowLeadingZeros={false}
                            thousandSeparator
                            prefix='$'
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                            onValueChange={values => field.onChange(values.floatValue ?? 0)}
                          />
                        )}
                      />
                      {errors.holdings?.[index]?.currentPrice && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.holdings[index]?.currentPrice?.message}
                        </p>
                      )}
                    </div>

                    {/* Sale Price */}
                    <div>
                      <Label htmlFor={`holdings.${index}.salePrice`}>Sale Price (per share)</Label>
                      <Controller
                        name={`holdings.${index}.salePrice`}
                        control={control}
                        render={({ field }) => (
                          <NumericFormat
                            {...field}
                            value={field.value ?? ''}
                            allowNegative={false}
                            decimalScale={4}
                            allowLeadingZeros={false}
                            thousandSeparator
                            prefix='$'
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                            onValueChange={values => field.onChange(values.floatValue ?? null)}
                          />
                        )}
                      />
                      {errors.holdings?.[index]?.salePrice && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.holdings[index]?.salePrice?.message}
                        </p>
                      )}
                    </div>

                    {/* Sale Date */}
                    <div>
                      <Label htmlFor={`holdings.${index}.saleDate`}>Sale Date</Label>
                      <Controller
                        name={`holdings.${index}.saleDate`}
                        control={control}
                        render={({ field: { value, onChange, ...rest } }) => (
                          <input
                            {...rest}
                            type='date'
                            value={value ? new Date(value).toISOString().split('T')[0] : ''}
                            onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                          />
                        )}
                      />
                      {errors.holdings?.[index]?.saleDate && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.holdings[index]?.saleDate?.message}
                        </p>
                      )}
                    </div>

                    {/* Sold Quantity */}
                    <div>
                      <Label htmlFor={`holdings.${index}.soldQuantity`}>Sold Quantity</Label>
                      <Controller
                        name={`holdings.${index}.soldQuantity`}
                        control={control}
                        render={({ field }) => (
                          <NumericFormat
                            {...field}
                            value={field.value ?? ''}
                            allowNegative={false}
                            decimalScale={4}
                            allowLeadingZeros={false}
                            thousandSeparator
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                            onValueChange={values => field.onChange(values.floatValue ?? null)}
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
                  <CGTEligibilityWarning
                    buyDate={watch(`holdings.${index}.buyDate`)}
                  />
                </div>
              );
            })}

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
                  accountId: '',
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
          <Button variant='secondary' onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant='primary' type='submit' disabled={isSubmitting || createSnapshot.isPending}>
            {isSubmitting || createSnapshot.isPending ? 'Creating...' : 'Create Snapshot'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
