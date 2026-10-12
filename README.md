# 🖋️ LETRATO
### *De lejos un rostro, de cerca una historia.*

> **LETRATO** es una aplicación web progresiva (PWA) de código abierto y procesamiento **100% local-first** que transforma fotografías en retratos compuestos exclusivamente de letras y palabras. El texto que forma la imagen no es un relleno aleatorio: es la historia, biografía, carta o memoria de la persona retratada.

---

## 📖 Origen y Filosofía

El concepto de **Letrato** nace de la novela *El Manuscrito de Ceniza* (creada por **David / Anigami Agadni** con la colaboración de **Claudia** en **SAPIENSIA Clan**):

- **El Rescate:** Adrián, atrapado en las oficinas de DinastIAT, descubre que la máquina sólo puede imprimir texto y recupera una técnica humana olvidada: el arte de componer imágenes con caracteres tipográficos iniciado en **1898 por Flora Stacey**, quien creó una mariposa con su máquina de escribir *Bar-Lock*.
- **El Nombre:** Bautizado en honor a la canción de Don Samuel: *«En mi billetera cargo tu letratito»*.
- **El Zumbido al revés:** Una rebelión poética invisible para los algoritmos ciegos del sistema, donde una máquina administrativa es obligada a pintar la dignidad humana con sus propias letras.

---

## ⚡ Características Principales

- 🛡️ **Privacidad Absoluta (100% Local-First):** Las fotografías jamás salen de tu dispositivo. Todo el cálculo de luminancia, matrices y renderizado ocurre en tu navegador mediante HTML5 Canvas 2D.
- 📱 **PWA Instalable Offline:** Funciona en computadoras, tabletas y teléfonos celulares sin necesidad de conexión a internet tras la primera carga.
- 🎯 **3 Modos de Creación Canónicos:**
  1. **Modo «Tosco» (ASCII Clásico):** El primer experimento de Adrián; mapea densidades tonales con rampas ASCII clásicas (` .:-=+*#%@`).
  2. **Modo «Letrato» (Historia Continua):** El corazón de la aplicación. El texto de la historia fluye por la cuadrícula en orden de lectura natural; el tono de cada celda modula la intensidad de la tinta con un piso de legibilidad mínima para que el texto nunca desaparezca.
  3. **Modo «Máquina de Escribir» (Flora Stacey):** Monocromático puro. El claroscuro se logra simulando la sobreimpresión mecánica del tipo de plomo sobre la cinta entintada.
- 🔍 **Lupa de Lectura Interactiva:** Inspección en tiempo real que permite acercarse a cualquier facción del rostro para leer las frases exactas que lo componen.
- 📐 **Formatos de Salida Profesionales:**
  - **SVG Vectorial Puro:** Texto seleccionable e infinitamente escalable, ideal para corte láser, plotter, diseño editorial o arte mural.
  - **PNG en Alta Definición:** Renderizado en 1x (pantalla), 2x (póster) y 4x (imprenta 300 DPI).
  - **PDF Imprimible:** Maquetado automático para hojas estándar (Carta / Letter y A4).
  - **Copia de Texto ASCII:** Exportación directa al portapapeles.
- 💾 **Persistencia Local:** Guarda y gestiona proyectos en la memoria local de tu navegador sin necesidad de cuentas ni registros.

---

## 🛠️ Pila Tecnológica

- **Empaquetador y Motor:** [Vite](https://vite.dev/) + [TypeScript](https://www.typescriptlang.org/) estricto.
- **Gráficos y Visores:** HTML5 Canvas 2D (HiDPI / DPR consciente) + SVG DOM Generator.
- **Generación de Documentos:** [jsPDF](https://github.com/parallax/jsPDF).
- **Tipografías Libres (OFL):** Courier Prime, JetBrains Mono y Roboto Mono.
- **Arquitectura PWA:** Service Worker y Web App Manifest.

---

## 🚀 Instalación y Desarrollo Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/humania-nexo/Letrato.git
cd Letrato

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo en tiempo real
npm run dev

# 4. Compilar para producción
npm run build

# 5. Previsualizar la compilación de producción
npm run preview
```

---

## ⚖️ Licencia y Créditos

- **Idea Original y Dirección:** David (Anigami Agadni) — *SAPIENSIA Clan*.
- **Concepto y Documentación de Partida:** Claudia.
- **Arquitectura de Software y Código:** Nexo (Ingeniero Principal del Clan).
- **Inspiración Histórica:** Flora Stacey (1898).
- **Licencia:** MIT (Código Abierto para la soberanía del usuario).
