import Link from "next/link";
import { Header } from "@/components/Header";

export const metadata = {
  title: "How it works | du'aOS",
  description: "A structured path to spiritual certainty — semantic mapping, refinement, and your personal du'a ledger.",
};

export default function HowPage() {
  return (
    <div className="min-h-screen bg-transparent text-slate-200 flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-12 pt-28">
        <h1 className="text-2xl font-serif font-medium text-slate-100 mb-2">How it works</h1>
        <p className="text-slate-500 font-github text-sm mb-8">A Structured Path to Spiritual Certainty</p>

        <p className="font-serif text-slate-300 leading-relaxed mb-8">
          The architecture of du'aOS is rooted in the beauty of the Asmaul Husna and the logic of a personal ledger. It functions as a bridge between your current reality and the timeless attributes of the Divine. The process is designed to be intentional and reflective.
        </p>

        <section className="mb-8">
          <h2 className="text-lg font-serif font-medium text-slate-100 mb-3">Identifying Intent</h2>
          <p className="font-serif text-slate-300 leading-relaxed mb-4">
            You begin by selecting one of three distinct paths.
          </p>
          <h3 className="text-base font-github font-medium text-slate-200 mb-2">Three Modes</h3>
          <p className="font-serif text-slate-300 leading-relaxed mb-6">
            You can search based on a <strong>Problem</strong> you need to solve, a <strong>Goal</strong> you are striving to reach, or a <strong>Current Du'a</strong> that you wish to refine into a more prophetic form.
          </p>

          <h3 className="text-base font-github font-medium text-slate-200 mb-2">Semantic Mapping</h3>
          <p className="font-serif text-slate-300 leading-relaxed mb-4">
            The system uses a high-performance vector database to instantly associate your words with the 99 Names of Allah and relevant Hadith.
          </p>
          <h3 className="text-base font-github font-medium text-slate-200 mb-2">Understanding Attributes</h3>
          <p className="font-serif text-slate-300 leading-relaxed mb-6">
            This logic is inspired by the teachings of scholars like Sheikh Mikaeel Smith, who emphasize understanding the specific personality of Allah's attributes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-serif font-medium text-slate-100 mb-3">The Refinement Layer</h2>
          <p className="font-serif text-slate-300 leading-relaxed mb-4">
            Our spiritual editor takes your input along with the matched Name and Hadith to suggest a refined version of your prayer.
          </p>
          <h3 className="text-base font-github font-medium text-slate-200 mb-2">Prophetic Etiquette</h3>
          <p className="font-serif text-slate-300 leading-relaxed mb-6">
            This refinement follows the Prophetic etiquette of starting with praise and using the specific Names that are most relevant to your petition.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-serif font-medium text-slate-100 mb-3">Building Your Ledger</h2>
          <p className="font-serif text-slate-300 leading-relaxed mb-4">
            Every du'a you refine can be saved to your private and secure journal.
          </p>
          <h3 className="text-base font-github font-medium text-slate-200 mb-2">Spiritual Record</h3>
          <p className="font-serif text-slate-300 leading-relaxed mb-4">
            This allows you to maintain a living record of your conversations with Allah.
          </p>
          <h3 className="text-base font-github font-medium text-slate-200 mb-2">Tracking Mercy</h3>
          <p className="font-serif text-slate-300 leading-relaxed mb-4">
            You have the ability to mark these prayers as Answered over time.
          </p>
          <h3 className="text-base font-github font-medium text-slate-200 mb-2">Developing Yaqeen</h3>
          <p className="font-serif text-slate-300 leading-relaxed mb-4">
            This feature is vital because it creates a visual history of Allah's mercy in your life.
          </p>
          <h3 className="text-base font-github font-medium text-slate-200 mb-2">Witnessing Response</h3>
          <p className="font-serif text-slate-300 leading-relaxed">
            It transforms your prayer experience from a fleeting moment into a record of certainty, or Yaqeen, as you witness exactly how your Lord has responded to you over the months and years.
          </p>
        </section>

        <Link href="/" className="inline-block mt-10 text-emerald-500 hover:text-emerald-400 transition-colors text-sm font-github">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
