// Simple constrained date input: today-or-future only (Workflow v2.5 §4.1).
// A plain <input type="date"> with a min bound is enough here; the fuller
// prototype used a custom calendar popover purely for visual parity — this
// keeps the same constraint with native browser affordances.
export default function DateField({ value, onChange, min, label, required }) {
  return (
    <div className="field">
      {label && <label>{label} {required && <span className="req">*</span>}</label>}
      <input
        type="date"
        className="inp calbtn"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
