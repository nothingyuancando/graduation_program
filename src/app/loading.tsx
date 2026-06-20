import { Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-slate-950">
      <header className="border-b border-slate-200 bg-[#fbfcf8]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#17231f] text-[#f6cf62]">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="mt-2 h-3 w-64" />
            </div>
          </div>
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 md:px-8 md:py-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="mt-5 h-12 w-full max-w-2xl" />
            <Skeleton className="mt-3 h-12 w-full max-w-xl" />
            <Skeleton className="mt-6 h-28 w-full rounded-lg" />
          </div>
          <div className="rounded-lg bg-[#17231f] p-6">
            <Skeleton className="h-5 w-36 bg-white/15" />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-lg bg-white/15" />
              <Skeleton className="h-20 rounded-lg bg-white/15" />
              <Skeleton className="h-20 rounded-lg bg-white/15" />
              <Skeleton className="h-20 rounded-lg bg-white/15" />
            </div>
          </div>
        </section>
        <Skeleton className="h-72 rounded-lg" />
      </main>
    </div>
  );
}
