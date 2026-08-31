"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react";
import { choiceOptions, collapsedChoices, type ChoiceOption } from "./choice-layout";

type Props = {
  label: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  searchable?: boolean;
};

export function ChoiceChips({ label, options, value, onChange, disabled = false, searchable = false }: Props) {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [layout, setLayout] = useState({ count: 0, height: 96 });
  const all = useMemo(() => choiceOptions(options, value), [options, value]);
  const query = search.trim().toLocaleLowerCase();
  const matches = all.filter(item => !item.value || item.label.toLocaleLowerCase().includes(query));
  const signature = JSON.stringify(matches);
  const selectedIndex = matches.findIndex(item => item.value === value);
  const selected = all.find(item => item.value === value);
  const showAll = expanded || !!query;
  const selectedVisible = selectedIndex >= 0 && (showAll || selectedIndex < layout.count);
  const tabIndex = selectedVisible ? selectedIndex : 0;

  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const measure = () => {
      const next = collapsedChoices(Array.from(element.children, child => {
        const button = child as HTMLElement;
        return { top: button.offsetTop, height: button.offsetHeight };
      }));
      setLayout(current => current.count === next.count && current.height === next.height ? current : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [signature]);

  function navigate(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key) || disabled) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? matches.length - 1
      : (index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + matches.length) % matches.length;
    if (next >= layout.count) setExpanded(true);
    onChange(matches[next].value);
    requestAnimationFrame(() => (list.current?.children[next] as HTMLElement | undefined)?.focus());
  }

  return <div className="choice-field" data-disabled={disabled || undefined}>
    {searchable && <div className="choice-search">
      <Search size={16} aria-hidden="true" />
      <input aria-label={`搜尋${label}`} type="search" placeholder={`搜尋${label}…`} value={search}
        disabled={disabled} onChange={event => setSearch(event.target.value)} />
    </div>}
    <div className="choice-viewport" style={{ maxHeight: showAll ? 260 : layout.height + 4, overflowY: showAll ? "auto" : "hidden" }}>
      <div ref={list} id={id} className="choice-list" role="radiogroup" aria-label={label} aria-disabled={disabled}>
        {matches.map((item, index) => {
          const hidden = !showAll && index >= layout.count;
          return <button key={item.value} type="button" role="radio" aria-checked={value === item.value}
            aria-hidden={hidden || undefined} disabled={disabled} tabIndex={!hidden && index === tabIndex ? 0 : -1}
            className="choice-pill" style={hidden ? { visibility: "hidden" } : undefined}
            onClick={() => onChange(item.value)} onKeyDown={event => navigate(event, index)}>
            <Check size={14} aria-hidden="true" className="choice-check" /><span>{item.label}</span>
          </button>;
        })}
      </div>
    </div>
    {value && !selectedVisible && <p className="choice-current">已選：<strong>{selected?.label}</strong></p>}
    {query && matches.length === 1 && <p className="choice-hint" role="status">沒有符合的選項</p>}
    {!query && matches.length > layout.count && <button type="button" className="choice-more"
      disabled={disabled} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(current => !current)}>
      {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      {expanded ? "收合選項" : `展開全部（${all.length - 1}）`}
    </button>}
    {disabled && <p className="choice-hint">請先選擇大分類</p>}
  </div>;
}
