import { useEffect, useState } from "react";
import { isValidHex } from "../utils/color";

const EMPTY = {
  vendor: "",
  threadBrand: "",
  threadCode: "",
  threadColorName: "",
  threadHex: "",
  pmsCode: "",
  pmsName: "",
  pmsHex: "",
  notes: "",
};

/**
 * @param {{
 *   initialValue?: Partial<import('../types').ColorMapping>,
 *   vendors: string[],
 *   onSubmit: (values: typeof EMPTY) => Promise<void>,
 *   onCancel: () => void,
 *   submitLabel?: string,
 *   serverErrors?: Record<string, string>,
 * }} props
 */
export default function RecordForm({ initialValue, vendors, onSubmit, onCancel, submitLabel = "Save", serverErrors }) {
  const [values, setValues] = useState({ ...EMPTY, ...initialValue });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [useNewVendor, setUseNewVendor] = useState(!vendors.includes(initialValue?.vendor ?? ""));

  useEffect(() => {
    setErrors(serverErrors ?? {});
  }, [serverErrors]);

  function update(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!values.vendor.trim()) next.vendor = "Vendor is required.";
    if (!values.threadBrand.trim()) next.threadBrand = "Thread brand is required.";
    if (!values.threadCode.trim()) next.threadCode = "Thread code is required.";
    if (values.threadHex && !isValidHex(values.threadHex)) next.threadHex = "Use a hex color like #b3242a.";
    if (values.pmsHex && !isValidHex(values.pmsHex)) next.pmsHex = "Use a hex color like #c93a2f.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      if (err?.fieldErrors) setErrors(err.fieldErrors);
      else setErrors({ form: err?.message ?? "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit} noValidate>
      {errors.form && (
        <p className="form-error" role="alert">
          {errors.form}
        </p>
      )}

      <div className="record-form__grid">
        <div className="field">
          <label htmlFor="rf-vendor" className="field__label">
            Vendor <span aria-hidden="true">*</span>
          </label>
          {useNewVendor || vendors.length === 0 ? (
            <input
              id="rf-vendor"
              className="field__control"
              value={values.vendor}
              onChange={(e) => update("vendor", e.target.value)}
              aria-invalid={Boolean(errors.vendor)}
              aria-describedby={errors.vendor ? "rf-vendor-error" : undefined}
            />
          ) : (
            <select
              id="rf-vendor"
              className="field__control"
              value={values.vendor}
              onChange={(e) => update("vendor", e.target.value)}
              aria-invalid={Boolean(errors.vendor)}
            >
              <option value="">Select a vendor...</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
          {vendors.length > 0 && (
            <button type="button" className="field__link-btn" onClick={() => setUseNewVendor((v) => !v)}>
              {useNewVendor ? "Choose existing vendor" : "+ Add new vendor"}
            </button>
          )}
          {errors.vendor && (
            <span className="field__error" id="rf-vendor-error" role="alert">
              {errors.vendor}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="rf-brand" className="field__label">
            Thread Brand <span aria-hidden="true">*</span>
          </label>
          <input
            id="rf-brand"
            className="field__control"
            value={values.threadBrand}
            onChange={(e) => update("threadBrand", e.target.value)}
            aria-invalid={Boolean(errors.threadBrand)}
          />
          {errors.threadBrand && (
            <span className="field__error" role="alert">
              {errors.threadBrand}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="rf-code" className="field__label">
            Thread Code <span aria-hidden="true">*</span>
          </label>
          <input
            id="rf-code"
            className="field__control"
            value={values.threadCode}
            onChange={(e) => update("threadCode", e.target.value)}
            aria-invalid={Boolean(errors.threadCode)}
          />
          {errors.threadCode && (
            <span className="field__error" role="alert">
              {errors.threadCode}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="rf-color-name" className="field__label">
            Thread Color Name
          </label>
          <input
            id="rf-color-name"
            className="field__control"
            value={values.threadColorName}
            onChange={(e) => update("threadColorName", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="rf-thread-hex" className="field__label">
            Thread Hex
          </label>
          <input
            id="rf-thread-hex"
            className="field__control"
            placeholder="#b3242a"
            value={values.threadHex}
            onChange={(e) => update("threadHex", e.target.value)}
            aria-invalid={Boolean(errors.threadHex)}
          />
          {errors.threadHex && (
            <span className="field__error" role="alert">
              {errors.threadHex}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="rf-pms-code" className="field__label">
            PMS Code
          </label>
          <input
            id="rf-pms-code"
            className="field__control"
            placeholder="162"
            value={values.pmsCode}
            onChange={(e) => update("pmsCode", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="rf-pms-name" className="field__label">
            PMS Name
          </label>
          <input
            id="rf-pms-name"
            className="field__control"
            placeholder="PMS 162 C"
            value={values.pmsName}
            onChange={(e) => update("pmsName", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="rf-pms-hex" className="field__label">
            PMS Hex
          </label>
          <input
            id="rf-pms-hex"
            className="field__control"
            placeholder="#c93a2f"
            value={values.pmsHex}
            onChange={(e) => update("pmsHex", e.target.value)}
            aria-invalid={Boolean(errors.pmsHex)}
          />
          {errors.pmsHex && (
            <span className="field__error" role="alert">
              {errors.pmsHex}
            </span>
          )}
        </div>

        <div className="field field--span2">
          <label htmlFor="rf-notes" className="field__label">
            Notes
          </label>
          <textarea
            id="rf-notes"
            className="field__control"
            rows={2}
            value={values.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>
      </div>

      <div className="record-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
