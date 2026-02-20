import Link from "next/link";
import { Header } from "@/components/Header";

export const metadata = {
  title: "Why du'aOS? | du'aOS",
  description: "The journey from optimization to connection — why we built du'aOS to help Muslims find intentionality and certainty in their worship.",
};

export default function WhyPage() {
  return (
    <div className="min-h-screen bg-transparent text-slate-800 dark:text-slate-200 flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-8 sm:py-12 pt-24 sm:pt-28 pb-[env(safe-area-inset-bottom)]">
        <header className="mb-8 sm:mb-10">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
            Why du&apos;aOS?
          </h1>
          <p className="font-github text-sm text-slate-500 dark:text-slate-400">
            The journey from optimization to connection
          </p>
        </header>

        <article className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)]">
          <div className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed space-y-6 text-[1.05rem]">
            <p>
              As a student and a software engineer, my life has been built on the foundation of optimization. I have spent countless hours refining code, balancing complex technical stacks, and preparing for high-stakes interviews. In the world of engineering, we look for systems that are efficient and reliable. However, I noticed a profound disconnect when I turned away from my screen to engage in the most important conversation of my life. When it came to my du&apos;a, the process felt unstructured and often lacked the depth I knew was possible.
            </p>
            <p>
              Allah says in the Noble Qur&apos;an that to Him belong the Most Beautiful Names, so we should call on Him by them. I realized that while I knew this verse, I was not living it. I struggled to identify which specific Name of Allah matched my unique struggles. I found myself using basic LLMs to help me structure my thoughts, but a generic AI cannot grasp the spiritual weight of a Name like Al-Fattah when you are desperately seeking a new opening or the comfort of Ar-Razzaq when you are anxious about your future.
            </p>
            <p>
              Beyond the struggle of how to ask, I also faced the problem of consistency. I lacked a sacred space to note down my requests, which meant I often lost the history of my own spiritual journey. I would ask for a breakthrough and then forget the intensity of that moment once the relief arrived. I built du&apos;aOS to bridge this gap. It is a system designed to help you stop worrying about the mechanics of your prayer so you can focus entirely on the One you are asking. It is a tool for the modern Muslim to find intentionality and certainty in their worship.
            </p>
          </div>
        </article>

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
