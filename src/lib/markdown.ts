/**
 * Safely parses basic Markdown syntax into HTML strings to render rich text,
 * links, lists, and images in the article views.
 */
export function parseMarkdownToHtml(markdown: string | null | undefined): string {
  if (!markdown) return "";

  // 1. Escape HTML special characters to prevent XSS (allowing only safe tags like <u>)
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;u&gt;/g, "<u>")
    .replace(/&lt;\/u&gt;/g, "</u>");

  // 2. Parse Headings (multiline regex to match start of lines)
  html = html
    .replace(/^## (.*?)$/gm, '<h2 class="text-base font-extrabold text-zinc-950 mt-4 mb-2">$1</h2>')
    .replace(/^# (.*?)$/gm, '<h1 class="text-lg font-extrabold text-zinc-950 mt-5 mb-2.5">$1</h1>');

  // 3. Parse Images: ![alt](url)
  html = html.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<img src="$2" alt="$1" class="my-4 max-w-full rounded-lg border border-zinc-200 shadow-xs object-cover" />'
  );

  // 4. Parse Links: [text](url)
  html = html.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-semibold">$1</a>'
  );

  // 5. Parse Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-zinc-950">$1</strong>');

  // 6. Parse Italic: *text*
  html = html.replace(/\*(.*?)\*/g, '<em class="italic text-zinc-700">$1</em>');

  // 7. Parse Lists (Bullet & Numbered)
  html = html.replace(/^- (.*?)$/gm, '<li class="ml-4 list-disc pl-1">$1</li>');
  html = html.replace(/^\d+\.\s+(.*?)$/gm, '<li class="ml-4 list-decimal pl-1">$1</li>');

  return html;
}
