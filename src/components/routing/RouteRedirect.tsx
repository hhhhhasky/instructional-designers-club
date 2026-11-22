import { Navigate, useLocation } from "react-router-dom";

export default function RouteRedirect({ to, hash }: { to: string; hash?: string }) {
  const location = useLocation();
  return <Navigate
    to={{ pathname: to, search: location.search, hash: location.hash || hash }}
    state={location.state}
    replace
  />;
}
