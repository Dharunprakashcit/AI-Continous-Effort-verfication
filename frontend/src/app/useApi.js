import { useCallback, useEffect, useState } from "react";
import api from "../api";

export default function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(path);
      setState({ data, error: null, loading: false });
    } catch (err) {
      setState({ data: null, error: err.response?.data?.error || "Could not load this page.", loading: false });
    }
  }, [path]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    load();
  }, [load]);

  return { ...state, reload: load };
}
