import type { ChangeEvent, ReactNode } from "react";
import "./Select.css";

type SelectProps = {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: ReactNode;
};

export function Select({ value, onChange, disabled, children }: SelectProps) {
  return (
    <select className="Select" value={value} onChange={onChange} disabled={disabled}>
      {children}
    </select>
  );
}
