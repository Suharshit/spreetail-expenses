export function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateEqualSplit(totalAmountInr: number, memberIds: string[]) {
  const result: Record<string, number> = {};
  let runningSum = 0;

  memberIds.forEach((memberId, index) => {
    if (index === memberIds.length - 1) {
      result[memberId] = roundToTwo(totalAmountInr - runningSum);
      return;
    }

    const amount = roundToTwo(totalAmountInr / memberIds.length);
    result[memberId] = amount;
    runningSum += amount;
  });

  return result;
}

export function calculateUnequalSplit(
  totalAmountInr: number,
  splits: Array<{ userId: string; amountOwed: number }>
) {
  const result: Record<string, number> = {};
  const sum = splits.reduce((total, split) => total + split.amountOwed, 0);
  const diff = roundToTwo(totalAmountInr - sum);

  splits.forEach((split) => {
    result[split.userId] = roundToTwo(split.amountOwed);
  });

  return {
    result,
    isValid: Math.abs(diff) <= 0.01,
    diff,
  };
}

export function calculatePercentageSplit(
  totalAmountInr: number,
  splits: Array<{ userId: string; percentage: number }>
) {
  const result: Record<string, number> = {};
  const totalPercentage = roundToTwo(
    splits.reduce((total, split) => total + split.percentage, 0)
  );
  let runningSum = 0;

  splits.forEach((split, index) => {
    if (index === splits.length - 1) {
      result[split.userId] = roundToTwo(totalAmountInr - runningSum);
      return;
    }

    const amount = roundToTwo((split.percentage / 100) * totalAmountInr);
    result[split.userId] = amount;
    runningSum += amount;
  });

  return {
    result,
    isValid: Math.abs(totalPercentage - 100) <= 0.01,
    totalPercentage,
  };
}

export function calculateShareSplit(
  totalAmountInr: number,
  splits: Array<{ userId: string; ratio: number }>
) {
  const result: Record<string, number> = {};
  const totalRatio = splits.reduce((total, split) => total + split.ratio, 0);
  let runningSum = 0;

  splits.forEach((split, index) => {
    if (index === splits.length - 1) {
      result[split.userId] = roundToTwo(totalAmountInr - runningSum);
      return;
    }

    const amount = roundToTwo((split.ratio / totalRatio) * totalAmountInr);
    result[split.userId] = amount;
    runningSum += amount;
  });

  return result;
}

