interface LoadingOverlayProps {
  message?: string;
}

export default function LoadingOverlay({ message = '加载中...' }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <div className="flex flex-col items-center gap-4">
        <div className="loading-spinner" />
        <p className="text-sm text-muted-foreground font-medium">{message}</p>
      </div>
    </div>
  );
}
