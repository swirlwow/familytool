export type ChoiceOption = { value: string; label: string };

export function choiceOptions(options: ChoiceOption[], value: string) {
  const unique = Array.from(new Map(options.filter(item => item.value !== "").map(item => [item.value, item])).values());
  if (value && !unique.some(item => item.value === value)) unique.push({ value, label: `保留原值：${value}` });
  return [{ value: "", label: "不選" }, ...unique];
}

/** Measure actual wrapped rows, including long labels and font/viewport changes. */
export function collapsedChoices(boxes: { top: number; height: number }[]) {
  const rows: number[] = [];
  let count = 0;
  let height = 0;
  for (const box of boxes) {
    if (!rows.some(top => Math.abs(top - box.top) < 2)) rows.push(box.top);
    if (rows.length > 2) break;
    count++;
    height = Math.max(height, box.top + box.height);
  }
  return { count, height };
}
