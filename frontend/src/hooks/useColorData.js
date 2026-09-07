import { useEffect, useState } from "react";
import { getAllRecords, subscribe } from "../services/colorService";

/**
 * Subscribes to the color-mapping database and keeps `records` in sync
 * with every mutation (admin edits, CSV import, etc.) for the lifetime of
 * the component — the "dynamic updates" contract for the data layer.
 */
export function useColorData() {
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getAllRecords()
      .then((data) => {
        if (cancelled) return;
        setRecords(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setStatus("error");
      });

    const unsubscribe = subscribe((next) => setRecords([...next]));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { records, status, error };
}
