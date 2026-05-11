export function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`glass-card animate-pulse p-4 ${className}`}><div className="h-4 w-1/3 rounded bg-secondary/60" /><div className="mt-3 h-8 w-1/2 rounded bg-secondary/60" /></div>;
}
