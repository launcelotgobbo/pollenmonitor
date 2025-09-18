'use client';

import { useState } from 'react';

type Props = {
  value?: string;
  onChange?: (value: string) => void;
};

export default function DatePicker({ value, onChange }: Props) {
  const [local, setLocal] = useState<string>(
    value || new Date().toISOString().slice(0, 10),
  );
  return (
    <input
      type="date"
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        onChange?.(e.target.value);
      }}
    />
  );
}

