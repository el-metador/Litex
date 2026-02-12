const MIN_OVERLAP_LENGTH = 8;
const MAX_OVERLAP_LENGTH = 4_096;

export function mergeContinuationText(aggregatedText: string, nextSegmentText: string) {
  if (!aggregatedText) {
    return nextSegmentText;
  }

  if (!nextSegmentText) {
    return aggregatedText;
  }

  if (aggregatedText === nextSegmentText) {
    return aggregatedText;
  }

  if (nextSegmentText.startsWith(aggregatedText)) {
    return nextSegmentText;
  }

  if (aggregatedText.endsWith(nextSegmentText)) {
    return aggregatedText;
  }

  const overlapUpperBound = Math.min(aggregatedText.length, nextSegmentText.length, MAX_OVERLAP_LENGTH);

  for (let overlapLength = overlapUpperBound; overlapLength >= MIN_OVERLAP_LENGTH; overlapLength -= 1) {
    const previousSuffix = aggregatedText.slice(-overlapLength);
    const nextPrefix = nextSegmentText.slice(0, overlapLength);

    if (previousSuffix === nextPrefix) {
      return aggregatedText + nextSegmentText.slice(overlapLength);
    }
  }

  return aggregatedText + nextSegmentText;
}
