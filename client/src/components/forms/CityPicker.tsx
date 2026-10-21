import { useState } from "react";
import { NEPAL_CITIES, OTHER_CITY } from "@sd/shared";
import { Input, Select } from "@/components/ui/form";

const isListed = (v: string) => (NEPAL_CITIES as readonly string[]).includes(v);

/**
 * City dropdown with an "Other" choice that reveals a text box, so common cities stay consistent
 * (good for matching and filters) while any place can still be entered.
 */
export function CityPicker({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [other, setOther] = useState(() => value !== "" && !isListed(value));
  const choice = other ? OTHER_CITY : value;
  return (
    <div className="space-y-2">
      <Select
        id={id}
        value={choice}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={onBlur}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER_CITY) {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(v);
          }
        }}
      >
        <option value="">Select a city</option>
        {NEPAL_CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={OTHER_CITY}>Other…</option>
      </Select>
      {other && (
        <Input
          aria-label="City name"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={invalid}
          placeholder="Type your city or town"
          maxLength={80}
        />
      )}
    </div>
  );
}
