import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const rootDir = path.resolve('.');

if (fs.existsSync(distDir)) {
  // 1. Copiar dist/template.html a ./index.html
  const distHtml = path.join(distDir, 'template.html');
  const rootHtml = path.join(rootDir, 'index.html');
  if (fs.existsSync(distHtml)) {
    fs.copyFileSync(distHtml, rootHtml);
    console.log('✓ Copiado dist/template.html -> ./index.html');
  }

  // 2. Copiar dist/assets -> ./assets
  const distAssets = path.join(distDir, 'assets');
  const rootAssets = path.join(rootDir, 'assets');
  if (fs.existsSync(distAssets)) {
    if (!fs.existsSync(rootAssets)) {
      fs.mkdirSync(rootAssets, { recursive: true });
    }
    const files = fs.readdirSync(distAssets);
    for (const f of files) {
      fs.copyFileSync(path.join(distAssets, f), path.join(rootAssets, f));
    }
    console.log(`✓ Copiados ${files.length} archivos de dist/assets -> ./assets`);
  }
}
