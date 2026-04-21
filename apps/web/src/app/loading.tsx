export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-accent/25 border-t-accent animate-spin" />
        <span className="text-sm text-foreground/40">Загрузка</span>
      </div>
    </div>
  );
}
