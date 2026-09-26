import { Header } from "@/components/Header";
import { LeaderboardList } from "@/components/LeaderboardList";

export const metadata = {
  title: "Leaderboard | du'aOS",
  description: "The most invoked Names of Allah across everyone using du'aOS.",
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-transparent text-slate-800 dark:text-slate-200 flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-8 sm:py-12 pt-24 sm:pt-28 pb-[env(safe-area-inset-bottom)]">
        <header className="mb-8 sm:mb-10">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
            Most invoked Names
          </h1>
          <p className="font-github text-sm text-slate-500 dark:text-slate-400">
            Across everyone using du&apos;aOS, updated every few minutes.
          </p>
        </header>
        <LeaderboardList />
      </main>
    </div>
  );
}
