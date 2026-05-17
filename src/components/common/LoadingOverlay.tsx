interface LoadingOverlayProps {
  message?: string;
}

export default function LoadingOverlay({ message = '加载中...' }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <div className="flex flex-col items-center gap-4">
        <div className="loading-spinner" />
        <p className="text-ds-sm text-txs font-ds-medium">{message}</p>
      </div>
    </div>
  );
}
