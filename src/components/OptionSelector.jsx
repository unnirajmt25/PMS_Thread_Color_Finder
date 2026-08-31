/**
 * Generic labeled dropdown with an "All ..." option, used for both the
 * vendor picker and the thread-chart (brand) picker.
 *
 * @param {{
 *   label: string,
 *   allLabel: string,
 *   options: string[],
 *   value: string,
 *   onChange: (value: string) => void,
 *   id: string,
 *   disabled?: boolean,
 * }} props
 */
export default function OptionSelector({ label, allLabel, options, value, onChange, id, disabled }) {
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <select
        id={id}
        className="field__control"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
