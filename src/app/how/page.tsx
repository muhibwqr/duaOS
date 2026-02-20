import Link from "next/link";
import { Header } from "@/components/Header";

export const metadata = {
  title: "How it works | du'aOS",
  description: "A structured path to spiritual certainty — semantic mapping, refinement, and your personal du'a library.",
};

export default function HowPage() {
  return (
    <div className="min-h-screen bg-transparent text-slate-800 dark:text-slate-200 flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-12 pt-28">
        <header className="mb-10">
          <h1 className="font-serif text-3xl font-medium text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
            How it works
          </h1>
          <p className="font-github text-sm text-slate-500 dark:text-slate-400">
            A structured path to spiritual certainty
          </p>
        </header>

        <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed mb-10 text-[1.05rem]">
          The architecture of du&apos;aOS is rooted in the beauty of the Asmaul Husna and the logic of a personal library. It functions as a bridge between your current reality and the timeless attributes of the Divine. The process is designed to be intentional and reflective.
        </p>

        <section className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)] mb-6">
          <h2 className="font-serif text-xl font-medium text-slate-800 dark:text-slate-100 mb-4 text-emerald-600 dark:text-emerald-400">
            Identifying intent
          </h2>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            You begin by selecting one of three distinct paths.
          </p>
          <h3 className="font-github text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 mt-5">
            Three modes
          </h3>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            You can search based on a <strong className="text-slate-800 dark:text-slate-200">Problem</strong> you need to solve, a <strong className="text-slate-800 dark:text-slate-200">Goal</strong> you are striving to reach, or a <strong className="text-slate-800 dark:text-slate-200">Current Du&apos;a</strong> that you wish to refine into a more prophetic form.
          </p>
          <h3 className="font-github text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 mt-5">
            Semantic mapping
          </h3>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            The system uses a high-performance vector database to instantly associate your words with the 99 Names of Allah and relevant Hadith.
          </p>
          <h3 className="font-github text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 mt-5">
            Understanding attributes
          </h3>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed">
            This logic is inspired by the teachings of scholars like Sheikh Mikaeel Smith, who emphasize understanding the specific personality of Allah&apos;s attributes.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)] mb-6">
          <h2 className="font-serif text-xl font-medium text-slate-800 dark:text-slate-100 mb-4 text-emerald-600 dark:text-emerald-400">
            The refinement layer
          </h2>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            Our spiritual editor takes your input along with the matched Name and Hadith to suggest a refined version of your prayer.
          </p>
          <h3 className="font-github text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 mt-5">
            Prophetic etiquette
          </h3>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed">
            This refinement follows the Prophetic etiquette of starting with praise and using the specific Names that are most relevant to your petition.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)] mb-6">
          <h2 className="font-serif text-xl font-medium text-slate-800 dark:text-slate-100 mb-4 text-emerald-600 dark:text-emerald-400">
            Building your library
          </h2>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            Every du&apos;a you refine can be saved to your private and secure journal.
          </p>
          <h3 className="font-github text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 mt-5">
            Spiritual record
          </h3>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            This allows you to maintain a living record of your conversations with Allah.
          </p>
          <h3 className="font-github text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 mt-5">
            Tracking mercy
          </h3>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            You have the ability to mark these prayers as Answered over time.
          </p>
          <h3 className="font-github text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 mt-5">
            Developing Yaqeen
          </h3>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            This feature is vital because it creates a visual history of Allah&apos;s mercy in your life.
          </p>
          <h3 className="font-github text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 mt-5">
            Witnessing response
          </h3>
          <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed">
            It transforms your prayer experience from a fleeting moment into a record of certainty, or Yaqeen, as you witness exactly how your Lord has responded to you over the months and years.
          </p>
        </section>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 mt-8 font-github text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        >
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
