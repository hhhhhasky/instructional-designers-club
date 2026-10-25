import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useHaiExit() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(() => {
    if (location.pathname.startsWith("/hai/work/") || (location.pathname === "/hai/work" && location.state?.imagePpt)) {
      navigate("/hai/work", { state: { newTask: true } });
      return;
    }
    navigate("/");
  }, [navigate, location.pathname, location.state]);
}
