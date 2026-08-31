import OptionSelector from "./OptionSelector";

/**
 * @param {{ vendors: string[], value: string, onChange: (vendor: string) => void, id?: string }} props
 */
export default function VendorSelector({ vendors, value, onChange, id = "vendor-selector" }) {
  return (
    <OptionSelector
      id={id}
      label="Vendor"
      allLabel="All Vendors"
      options={vendors}
      value={value}
      onChange={onChange}
    />
  );
}
