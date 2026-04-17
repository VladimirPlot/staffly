import React from "react";
import DropdownSelect from "./DropdownSelect";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export default function SelectField({ label, error, className = "", children, ...rest }: Props) {
  return (
    <DropdownSelect label={label} error={error} className={className} {...rest}>
      {children}
    </DropdownSelect>
  );
}
