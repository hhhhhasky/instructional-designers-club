import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const HAI_EXIT_PATH_KEY = "hai-exit-path";

export function useHaiExit() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fromSite = (location.state as { fromSite?: unknown } | null)?.fromSite;
    if (typeof fromSite === "string" && fromSite.startsWith("/") && !fromSite.startsWith("/hai")) {
      sessionStorage.setItem(HAI_EXIT_PATH_KEY, fromSite);
    }
  }, [location.state]);

  return useCallback(() => {
    const target = sessionStorage.getItem(HAI_EXIT_PATH_KEY);
    navigate(target && target.startsWith("/") && !target.startsWith("/hai") ? target : "/");
  }, [navigate]);
}
