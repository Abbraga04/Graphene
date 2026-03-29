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
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    return parseArxivXml(text);
  } catch {
    return [];
  }
}

export async function fetchArxivPaper(arxivId: string): Promise<ArxivResult | null> {
  const cleanId = arxivId
    .replace("arXiv:", "")
    .replace(/https?:\/\/arxiv\.org\/(abs|pdf|html|labs)\//, "")
    .replace(/\.pdf$/, "")
    .replace(/v\d+$/, "")
    .trim();

  // Try API first (with timeout)
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const url = `https://export.arxiv.org/api/query?id_list=${cleanId}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const text = await res.text();
      if (text.includes("Rate exceeded")) continue;
      const results = parseArxivXml(text);
      if (results.length > 0) return results[0];
    } catch {
      // timeout or network error
    }
  }

  // Fallback: scrape the abs page directly
  try {
    const absUrl = `https://arxiv.org/abs/${cleanId}`;
    const res = await fetch(absUrl, { signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    return scrapeAbsPage(cleanId, html);
  } catch {
    return null;
  }
}

function scrapeAbsPage(id: string, html: string): ArxivResult | null {
  // Title
  const titleMatch = html.match(/<h1 class="title[^"]*">\s*<span[^>]*>Title:<\/span>\s*([\s\S]*?)<\/h1>/i)
    || html.match(/<title>\[[\d.]+\]\s*(.*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    : "";
  if (!title) return null;

  // Authors
  const authors: string[] = [];
  const authSection = html.match(/<div class="authors">([\s\S]*?)<\/div>/i);
  if (authSection) {
    const authRegex = />([^<]+)<\/a>/g;
    let m;
    while ((m = authRegex.exec(authSection[1])) !== null) {
      authors.push(m[1].trim());
    }
  }

  // Abstract
  const absMatch = html.match(/<blockquote class="abstract[^"]*">\s*<span[^>]*>Abstract:<\/span>\s*([\s\S]*?)<\/blockquote>/i);
  const abstract = absMatch
    ? absMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    : "";

  // Date
  const dateMatch = html.match(/\[Submitted on (\d+ \w+ \d+)/);
  const published = dateMatch ? new Date(dateMatch[1]).toISOString() : "";

  // Categories
  const categories: string[] = [];
  const catMatch = html.match(/<span class="primary-subject">(.*?)<\/span>/);
  if (catMatch) {
    const code = catMatch[1].match(/\(([^)]+)\)/);
    if (code) categories.push(code[1]);
  }

  return {
    id,
    title,
    authors,
    abstract,
    published,
    categories,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    sourceUrl: `https://arxiv.org/abs/${id}`,
  };
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
    const pdfUrl = pdfLinkMatch ? pdfLinkMatch[1] : `https://arxiv.org/pdf/${id}`;

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
