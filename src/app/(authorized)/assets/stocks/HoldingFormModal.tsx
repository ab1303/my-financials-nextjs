'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import { CreatableAppSelect } from '@/components/ui/CreatableAppSelect';
import { CGTEligibilityWarning } from '@/components/ui/CGTEligibilityWarning';

type SelectOption = { value: string; label: string };

import { NumericFormat } from 'react-number-format';
import { Disclosure } from '@headlessui/react';

import { Modal } from '@/components/ui/Modal';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components';
import { trpc } from '@/server/trpc/client';
import {
  createStockHoldingSchema,
  updateStockHoldingSchema,
} from '@/server/schema/stock-asset.schema';

import type {
  CreateStockHoldingInput,
  UpdateStockHoldingInput,
} from '@/server/schema/stock-asset.schema';
import type { StockHoldingWithAccount } from '@/types/stock-asset.types';

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
    userId: string | null;
    financialAccounts: Array<{ id: string; name: string }>;
  }>;
  snapshotId?: string;
  editingHolding?: StockHoldingWithAccount | null;
  defaultAccountId?: string;
}

type CreateFormData = CreateStockHoldingInput;
type UpdateFormData = UpdateStockHoldingInput;
type FormData = CreateFormData | UpdateFormData;

const CURRENCY_OPTIONS = [
  { value: 'AUD', label: 'AUD' },
  { value: 'USD', label: 'USD' },
];

const TERM_OPTIONS = [
  { value: 'SHORT_TERM', label: 'Short Term (< 12 months)' },
  { value: 'MID_TERM', label: 'Mid Term (12-36 months)' },
  { value: 'LONG_TERM', label: 'Long Term (> 36 months)' },
];

export default function HoldingFormModal({
  isOpen,
  onClose,
  onSuccess,
  brokerageAccounts,
  brokerageInstitutions,
  snapshotId,
  editingHolding,
  defaultAccountId,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaleExpanded, setIsSaleExpanded] = useState(false);
  const [buyDateMode, setBuyDateMode] = useState<'exact' | 'month'>('month');
  const utils = trpc.useUtils();

  const isEditMode = !!editingHolding;

  // Two-level select state
  const [selectedInstitution, setSelectedInstitution] = useState<{ id: string; name: string } | null>(null);

  // Helper: get account name from id
  const accountNameForId = (id: string) => {
    return brokerageAccounts.find(a => a.id === id)?.name ?? id;
  };

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

  // Pre-select institution in edit mode
  useEffect(() => {
    if (isEditMode && editingHolding?.account?.institution) {
      setSelectedInstitution({
        id: editingHolding.account.institution.id,
        name: editingHolding.account.institution.name,
      });
    }
  }, [isEditMode, editingHolding]);

  // Pre-select institution in create mode if defaultAccountId is provided
  useEffect(() => {
    if (!isEditMode && defaultAccountId) {
      const account = brokerageAccounts.find(a => a.id === defaultAccountId);
      if (account) setSelectedInstitution(account.institution);
    }
  }, [defaultAccountId, brokerageAccounts, isEditMode]);

  // Form setup
  const schema = isEditMode ? updateStockHoldingSchema : createStockHoldingSchema;
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: isEditMode && editingHolding
      ? {
          holdingId: editingHolding.id,
          ...editingHolding,
          accountId: editingHolding.accountId,
          quantity: Number(editingHolding.quantity),
          buyPrice: Number(editingHolding.buyPrice),
          currentPrice: Number(editingHolding.currentPrice),
          salePrice: editingHolding.salePrice != null ? Number(editingHolding.salePrice) : null,
          soldQuantity: editingHolding.soldQuantity != null ? Number(editingHolding.soldQuantity) : null,
        }
      : {
          ticker: '',
          companyName: '',
          quantity: 0,
          buyPrice: 0,
          buyDate: new Date(),
          currentPrice: 0,
          currency: 'AUD',
          plannedTerm: 'MID_TERM',
          snapshotId: snapshotId ?? '',
          accountId: defaultAccountId ?? '',
          salePrice: null,
          saleDate: null,
          soldQuantity: null,
        },
  });

  // Institution options for select
  // Group institutions: global first (🌍), then user's custom (👤)
  const institutionOptions: SelectOption[] = brokerageInstitutions.map(inst => ({
    value: inst.id,
    label: inst.userId === null ? `🌍 ${inst.name}` : `👤 ${inst.name}`,
  }));

  // Accounts for selected institution
  const institution = selectedInstitution
    ? brokerageInstitutions.find(inst => inst.id === selectedInstitution.id)
    : undefined;
  const accountOptions: SelectOption[] = institution
    ? institution.financialAccounts.map(acc => ({
        value: acc.id,
        label: acc.name,
      }))
    : [];

  // Update form values when editingHolding changes
  useEffect(() => {
    if (isOpen && editingHolding) {
      reset({
        holdingId: editingHolding.id,
        ...editingHolding,
        accountId: editingHolding.accountId,
        quantity: Number(editingHolding.quantity),
        buyPrice: Number(editingHolding.buyPrice),
        currentPrice: Number(editingHolding.currentPrice),
        salePrice: editingHolding.salePrice != null ? Number(editingHolding.salePrice) : null,
        soldQuantity: editingHolding.soldQuantity != null ? Number(editingHolding.soldQuantity) : null,
      });
    } else if (isOpen && !editingHolding) {
      reset({
        ticker: '',
        companyName: '',
        quantity: 0,
        buyPrice: 0,
        buyDate: new Date(),
        currentPrice: 0,
        currency: 'AUD',
        plannedTerm: 'MID_TERM',
        snapshotId: snapshotId ?? '',
        accountId: defaultAccountId ?? '',
        salePrice: null,
        saleDate: null,
        soldQuantity: null,
      });
      setBuyDateMode('month');
      setSelectedInstitution(null);
    }
  }, [isOpen, editingHolding, snapshotId, defaultAccountId, reset]);
  const handleClose = () => {
    reset();
    setSelectedInstitution(null);
    setBuyDateMode('month');
    onClose();
  };

  // Create institution handler
  const handleCreateInstitution = async (
    inputValue: string,
    onInstitutionChange: (option: { value: string; label: string }) => void
  ) => {
    const result = await createInstitution.mutateAsync({ name: inputValue, type: 'BROKERAGE' });
    const newInstitution = { id: result.id, name: result.name };
    setSelectedInstitution(newInstitution);
    onInstitutionChange({ value: result.id, label: result.name });
    setValue('accountId', '');
  };

  // Create sub-account handler
  const handleCreateSubAccount = async (
    inputValue: string,
    onAccountChange: (option: { value: string; label: string }) => void
  ) => {
    if (!selectedInstitution) {
      toast.error('Select an institution first');
      return;
    }
    const result = await createBrokerageSubAccount.mutateAsync({
      businessId: selectedInstitution.id,
      name: inputValue,
    });
    if (!result) return;
    onAccountChange({ value: result.id, label: result.name });
    setValue('accountId', result.id);
  };

  // Mutations for create/update
  const createHolding = trpc.stockAsset.createHolding.useMutation({
    onSuccess: () => {
      toast.success('Holding created successfully!');
      utils.stockAsset.getSnapshots.invalidate();
      reset();
      setSelectedInstitution(null);
      setBuyDateMode('month');
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create holding');
    },
  });

  const updateHolding = trpc.stockAsset.updateHolding.useMutation({
    onSuccess: () => {
      toast.success('Holding updated successfully!');
      utils.stockAsset.getSnapshots.invalidate();
      reset();
      setSelectedInstitution(null);
      setBuyDateMode('month');
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update holding');
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Convert buyDate if in month mode
      let processedData = { ...data };
      if (buyDateMode === 'month' && data.buyDate) {
        const dateStr = data.buyDate.toString();
        if (dateStr.includes('-') && !dateStr.includes(':')) {
          const parts = dateStr.split('-');
          const year = parts[0];
          const month = parts[1];
          if (year && month) {
            processedData = {
              ...data,
              buyDate: new Date(parseInt(year), parseInt(month) - 1, 1),
            };
          }
        }
      }
      if (isEditMode) {
        await updateHolding.mutateAsync(processedData as UpdateFormData);
      } else {
        if (!snapshotId) {
          toast.error('Snapshot ID is required to add a holding');
          return;
        }
        await createHolding.mutateAsync({
          ...(processedData as CreateFormData),
          snapshotId,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={handleClose} panelClassName='max-w-2xl sm:max-w-lg'>
      <Modal.Header>
        <span className='text-xl font-semibold text-foreground'>
          {isEditMode ? 'Edit Holding' : 'Add Holding'}
        </span>
      </Modal.Header>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Body variant='spacious'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6'>
            {/* Institution Selection */}
            <div className='sm:col-span-2'>
            <Label htmlFor='institutionId'>Brokerage Institution *</Label>
            <CreatableAppSelect<SelectOption>
              options={institutionOptions}
              value={
                selectedInstitution
                  ? { value: selectedInstitution.id, label: selectedInstitution.name }
                  : null
              }
              onChange={option => {
                setSelectedInstitution(option ? { id: option.value, name: option.label } : null);
                setValue('accountId', '');
              }}
              onCreateOption={inputValue =>
                handleCreateInstitution(
                  inputValue,
                  (option) => {
                    setSelectedInstitution({ id: option.value, name: option.label });
                    setValue('accountId', '');
                  }
                )
              }
              isLoading={createInstitution.isPending}
              formatCreateLabel={inputValue => `+ Create "${inputValue}"`}
              className='mt-1'
              placeholder='Select or create institution…'
              inputId='institutionId'
              isDisabled={isEditMode}
            />
          </div>
          {/* Account Selection */}
          <div>
            <Label htmlFor='accountId'>Brokerage Account *</Label>
            <Controller
              name='accountId'
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
                      (option) => field.onChange(option.value)
                    )
                  }
                  isLoading={createBrokerageSubAccount.isPending}
                  formatCreateLabel={inputValue => `+ Create "${inputValue}"`}
                  className='mt-1'
                  isDisabled={!selectedInstitution || isEditMode}
                  placeholder={
                    selectedInstitution
                      ? 'Select or create account…'
                      : 'Select institution first'
                  }
                  inputId='accountId'
                />
              )}
            />
            {!isEditMode && (errors as any).accountId && (
              <p className='mt-1 text-sm text-red-600'>
                {(errors as any).accountId?.message}
              </p>
            )}
          </div>
          {/* Ticker */}
          <div>
            <Label htmlFor='ticker'>Ticker *</Label>
            <input
              {...register('ticker')}
              type='text'
              className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring read-only:opacity-75 read-only:cursor-default focus-visible:ring-2 focus-visible:ring-ring'
              autoCapitalize='characters'
              autoCorrect='off'
              spellCheck={false}
              inputMode='text'
              autoComplete='off'
              placeholder='e.g. CBA…'
              readOnly={isEditMode}
              aria-readonly={isEditMode}
            />
            {errors.ticker && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.ticker.message}
              </p>
            )}
          </div>
          {/* Company Name */}
          <div>
            <Label htmlFor='companyName'>Company Name *</Label>
            <input
              {...register('companyName')}
              type='text'
              className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring read-only:opacity-75 read-only:cursor-default focus-visible:ring-2 focus-visible:ring-ring'
              autoCorrect='off'
              spellCheck={false}
              inputMode='text'
              autoComplete='off'
              placeholder='e.g. Commonwealth Bank…'
              readOnly={isEditMode}
              aria-readonly={isEditMode}
            />
            {errors.companyName && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.companyName.message}
              </p>
            )}
          </div>
          {/* Currency */}
          <div>
            <Label htmlFor='currency'>Currency *</Label>
            <Controller
              name='currency'
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={CURRENCY_OPTIONS}
                  value={CURRENCY_OPTIONS.find(opt => opt.value === field.value) ?? null}
                  onChange={selected => field.onChange(selected?.value ?? '')}
                  className='mt-1'
                  isDisabled={false}
                />
              )}
            />
            {errors.currency && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.currency.message}
              </p>
            )}
          </div>
          {/* Planned Term */}
          <div>
            <Label htmlFor='plannedTerm'>Planned Term *</Label>
            <Controller
              name='plannedTerm'
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={TERM_OPTIONS}
                  value={TERM_OPTIONS.find(opt => opt.value === field.value) ?? null}
                  onChange={selected => field.onChange(selected?.value ?? '')}
                  className='mt-1'
                  isDisabled={false}
                />
              )}
            />
            {errors.plannedTerm && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.plannedTerm.message}
              </p>
            )}
          </div>
          {/* Quantity */}
          <div>
            <Label htmlFor='quantity'>Quantity *</Label>
            <Controller
              name='quantity'
              control={control}
              render={({ field: { value, onChange, onBlur, ref } }) => (
                <NumericFormat
                  value={value ?? ''}
                  getInputRef={ref}
                  onBlur={onBlur}
                  allowNegative={false}
                  decimalScale={4}
                  allowLeadingZeros={false}
                  thousandSeparator
                  className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                  onValueChange={(values) => onChange(values.floatValue ?? 0)}
                  disabled={false}
                />
              )}
            />
            {errors.quantity && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.quantity.message}
              </p>
            )}
          </div>
          {/* Buy Price */}
          <div>
            <Label htmlFor='buyPrice'>Buy Price (per share) *</Label>
            <Controller
              name='buyPrice'
              control={control}
              render={({ field: { value, onChange, onBlur, ref } }) => (
                <NumericFormat
                  value={value ?? ''}
                  getInputRef={ref}
                  onBlur={onBlur}
                  allowNegative={false}
                  decimalScale={4}
                  allowLeadingZeros={false}
                  thousandSeparator
                  prefix='$'
                  className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                  onValueChange={(values) => onChange(values.floatValue ?? 0)}
                  disabled={false}
                />
              )}
            />
            {errors.buyPrice && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.buyPrice.message}
              </p>
            )}
          </div>
          {/* Buy Date */}
          <div>
            <Label htmlFor='buyDate'>Buy Date *</Label>
            <div className='flex gap-2 items-center'>
              <select
                value={buyDateMode}
                onChange={e => setBuyDateMode(e.target.value as 'month' | 'exact')}
                className='border border-input bg-background text-foreground rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                disabled={false}
              >
                <option value='month'>Month</option>
                <option value='exact'>Exact</option>
              </select>
              <Controller
                name='buyDate'
                control={control}
                render={({ field: { value, onChange, ...rest } }) =>
                  buyDateMode === 'exact' ? (
                    <input
                      {...rest}
                      type='date'
                      value={value ? new Date(value).toISOString().split('T')[0] : ''}
                      onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
                      className='block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                      disabled={false}
                    />
                  ) : (
                    <input
                      {...rest}
                      type='month'
                      value={value ? new Date(value).toISOString().slice(0, 7) : ''}
                      onChange={(e) => onChange(e.target.value ? new Date(e.target.value + '-01') : null)}
                      className='block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                      disabled={false}
                    />
                  )
                }
              />
            </div>
            {errors.buyDate && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.buyDate.message}
              </p>
            )}
          </div>
          {/* Current Price */}
          <div>
            <Label htmlFor='currentPrice'>Current Price (per share) *</Label>
            <Controller
              name='currentPrice'
              control={control}
              render={({ field: { value, onChange, onBlur, ref } }) => (
                <NumericFormat
                  value={value ?? ''}
                  getInputRef={ref}
                  onBlur={onBlur}
                  allowNegative={false}
                  decimalScale={4}
                  allowLeadingZeros={false}
                  thousandSeparator
                  prefix='$'
                  className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                  onValueChange={(values) => onChange(values.floatValue ?? 0)}
                  disabled={false}
                />
              )}
            />
            {errors.currentPrice && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.currentPrice.message}
              </p>
            )}
          </div>
          {/* Sale Section */}
          <div className='sm:col-span-2'>
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button
                  className='flex items-center gap-2 mt-4 text-indigo-700 hover:underline'
                  onClick={() => setIsSaleExpanded(!isSaleExpanded)}
                  type='button'
                >
                  {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {open ? 'Hide Sale Fields' : 'Show Sale Fields'}
                </Disclosure.Button>
                <Disclosure.Panel>
                  <div className='mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    {/* Sale Price */}
                    <div>
                      <Label htmlFor='salePrice'>Sale Price (per share)</Label>
                      <Controller
                        name='salePrice'
                        control={control}
                        render={({ field: { value, onChange, onBlur, ref } }) => (
                          <NumericFormat
                            value={value ?? ''}
                            getInputRef={ref}
                            onBlur={onBlur}
                            allowNegative={false}
                            decimalScale={4}
                            allowLeadingZeros={false}
                            thousandSeparator
                            prefix='$'
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                            onValueChange={(values) => onChange(values.floatValue ?? null)}
                            disabled={false}
                          />
                        )}
                      />
                      {errors.salePrice && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.salePrice.message}
                        </p>
                      )}
                    </div>
                    {/* Sale Date */}
                    <div>
                      <Label htmlFor='saleDate'>Sale Date</Label>
                      <Controller
                        name='saleDate'
                        control={control}
                        render={({ field: { value, onChange, ...rest } }) => (
                          <input
                            {...rest}
                            type='date'
                            value={value ? new Date(value).toISOString().split('T')[0] : ''}
                            onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                            disabled={false}
                          />
                        )}
                      />
                      {errors.saleDate && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.saleDate.message}
                        </p>
                      )}
                    </div>
                    {/* Sold Quantity */}
                    <div>
                      <Label htmlFor='soldQuantity'>Sold Quantity</Label>
                      <Controller
                        name='soldQuantity'
                        control={control}
                        render={({ field: { value, onChange, onBlur, ref } }) => (
                          <NumericFormat
                            value={value ?? ''}
                            getInputRef={ref}
                            onBlur={onBlur}
                            allowNegative={false}
                            decimalScale={4}
                            allowLeadingZeros={false}
                            thousandSeparator
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                            onValueChange={(values) => onChange(values.floatValue ?? null)}
                            disabled={false}
                          />
                        )}
                      />
                      {errors.soldQuantity && (
                        <p className='mt-1 text-sm text-red-600'>
                          {errors.soldQuantity.message}
                        </p>
                      )}
                    </div>
                  </div>
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>
          <CGTEligibilityWarning
            buyDate={watch('buyDate')}
          />
          </div>
          </div>
        </Modal.Body>
        <Modal.Footer className='flex-col-reverse sm:flex-row sm:gap-3'>
          <Button variant='secondary' onClick={handleClose} disabled={isSubmitting} aria-disabled={isSubmitting} className='w-full sm:w-auto'>
            Cancel
          </Button>
          <Button
            variant='primary'
            type='submit'
            disabled={isSubmitting || createHolding.isPending || updateHolding.isPending}
            className='w-full sm:w-auto'
          >
            {isSubmitting || createHolding.isPending || updateHolding.isPending
              ? isEditMode
                ? 'Saving…'
                : 'Creating…'
              : isEditMode
                ? 'Save Changes'
                : 'Add Holding'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}



