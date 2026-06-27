import * as fs from 'fs';
import * as path from 'path';
import { marked, Tokens } from 'marked';
import hljs from 'highlight.js';

// ─── marked の設定（コードブロックにシンタックスハイライトを適用）──────────────

const renderer = new marked.Renderer();

renderer.code = ({ text, lang }: Tokens.Code): string => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};

marked.use({ renderer });

// ─── ページ間ナビゲーション定義 ────────────────────────────────────────────────

const PAGES = [
  { file: '01_what_is_ddd.md',        title: '① DDDとは' },
  { file: '02_ubiquitous_language.md', title: '② ユビキタス言語' },
  { file: '03_strategic_design.md',    title: '③ 戦略的設計' },
  { file: '04_tactical_design.md',     title: '④ 戦術的設計' },
  { file: '05_clean_architecture.md',  title: '⑤ クリーンアーキテクチャ' },
];

// ─── HTML テンプレート ──────────────────────────────────────────────────────────

function buildHtml(title: string, body: string, currentFile: string): string {
  const nav = PAGES.map(({ file, title: label }) => {
    const htmlFile = file.replace('.md', '.html');
    const active = file === currentFile ? ' class="active"' : '';
    return `<li${active}><a href="${htmlFile}">${label}</a></li>`;
  }).join('\n        ');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — DDD 学習ガイド</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <h2>DDD 学習ガイド</h2>
        <p>TypeScript で学ぶ</p>
      </div>
      <ul>
        ${nav}
      </ul>
    </nav>
    <main class="content">
      <article>
        ${body}
      </article>
      <footer>
        <p>DDD 学習ガイド — TypeScript + クリーンアーキテクチャ</p>
      </footer>
    </main>
  </div>
</body>
</html>`;
}

// ─── インデックスページ ─────────────────────────────────────────────────────────

function buildIndex(): string {
  const cards = PAGES.map(({ file, title }) => {
    const htmlFile = file.replace('.md', '.html');
    return `
    <a class="card" href="${htmlFile}">
      <span class="card-title">${title}</span>
    </a>`;
  }).join('\n');

  const body = `
<h1>DDD 学習ガイド</h1>
<p class="lead">TypeScript と EC サイトの実装例で学ぶ <strong>ドメイン駆動設計</strong> と <strong>クリーンアーキテクチャ</strong>。</p>
<div class="card-grid">
  ${cards}
</div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DDD 学習ガイド</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <h2>DDD 学習ガイド</h2>
        <p>TypeScript で学ぶ</p>
      </div>
      <ul>
        ${PAGES.map(({ file, title }) =>
          `<li><a href="${file.replace('.md', '.html')}">${title}</a></li>`
        ).join('\n        ')}
      </ul>
    </nav>
    <main class="content">
      <article>
        ${body}
      </article>
    </main>
  </div>
</body>
</html>`;
}

// ─── ビルド実行 ────────────────────────────────────────────────────────────────

async function build(): Promise<void> {
  const docsDir = path.resolve(__dirname, '../docs');
  const outDir  = path.resolve(__dirname, '../docs/html');

  fs.mkdirSync(outDir, { recursive: true });

  // CSS をコピー
  const cssSource = path.resolve(__dirname, '../docs/style.css');
  const cssDest   = path.join(outDir, 'style.css');
  fs.copyFileSync(cssSource, cssDest);

  // 各 Markdown → HTML
  for (const { file } of PAGES) {
    const mdPath   = path.join(docsDir, file);
    const htmlPath = path.join(outDir, file.replace('.md', '.html'));

    const markdown = fs.readFileSync(mdPath, 'utf-8');
    const body     = await marked(markdown);

    // <h1> からページタイトルを抽出
    const titleMatch = markdown.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1] : file;

    fs.writeFileSync(htmlPath, buildHtml(title, body, file), 'utf-8');
    console.log(`✓ ${file} → html/${file.replace('.md', '.html')}`);
  }

  // インデックスページ
  fs.writeFileSync(path.join(outDir, 'index.html'), buildIndex(), 'utf-8');
  console.log('✓ index.html');

  console.log(`\n完了: ${outDir}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
