import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const rootDir = path.resolve('.');
const docsDir = path.resolve('docs');

if (fs.existsSync(distDir)) {
  const distTemplateHtml = path.join(distDir, 'template.html');
  const distIndexHtml = path.join(distDir, 'index.html');
  const rootIndexHtml = path.join(rootDir, 'index.html');

  // 1. Asegurar index.html dentro de dist/ (para GitHub Actions artifact)
  if (fs.existsSync(distTemplateHtml)) {
    fs.copyFileSync(distTemplateHtml, distIndexHtml);
    console.log('✓ Creado dist/index.html');
    fs.copyFileSync(distTemplateHtml, rootIndexHtml);
    console.log('✓ Sincronizado ./index.html');
  }

  // 2. Crear .nojekyll en dist/
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf-8');
  fs.writeFileSync(path.join(rootDir, '.nojekyll'), '', 'utf-8');

  // 3. Sincronizar dist/assets -> ./assets
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
    console.log(`✓ Copiados ${files.length} archivos a ./assets`);
  }

  // 4. Soporte para carpeta docs/ (si GitHub Pages está configurado con source: /docs)
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  if (fs.existsSync(distIndexHtml)) {
    fs.copyFileSync(distIndexHtml, path.join(docsDir, 'index.html'));
  }
  fs.writeFileSync(path.join(docsDir, '.nojekyll'), '', 'utf-8');

  const docsAssets = path.join(docsDir, 'assets');
  if (!fs.existsSync(docsAssets)) {
    fs.mkdirSync(docsAssets, { recursive: true });
  }
  if (fs.existsSync(distAssets)) {
    const files = fs.readdirSync(distAssets);
    for (const f of files) {
      fs.copyFileSync(path.join(distAssets, f), path.join(docsAssets, f));
    }
    console.log(`✓ Copiados ${files.length} archivos a ./docs/assets`);
  }

  // 5. Copiar assets de public/ tanto a root como a docs/
  const publicDir = path.resolve('public');
  if (fs.existsSync(publicDir)) {
    const pubFiles = fs.readdirSync(publicDir);
    for (const pf of pubFiles) {
      const srcFile = path.join(publicDir, pf);
      fs.copyFileSync(srcFile, path.join(rootDir, pf));
      fs.copyFileSync(srcFile, path.join(docsDir, pf));
      fs.copyFileSync(srcFile, path.join(distDir, pf));
    }
    console.log(`✓ Copiados ${pubFiles.length} archivos public a dist, root y docs`);
  }
}

