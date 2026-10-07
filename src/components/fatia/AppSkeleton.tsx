import { Skeleton } from "@/components/ui/skeleton";

/** Page skeleton shown while the session and first queries load — never just the background. */
export function AppSkeleton() {
  return (
    <div className="min-h-screen md:flex" aria-busy="true" aria-label="Carregando">
      <aside className="glass m-5 hidden h-[calc(100vh-40px)] w-60 shrink-0 flex-col gap-2 rounded-[22px] p-4 md:flex">
        <Skeleton className="mb-4 h-7 w-28 rounded-xl" />
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
        <Skeleton className="mt-auto h-16 rounded-2xl" />
      </aside>
      <main className="flex-1 space-y-5 px-4 pt-6 md:px-8 md:pt-8">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
        <Skeleton className="h-40 rounded-[22px]" />
        <Skeleton className="h-56 rounded-[22px]" />
      </main>
    </div>
  );
}

/** Content-only skeleton for route changes inside the app layout. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-9 w-64 rounded-xl" />
      <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
      <Skeleton className="h-40 rounded-[22px]" />
      <Skeleton className="h-56 rounded-[22px]" />
    </div>
  );
}
