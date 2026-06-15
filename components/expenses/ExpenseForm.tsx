'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateShareSplit,
  calculateUnequalSplit,
  roundToTwo,
} from '@/lib/splitCalculator';
import {
  createExpenseSchema,
  type ExpenseFormValues,
  type SplitType,
  USD_TO_INR_RATE,
} from '@/types/expenses';

type ExpenseFormProps = {
  groupId: string;
  members: Array<{
    id: string;
    name: string;
    joinedAt: Date;
    leftAt: Date | null;
  }>;
  defaultValues?: Partial<ExpenseFormValues>;
  onSubmit: (data: ExpenseFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  mode: 'create' | 'edit';
};

function isActiveOnDate(
  member: { joinedAt: Date; leftAt: Date | null },
  dateValue: string
) {
  const expenseDate = new Date(`${dateValue}T00:00:00.000Z`);
  return member.joinedAt <= expenseDate && (!member.leftAt || member.leftAt >= expenseDate);
}

function buildSplitDetails(
  splitType: SplitType,
  memberIds: string[],
  previousDetails: ExpenseFormValues['splitDetails']
) {
  if (splitType === 'equal') {
    return [];
  }

  return memberIds.map((userId) => {
    const previous = previousDetails.find((detail) => detail.userId === userId);

    if (splitType === 'unequal') {
      return {
        userId,
        amountOwed: previous?.amountOwed ?? 0,
      };
    }

    if (splitType === 'percentage') {
      return {
        userId,
        percentage: previous?.percentage ?? 0,
      };
    }

    return {
      userId,
      splitRatio: previous?.splitRatio ?? 1,
    };
  });
}

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ExpenseForm({
  members,
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
  mode,
}: ExpenseFormProps) {
  const { data: session } = useSession();
  const previousDateRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
    control,
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(createExpenseSchema),
    mode: 'onChange',
    defaultValues: {
      description: defaultValues?.description ?? '',
      expenseDate: defaultValues?.expenseDate ?? format(new Date(), 'yyyy-MM-dd'),
      paidByUserId: defaultValues?.paidByUserId ?? '',
      amount: defaultValues?.amount ?? 0,
      currency: defaultValues?.currency ?? 'INR',
      splitType: defaultValues?.splitType ?? 'equal',
      splitWith: defaultValues?.splitWith ?? [],
      splitDetails: defaultValues?.splitDetails ?? [],
      notes: defaultValues?.notes ?? '',
    },
  });

  const description = useWatch({ control, name: 'description' });
  const expenseDate = useWatch({ control, name: 'expenseDate' });
  const paidByUserId = useWatch({ control, name: 'paidByUserId' });
  const amount = useWatch({ control, name: 'amount' });
  const currency = useWatch({ control, name: 'currency' });
  const splitType = useWatch({ control, name: 'splitType' });
  const splitWith = useWatch({ control, name: 'splitWith' });
  const splitDetails = useWatch({ control, name: 'splitDetails' });

  const activeMembers = useMemo(
    () => members.filter((member) => isActiveOnDate(member, expenseDate)),
    [expenseDate, members]
  );

  useEffect(() => {
    if (!paidByUserId && session?.user?.id) {
      setValue('paidByUserId', session.user.id, { shouldValidate: true });
    }
  }, [paidByUserId, session?.user?.id, setValue]);

  useEffect(() => {
    if (!expenseDate) {
      return;
    }

    const activeIds = activeMembers.map((member) => member.id);
    const dateChanged = previousDateRef.current !== null && previousDateRef.current !== expenseDate;
    previousDateRef.current = expenseDate;

    let nextSplitWith = splitWith.filter((userId) => activeIds.includes(userId));

    if (
      nextSplitWith.length === 0 ||
      (mode === 'create' && (dateChanged || splitWith.length === 0))
    ) {
      nextSplitWith = activeIds;
    }

    if (JSON.stringify(nextSplitWith) !== JSON.stringify(splitWith)) {
      setValue('splitWith', nextSplitWith, { shouldValidate: true, shouldDirty: true });
    }

    const activePaidBy = activeIds.includes(paidByUserId)
      ? paidByUserId
      : activeIds.includes(session?.user?.id ?? '')
        ? (session?.user?.id as string)
        : activeIds[0] ?? '';

    if (activePaidBy !== paidByUserId) {
      setValue('paidByUserId', activePaidBy, { shouldValidate: true, shouldDirty: true });
    }
  }, [
    activeMembers,
    expenseDate,
    mode,
    paidByUserId,
    session?.user?.id,
    setValue,
    splitWith,
  ]);

  useEffect(() => {
    const nextDetails = buildSplitDetails(splitType, splitWith, splitDetails);
    if (JSON.stringify(nextDetails) !== JSON.stringify(splitDetails)) {
      setValue('splitDetails', nextDetails, { shouldValidate: true, shouldDirty: true });
    }
  }, [setValue, splitDetails, splitType, splitWith]);

  const amountInr = currency === 'USD' ? roundToTwo((amount || 0) * USD_TO_INR_RATE) : roundToTwo(amount || 0);

  const preview = useMemo(() => {
    if (!splitWith.length || !amountInr) {
      return {
        result: {} as Record<string, number>,
        unequalDiff: 0,
        totalPercentage: 0,
      };
    }

    if (splitType === 'equal') {
      return {
        result: calculateEqualSplit(amountInr, splitWith),
        unequalDiff: 0,
        totalPercentage: 100,
      };
    }

    if (splitType === 'unequal') {
      const unequalSplits = splitWith.map((userId) => ({
        userId,
        amountOwed:
          splitDetails.find((detail) => detail.userId === userId)?.amountOwed ?? 0,
      }));
      const unequal = calculateUnequalSplit(amountInr, unequalSplits);
      return {
        result: unequal.result,
        unequalDiff: unequal.diff,
        totalPercentage: 100,
      };
    }

    if (splitType === 'percentage') {
      const percentageSplits = splitWith.map((userId) => ({
        userId,
        percentage:
          splitDetails.find((detail) => detail.userId === userId)?.percentage ?? 0,
      }));
      const percentage = calculatePercentageSplit(amountInr, percentageSplits);
      return {
        result: percentage.result,
        unequalDiff: 0,
        totalPercentage: percentage.totalPercentage,
      };
    }

    const shareSplits = splitWith.map((userId) => ({
      userId,
      ratio: splitDetails.find((detail) => detail.userId === userId)?.splitRatio ?? 1,
    }));

    return {
      result: calculateShareSplit(amountInr, shareSplits),
      unequalDiff: 0,
      totalPercentage: 100,
    };
  }, [amountInr, splitDetails, splitType, splitWith]);

  const shareTotal = splitDetails.reduce(
    (total, detail) => total + (detail.splitRatio ?? 0),
    0
  );
  const paidByOutsideSplit =
    paidByUserId &&
    splitWith.length > 0 &&
    !splitWith.includes(paidByUserId);
  const unequalInvalid = splitType === 'unequal' && Math.abs(preview.unequalDiff) > 0.01;
  const percentageInvalid =
    splitType === 'percentage' && Math.abs(preview.totalPercentage - 100) > 0.01;
  const shareInvalid =
    splitType === 'share' &&
    splitWith.some(
      (userId) =>
        (splitDetails.find((detail) => detail.userId === userId)?.splitRatio ?? 0) <= 0
    );

  const canSubmit =
    isValid &&
    !unequalInvalid &&
    !percentageInvalid &&
    !shareInvalid &&
    splitWith.length > 0 &&
    !!description.trim() &&
    !!expenseDate &&
    !!paidByUserId &&
    !!amount &&
    amount > 0;

  const memberMap = new Map(members.map((member) => [member.id, member]));

  const submitForm = async (values: ExpenseFormValues) => {
    const details = splitWith.map((userId) => {
      const detail = splitDetails.find((item) => item.userId === userId);
      return {
        userId,
        amountOwed: detail?.amountOwed,
        percentage: detail?.percentage,
        splitRatio: detail?.splitRatio,
      };
    });

    await onSubmit({
      ...values,
      description: values.description.trim(),
      notes: values.notes?.trim() || undefined,
      splitWith,
      splitDetails: splitType === 'equal' ? [] : details,
      amount: Number(values.amount),
    });
  };

  const updateSplitMember = (userId: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...splitWith, userId]))
      : splitWith.filter((memberId) => memberId !== userId);
    setValue('splitWith', next, { shouldValidate: true, shouldDirty: true });
  };

  const updateDetail = (
    userId: string,
    key: 'amountOwed' | 'percentage' | 'splitRatio',
    value: number
  ) => {
    const nextDetails = buildSplitDetails(splitType, splitWith, splitDetails).map((detail) =>
      detail.userId === userId ? { ...detail, [key]: value } : detail
    );
    setValue('splitDetails', nextDetails, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <Input
            id="description"
            label="Description"
            placeholder="e.g. February rent, Groceries, Dinner"
            maxLength={200}
            disabled={isLoading}
            error={errors.description?.message}
            {...register('description')}
          />

          <Input
            id="expenseDate"
            label="Date"
            type="date"
            disabled={isLoading}
            error={errors.expenseDate?.message}
            {...register('expenseDate')}
          />

          <div className="space-y-1">
            <label htmlFor="paidByUserId" className="block text-sm font-medium text-gray-300">
              Paid By
            </label>
            <select
              id="paidByUserId"
              value={paidByUserId}
              disabled={isLoading}
              onChange={(event) =>
                setValue('paidByUserId', event.target.value, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            {errors.paidByUserId && (
              <p className="text-sm text-red-400">{errors.paidByUserId.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div className="space-y-1">
              <label htmlFor="amount" className="block text-sm font-medium text-gray-300">
                Amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {currency === 'USD' ? '$' : '₹'}
                </span>
                <input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  disabled={isLoading}
                  {...register('amount', { valueAsNumber: true })}
                  className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 pl-8 pr-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {errors.amount && <p className="text-sm text-red-400">{errors.amount.message}</p>}
            </div>

            <div className="space-y-1">
              <label htmlFor="currency" className="block text-sm font-medium text-gray-300">
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                disabled={isLoading}
                onChange={(event) =>
                  setValue('currency', event.target.value as 'INR' | 'USD', {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {currency === 'USD' && (
            <p className="text-sm text-gray-400">
              Will be converted at ₹83.5 per USD. Stored in INR as {formatInr(amountInr)}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="splitType" className="block text-sm font-medium text-gray-300">
              Split Type
            </label>
            <select
              id="splitType"
              value={splitType}
              disabled={isLoading}
              onChange={(event) =>
                setValue('splitType', event.target.value as SplitType, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="equal">Equal</option>
              <option value="unequal">Unequal</option>
              <option value="percentage">Percentage</option>
              <option value="share">Share</option>
            </select>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-300">Split With</p>
              <p className="mt-1 text-xs text-gray-500">
                Only members active on {expenseDate || 'the selected date'} are shown.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
              {activeMembers.map((member) => {
                const checked = splitWith.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className="flex items-start gap-3 rounded-md border border-transparent px-1 py-1.5 hover:border-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isLoading}
                      onChange={(event) => updateSplitMember(member.id, event.target.checked)}
                      className="mt-1 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-white">{member.name}</span>
                      <span className="block text-xs text-gray-500">
                        joined {format(new Date(member.joinedAt), 'MMM d')}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.splitWith && <p className="text-sm text-red-400">{errors.splitWith.message}</p>}
            {paidByOutsideSplit && (
              <p className="text-sm text-yellow-300">
                Paid by {memberMap.get(paidByUserId)?.name ?? 'this member'} is not in the split.
                They will not be included as owing anything.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-300">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              maxLength={500}
              disabled={isLoading}
              {...register('notes')}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {errors.notes && <p className="text-sm text-red-400">{errors.notes.message}</p>}
          </div>
        </div>

        <div className="space-y-4">
          {splitType !== 'equal' && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <h3 className="text-sm font-semibold text-white">Split Details</h3>
              <div className="mt-4 space-y-3">
                {splitWith.map((userId) => {
                  const member = memberMap.get(userId);
                  const detail = splitDetails.find((item) => item.userId === userId);

                  if (!member) {
                    return null;
                  }

                  if (splitType === 'unequal') {
                    return (
                      <div key={userId} className="grid grid-cols-[minmax(0,1fr)_140px_auto] items-center gap-3">
                        <span className="text-sm text-gray-300">{member.name}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={detail?.amountOwed ?? 0}
                          onChange={(event) =>
                            updateDetail(userId, 'amountOwed', Number(event.target.value))
                          }
                          className="h-10 rounded-md border border-gray-700 bg-gray-900 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-400">₹</span>
                      </div>
                    );
                  }

                  if (splitType === 'percentage') {
                    const percentage = detail?.percentage ?? 0;
                    return (
                      <div key={userId} className="grid grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] items-center gap-3">
                        <span className="text-sm text-gray-300">{member.name}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={percentage}
                            onChange={(event) =>
                              updateDetail(userId, 'percentage', Number(event.target.value))
                            }
                            className="h-10 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-400">%</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {percentage}% → {formatInr(preview.result[userId] ?? 0)}
                        </span>
                      </div>
                    );
                  }

                  const ratio = detail?.splitRatio ?? 1;
                  return (
                    <div key={userId} className="grid grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] items-center gap-3">
                      <span className="text-sm text-gray-300">{member.name}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={ratio}
                          onChange={(event) =>
                            updateDetail(userId, 'splitRatio', Number(event.target.value))
                          }
                          className="h-10 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-400">shares</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        → {formatInr(preview.result[userId] ?? 0)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {splitType === 'unequal' && (
                <div className="mt-4 border-t border-gray-700 pt-4 text-sm">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Total</span>
                    <span>{formatInr(amountInr)}</span>
                  </div>
                  <div
                    className={`mt-2 flex items-center justify-between ${unequalInvalid ? 'text-red-400' : 'text-gray-300'}`}
                  >
                    <span>Remaining</span>
                    <span>{formatInr(preview.unequalDiff)}</span>
                  </div>
                </div>
              )}

              {splitType === 'percentage' && (
                <div className="mt-4 border-t border-gray-700 pt-4">
                  <div
                    className={`flex items-center justify-between text-sm ${percentageInvalid ? 'text-red-400' : 'text-gray-300'}`}
                  >
                    <span>Total</span>
                    <span>{preview.totalPercentage}%</span>
                  </div>
                  {percentageInvalid && (
                    <p className="mt-2 text-sm text-red-400">Percentages must sum to 100%</p>
                  )}
                </div>
              )}

              {splitType === 'share' && (
                <div className="mt-4 flex items-center justify-between border-t border-gray-700 pt-4 text-sm text-gray-300">
                  <span>Total shares</span>
                  <span>{shareTotal}</span>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-indigo-800 bg-indigo-950/50 p-4">
            <h3 className="text-sm font-semibold text-white">Split Preview</h3>
            <div className="mt-4 space-y-2">
              {splitWith.map((userId) => {
                const member = memberMap.get(userId);
                if (!member) {
                  return null;
                }

                return (
                  <div key={userId} className="flex items-center justify-between text-sm">
                    <div className="text-gray-200">
                      {member.name}
                      {userId === paidByUserId && (
                        <span className="ml-2 text-xs text-green-400">(you paid)</span>
                      )}
                      {paidByUserId && userId !== paidByUserId && (
                        <span className="ml-2 text-xs text-gray-500">owes {memberMap.get(paidByUserId)?.name ?? 'payer'}</span>
                      )}
                    </div>
                    <span className="font-medium text-white">
                      {formatInr(preview.result[userId] ?? 0)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-indigo-900 pt-4 text-sm font-semibold text-white">
              <span>Total</span>
              <span>{formatInr(amountInr)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading} disabled={!canSubmit}>
          {mode === 'create' ? 'Add Expense' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
