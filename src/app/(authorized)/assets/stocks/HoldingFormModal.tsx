'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AppSelect as Select } from '@/components/ui/AppSelect';

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
  }>;
  snapshotId?: string;
  editingHolding?: StockHoldingWithAccount | null;
}

type CreateFormData = CreateStockHoldingInput;
type UpdateFormData = UpdateStockHoldingInput;
type FormData = CreateFormData | UpdateFormData;

const CURRENCY_OPTIONS = [
  { value: 'AUD', label: 'AUD 🇦🇺' },
  { value: 'USD', label: 'USD 🇺🇸' },
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
  snapshotId,
  editingHolding,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaleExpanded, setIsSaleExpanded] = useState(false);
  const utils = trpc.useUtils();

  const isEditMode = !!editingHolding;
  const schema = isEditMode
    ? updateStockHoldingSchema
    : createStockHoldingSchema;

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
    defaultValues:
      isEditMode && editingHolding
        ? {
            holdingId: editingHolding.id,
            ticker: editingHolding.ticker,
            companyName: editingHolding.companyName,
            quantity: Number(editingHolding.quantity),
            buyPrice: Number(editingHolding.buyPrice),
            buyDate: editingHolding.buyDate,
            currentPrice: Number(editingHolding.currentPrice),
            currency: editingHolding.currency,
            plannedTerm: editingHolding.plannedTerm,
            accountId: editingHolding.accountId,
            salePrice: editingHolding.salePrice
              ? Number(editingHolding.salePrice)
              : null,
            saleDate: editingHolding.saleDate ?? null,
            soldQuantity: editingHolding.soldQuantity
              ? Number(editingHolding.soldQuantity)
              : null,
          }
        : {
            snapshotId: snapshotId || '',
            ticker: '',
            companyName: '',
            quantity: 0,
            buyPrice: 0,
            buyDate: new Date(),
            currentPrice: 0,
            currency: 'AUD',
            plannedTerm: 'MID_TERM',
            accountId: brokerageAccounts?.[0]?.id || '',
            salePrice: null,
            saleDate: null,
            soldQuantity: null,
          },
  });

  // Watch for sale section visibility
  const salePrice = watch('salePrice');
  const saleDate = watch('saleDate');
  const soldQuantity = watch('soldQuantity');

  // Auto-expand sale section if holding was sold
  useEffect(() => {
    if (isEditMode && editingHolding) {
      if (
        editingHolding.salePrice ||
        editingHolding.saleDate ||
        editingHolding.soldQuantity
      ) {
        setIsSaleExpanded(true);
      }
    }
  }, [editingHolding, isEditMode]);

  const createHolding = trpc.stockAsset.createHolding.useMutation({
    onSuccess: () => {
      toast.success('Holding added successfully!');
      utils.stockAsset.getSnapshotById.invalidate({ snapshotId: snapshotId! });
      utils.stockAsset.getSnapshotTotals.invalidate({
        snapshotId: snapshotId!,
      });
      reset();
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
      if (snapshotId) {
        utils.stockAsset.getSnapshotById.invalidate({ snapshotId });
        utils.stockAsset.getSnapshotTotals.invalidate({ snapshotId });
      }
      reset();
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
      if (isEditMode) {
        await updateHolding.mutateAsync(data as UpdateFormData);
      } else {
        await createHolding.mutateAsync(data as CreateFormData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setIsSaleExpanded(false);
    onClose();
  };

  const accountOptions = brokerageAccounts.map((account) => ({
    value: account.id,
    label: account.name,
  }));

  return (
    <Modal show={isOpen} onClose={handleClose} panelClassName='max-w-2xl'>
      <Modal.Header>
        <h2 className='text-xl font-semibold text-foreground'>
          {isEditMode ? 'Edit Stock Holding' : 'Add Stock Holding'}
        </h2>
        <p className='text-sm text-muted-foreground mt-1'>
          {isEditMode
            ? 'Update holding details and sale information'
            : 'Add a new stock to your snapshot'}
        </p>
      </Modal.Header>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Body variant='spacious'>
          {/* Account Selection */}
          <div>
            <Label htmlFor='accountId'>Brokerage Account *</Label>
            <Controller
              name='accountId'
              control={control}
              render={({ field }) => (
                <Select<SelectOption>
                  {...field}
                  options={accountOptions}
                  value={accountOptions.find(
                    (opt) => opt.value === field.value,
                  )}
                  onChange={(selected) => field.onChange(selected?.value)}
                  className='mt-1'
                  isDisabled={isEditMode}
                />
              )}
            />
            {!isEditMode && (errors as any).accountId && (
              <p className='mt-1 text-sm text-red-600'>
                {(errors as any).accountId?.message}
              </p>
            )}
          </div>

          {/* Ticker & Company */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='ticker'>Ticker Symbol *</Label>
              <input
                {...register('ticker')}
                type='text'
                placeholder='e.g., CBA'
                className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
              />
              {errors.ticker && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.ticker.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor='companyName'>Company Name *</Label>
              <input
                {...register('companyName')}
                type='text'
                placeholder='e.g., Commonwealth Bank'
                className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
              />
              {errors.companyName && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.companyName.message}
                </p>
              )}
            </div>
          </div>

          {/* Currency & Term */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='currency'>Currency *</Label>
              <Controller
                name='currency'
                control={control}
                render={({ field }) => (
                  <Select<SelectOption>
                    {...field}
                    options={CURRENCY_OPTIONS}
                    value={CURRENCY_OPTIONS.find(
                      (opt) => opt.value === field.value,
                    )}
                    onChange={(selected) => field.onChange(selected?.value)}
                    className='mt-1'
                  />
                )}
              />
              {errors.currency && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.currency.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor='plannedTerm'>Planned Term *</Label>
              <Controller
                name='plannedTerm'
                control={control}
                render={({ field }) => (
                  <Select<SelectOption>
                    {...field}
                    options={TERM_OPTIONS}
                    value={TERM_OPTIONS.find(
                      (opt) => opt.value === field.value,
                    )}
                    onChange={(selected) => field.onChange(selected?.value)}
                    className='mt-1'
                  />
                )}
              />
              {errors.plannedTerm && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.plannedTerm.message}
                </p>
              )}
            </div>
          </div>

          {/* Quantity & Prices */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='quantity'>Quantity *</Label>
              <Controller
                name='quantity'
                control={control}
                render={({ field: { value, onChange } }) => (
                  <NumericFormat
                    value={value}
                    onValueChange={(values) => onChange(values.floatValue || 0)}
                    thousandSeparator=','
                    decimalScale={6}
                    fixedDecimalScale
                    placeholder='0.000000'
                    className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                  />
                )}
              />
              {errors.quantity && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.quantity.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor='buyPrice'>Buy Price *</Label>
              <Controller
                name='buyPrice'
                control={control}
                render={({ field: { value, onChange } }) => (
                  <NumericFormat
                    value={value}
                    onValueChange={(values) => onChange(values.floatValue || 0)}
                    thousandSeparator=','
                    decimalScale={2}
                    fixedDecimalScale
                    prefix='$'
                    placeholder='$0.00'
                    className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                  />
                )}
              />
              {errors.buyPrice && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.buyPrice.message}
                </p>
              )}
            </div>
          </div>

          {/* Buy Date & Current Price */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='buyDate'>Buy Date *</Label>
              <input
                {...register('buyDate')}
                type='date'
                className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
              />
              {errors.buyDate && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.buyDate.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor='currentPrice'>Current Price *</Label>
              <Controller
                name='currentPrice'
                control={control}
                render={({ field: { value, onChange } }) => (
                  <NumericFormat
                    value={value}
                    onValueChange={(values) => onChange(values.floatValue || 0)}
                    thousandSeparator=','
                    decimalScale={2}
                    fixedDecimalScale
                    prefix='$'
                    placeholder='$0.00'
                    className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                  />
                )}
              />
              {errors.currentPrice && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.currentPrice.message}
                </p>
              )}
            </div>
          </div>

          {/* Sale Information (Collapsible) */}
          <Disclosure
            as='div'
            className='border-t pt-4'
            defaultOpen={isSaleExpanded}
          >
            {({ open }) => (
              <>
                <Disclosure.Button
                  onClick={() => setIsSaleExpanded(!open)}
                  className='flex items-center gap-2 text-primary hover:text-primary/80 font-medium'
                >
                  {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  Sale Information
                </Disclosure.Button>

                <Disclosure.Panel className='mt-4 space-y-4'>
                  <div className='p-3 bg-muted/50 rounded-md text-sm text-muted-foreground'>
                    Enter all three fields to record a sale, or leave all empty
                    for unsold holdings.
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <Label htmlFor='salePrice'>Sale Price</Label>
                      <Controller
                        name='salePrice'
                        control={control}
                        render={({ field: { value, onChange } }) => (
                          <NumericFormat
                            value={value ?? ''}
                            onValueChange={(values) =>
                              onChange(values.floatValue ?? null)
                            }
                            thousandSeparator=','
                            decimalScale={2}
                            fixedDecimalScale
                            prefix='$'
                            placeholder='$0.00'
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                          />
                        )}
                      />
                      {(errors as any).salePrice && (
                        <p className='mt-1 text-sm text-red-600'>
                          {(errors as any).salePrice?.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor='saleDate'>Sale Date</Label>
                      <input
                        {...register('saleDate')}
                        type='date'
                        className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                      />
                      {(errors as any).saleDate && (
                        <p className='mt-1 text-sm text-red-600'>
                          {(errors as any).saleDate?.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor='soldQuantity'>Sold Quantity</Label>
                      <Controller
                        name='soldQuantity'
                        control={control}
                        render={({ field: { value, onChange } }) => (
                          <NumericFormat
                            value={value ?? ''}
                            onValueChange={(values) =>
                              onChange(values.floatValue ?? null)
                            }
                            thousandSeparator=','
                            decimalScale={6}
                            fixedDecimalScale
                            placeholder='0.000000'
                            className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
                          />
                        )}
                      />
                      {(errors as any).soldQuantity && (
                        <p className='mt-1 text-sm text-red-600'>
                          {(errors as any).soldQuantity?.message}
                        </p>
                      )}
                    </div>
                  </div>
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>

          {/* General Validation Error */}
          {Object.keys(errors).length > 0 &&
            !Object.values(errors).some((e) => e?.message) && (
              <div className='p-3 bg-red-50 rounded-md text-sm text-red-700'>
                Please check all required fields and fix the errors above.
              </div>
            )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant='secondary' onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant='primary'
            type='submit'
            disabled={
              isSubmitting || createHolding.isPending || updateHolding.isPending
            }
          >
            {isSubmitting
              ? 'Saving...'
              : isEditMode
                ? 'Update Holding'
                : 'Add Holding'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
