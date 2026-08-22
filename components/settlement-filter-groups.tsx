"use client";

import { useState } from "react";

type FilterOption = { value: string; label: string };

function CheckboxGroup({
  legend,
  name,
  options,
  initial,
}: {
  legend: string;
  name: string;
  options: FilterOption[];
  initial: string[];
}) {
  const allowed = new Set(options.map((option) => option.value));
  const [selected, setSelected] = useState(() => initial.filter((value) => allowed.has(value)));
  const allSelected = options.length > 0 && selected.length === options.length;

  function toggleAll() {
    setSelected(allSelected ? [] : options.map((option) => option.value));
  }

  function toggle(value: string) {
    setSelected((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  return (
    <fieldset className="settlement-check-filter">
      <legend>{legend}</legend>
      <div>
        <label className="settlement-check-all">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          <span>모두선택</span>
        </label>
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettlementFilterGroups({
  paymentOptions,
  selectedPayments,
  statusOptions,
  selectedStatuses,
}: {
  paymentOptions: FilterOption[];
  selectedPayments: string[];
  statusOptions: FilterOption[];
  selectedStatuses: string[];
}) {
  return (
    <div className="settlement-filter-groups">
      <CheckboxGroup
        legend="결제방법"
        name="payment"
        options={paymentOptions}
        initial={selectedPayments}
      />
      <CheckboxGroup
        legend="처리상태"
        name="status"
        options={statusOptions}
        initial={selectedStatuses}
      />
    </div>
  );
}
