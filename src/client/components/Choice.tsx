import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";

/** A labelled pick from a short list. */
export function Choice({
  id,
  testId,
  value,
  items,
  onChange,
  placeholder,
  disabled,
}: {
  id?: string;
  testId: string;
  value: string;
  items: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      items={items}
      value={value || null}
      onValueChange={(next) => {
        if (next !== null) onChange(String(next));
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} data-testid={testId} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
