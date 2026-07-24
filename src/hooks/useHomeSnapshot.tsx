import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getCachedHomePageSnapshot,
  getHomePageSnapshot,
  type HomePageSnapshot,
} from "@/db/api";

type HomeSnapshotState = {
  snapshot: HomePageSnapshot | null;
  loading: boolean;
  error: Error | null;
};

const HomeSnapshotContext = createContext<HomeSnapshotState | null>(null);

export function HomeSnapshotProvider({ children }: { children: ReactNode }) {
  const cached = getCachedHomePageSnapshot();
  const [state, setState] = useState<HomeSnapshotState>({
    snapshot: cached,
    loading: !cached,
    error: null,
  });

  useEffect(() => {
    let active = true;
    getHomePageSnapshot()
      .then((snapshot) => {
        if (active) setState({ snapshot, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          snapshot: null,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <HomeSnapshotContext.Provider value={state}>
      {children}
    </HomeSnapshotContext.Provider>
  );
}

export function useHomeSnapshot(): HomeSnapshotState {
  const value = useContext(HomeSnapshotContext);
  if (!value) {
    throw new Error("useHomeSnapshot 必须在 HomeSnapshotProvider 内使用");
  }
  return value;
}
