import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameCatalogEntry, listGameCatalog } from "@/lib/game/catalog";
import { renderMarkdown } from "@/lib/markdown";

export function generateStaticParams() {
  return listGameCatalog().map((game) => ({ game: game.gameType }));
}

export default async function RulesPage({ params }: { params: { game: string } }) {
  const game = getGameCatalogEntry(params.game);
  if (!game) {
    notFound();
  }

  let markdown: string;
  try {
    markdown = await readFile(path.join(process.cwd(), "docs", `${game.rulesDocFile}.md`), "utf8");
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
