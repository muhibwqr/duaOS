import Link from "next/link";
import { Github } from "lucide-react";

const GITHUB_REPO_URL = "https://github.com/muhibwqr/duaOS";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 px-4 pt-4">
      <div
        className="mx-auto flex max-w-4xl items-center justify-between gap-6 rounded-full border border-white/10 bg-slate-900/40 px-6 py-3 backdrop-blur-xl shadow-[0_0_32px_rgba(255,255,255,0.08),0_0_48px_rgba(5,150,105,0.06)] hover:shadow-[0_0_40px_rgba(255,255,255,0.1),0_0_60px_rgba(5,150,105,0.08)] transition-shadow duration-300"
      >
        <Link href="/" className="shrink-0 font-github text-lg font-semibold text-slate-100 hover:text-white transition-colors" aria-label="du'aOS home">
          Du'aOS
        </Link>
        <nav className="hidden sm:flex items-center gap-8 font-github text-sm text-slate-300">
          <Link href="/why" className="hover:text-white transition-colors">
            why we're doing this
          </Link>
          <Link href="/how" className="hover:text-white transition-colors">
            how it works
          </Link>
        </nav>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-600/90 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500/90 hover:border-emerald-400/40 backdrop-blur-xl transition-all duration-300 font-github shadow-[0_0_20px_rgba(5,150,105,0.2)] hover:shadow-[0_0_28px_rgba(5,150,105,0.3)]"
        >
          <Github className="size-4" />
          Star on GitHub
        </a>
      </div>
    </header>
  );
}
