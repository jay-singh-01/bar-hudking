import BottomSheet from "./BottomSheet";

interface FilterSheetProps {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}

function formatLabel(value: string) {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

export default function FilterSheet({
  title,
  options,
  selected,
  onChange,
  onClose,
}: FilterSheetProps) {
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={
        selected.length > 0 ? (
          <button
            onClick={() => onChange([])}
            className="text-left text-sm text-slate-400 underline underline-offset-2"
          >
            Clear {title.toLowerCase()}
          </button>
        ) : undefined
      }
    >
      <ul className="flex flex-col gap-1">
        {options.map((option) => (
          <li key={option}>
            <label className="flex items-center gap-3 rounded-lg px-2 py-2 active:bg-slate-800">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                className="h-4 w-4 accent-brand"
              />
              <span className="text-sm text-slate-200">{formatLabel(option)}</span>
            </label>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
