import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";

interface RulesDoc {
  title: string;
  file: string;
}

// Maps a game type to its rules doc in /docs. Keyed by gameType so links can be
// built as `/rules/<gameType>`.
const RULES_DOCS: Record<string, RulesDoc> = {
  arrow_predict: { title: "Acchi Muite Hoi", file: "arrow-predict" },
  spaceship_defense: { title: "Starshield Crisis", file: "spaceship-defense" },
  frankenbeasts: { title: "FrankenBeasts", file: "frankenbeasts" },
  tarot: { title: "Fortune's Veil", file: "tarot" },
  liars_dice: { title: "Bluffer's Hoard", file: "liars-dice" }
};

export function generateStaticParams() {
  return Object.keys(RULES_DOCS).map((game) => ({ game }));
}

export default async function RulesPage({ params }: { params: { game: string } }) {
  const doc = RULES_DOCS[params.game];
  if (!doc) {
    notFound();
  }

  let markdown: string;
  try {
    markdown = await readFile(path.join(process.cwd(), "docs", `${doc.file}.md`), "utf8");
  } catch {
    notFound();
  }

  const html = renderMarkdown(markdown);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Back to lobby
      </Link>
      <article
        className="rules-doc mt-6 rounded-lg bg-bg-panel p-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
