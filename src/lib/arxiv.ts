export type ArxivResult = {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  categories: string[];
  pdfUrl: string;
  sourceUrl: string;
};

export async function searchArxiv(query: string, maxResults = 10): Promise<ArxivResult[]> {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
  const res = await fetch(url);
  const text = await res.text();
  return parseArxivXml(text);
}

export async function fetchArxivPaper(arxivId: string): Promise<ArxivResult | null> {
  const cleanId = arxivId
    .replace("arXiv:", "")
    .replace(/https?:\/\/arxiv\.org\/(abs|pdf|html|labs)\//, "")
    .replace(/\.pdf$/, "")
    .replace(/v\d+$/, "")
    .trim();
  const url = `http://export.arxiv.org/api/query?id_list=${cleanId}`;
  const res = await fetch(url);
  const text = await res.text();
  const results = parseArxivXml(text);
  return results[0] || null;
}

function parseArxivXml(xml: string): ArxivResult[] {
  const entries: ArxivResult[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const id = extractTag(entry, "id")?.replace("http://arxiv.org/abs/", "").replace(/v\d+$/, "") || "";
    const title = extractTag(entry, "title")?.replace(/\s+/g, " ").trim() || "";
    const abstract = extractTag(entry, "summary")?.trim() || "";
    const published = extractTag(entry, "published") || "";

    const authors: string[] = [];
    const authorRegex = /<author>\s*<name>(.*?)<\/name>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1]);
    }

    const categories: string[] = [];
    const catRegex = /<category[^>]*term="([^"]*?)"/g;
    let catMatch;
    while ((catMatch = catRegex.exec(entry)) !== null) {
      categories.push(catMatch[1]);
    }

    const pdfLinkMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]*?)"/);
    const pdfUrl = pdfLinkMatch ? pdfLinkMatch[1] : `http://arxiv.org/pdf/${id}`;

    entries.push({
      id,
      title,
      authors,
      abstract,
      published,
      categories,
      pdfUrl,
      sourceUrl: `https://arxiv.org/abs/${id}`,
    });
  }

  return entries;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : null;
}
