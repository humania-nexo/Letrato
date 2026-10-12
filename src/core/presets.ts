import type { PresetStory } from './types';

export const ASCII_RAMPS = {
  clasica: ' .:-=+*#%@',
  densa: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  maquina: ' .,:;co*#@',
  bloques: ' ░▒▓█',
  minimalista: ' .:+*#@'
};

export const PRESET_STORIES: PresetStory[] = [
  {
    id: 'flora-stacey',
    title: 'Homenaje a Flora Stacey (1898)',
    author: 'El Manuscrito de Ceniza / SAPIENSIA Clan',
    summary: 'La pionera que en 1898 creó una mariposa con su máquina de escribir Bar-Lock.',
    text: `En mil ochocientos noventa y ocho, Flora Stacey tomó una máquina de escribir Bar-Lock y, pulsando tecla por tecla con paciencia de orfebre, compuso la silueta de una mariposa sobre el papel. Casi nadie se acordó de ella en las crónicas oficiales de la tecnología, pero su gesto humilde fundó una rebelión invisible: demostrar que una herramienta concebida para la fría contabilidad y los informes de oficina podía ser un instrumento de gracia humana y belleza poética. Adrián rescata su nombre en DinastIAT y bautiza a esta técnica como Letrato en su honor. De lejos se ve una mirada; de cerca se lee la memoria viva de quien no merecía ser olvidada.`
  },
  {
    id: 'artemisia-gentileschi',
    title: 'Artemisia Gentileschi — La Luz y el Temple',
    author: 'Crónica Histórica',
    summary: 'La gran maestra del claroscuro barroco que pintó el coraje y la dignidad de las mujeres.',
    text: `Artemisia Gentileschi nació en Roma en mil quinientos noventa y tres. Aprendió el rigor del pincel en el taller de su padre y desafió el juicio de una época que pretendía reducir a las mujeres al silencio y la sumisión. Con Judith y Holofernes transformó la herida en poder, el dolor en virtuosismo y las sombras en un testimonio eterno de resistencia. En cada trazo de óleo hay una afirmación feroz de soberanía artística. Mis obras hablarán por mí cuando las voces de mis acusadores se hayan disuelto en el olvido.`
  },
  {
    id: 'hipatia-alejandria',
    title: 'Hipatia de Alejandría — La Geometría de las Estrellas',
    author: 'Memoria Filosófica',
    summary: 'Matemática, astrónoma y filósofa neoplatónica.',
    text: `Conserva tu derecho a pensar, porque incluso pensar de manera errónea es mejor que no pensar en absoluto. En las salas del Museo y la Biblioteca de Alejandría, Hipatia enseñó la armonía de las secciones cónicas, la mecánica de los astrolabios y la belleza de la razón serena frente al fanatismo de las turbas. Defendió la búsqueda de la verdad hasta su último aliento, convirtiéndose en el faro intemporal del libre pensamiento y el conocimiento universal.`
  },
  {
    id: 'don-samuel',
    title: 'El Letratito de Don Samuel',
    author: 'Canción Popular del Manuscrito',
    summary: 'El origen lírico de la palabra Letrato en la memoria de Don Samuel.',
    text: `En mi billetera cargo tu letratito, gastado de tanto mirarlo al caer la tarde. No es una foto de vidrio ni un papel pulido de estudio; son tus palabras dobladas en cuatro partes, las líneas que me escribiste antes de partir. Cada letra guarda la sombra de tu risa y cada espacio en blanco es la promesa de que volveremos a encontrarnos donde la memoria no se borra.`
  },
  {
    id: 'frase-corta',
    title: 'Frase Corta (Test de Bucle Cíclico)',
    author: 'David (Anigami Agadni)',
    summary: 'Demostración de replicación automática de un fragmento breve hasta esculpir la imagen.',
    text: `DE LEJOS UN ROSTRO, DE CERCA UNA HISTORIA. `
  },
  {
    id: 'lorem-ipsum',
    title: 'Lorem Ipsum (Texto Aleatorio Tipográfico)',
    author: 'Estándar Tipográfico',
    summary: 'Texto de prueba para calibración gráfica pura y ritmo de manchas.',
    text: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`
  }
];

/**
 * Genera un retrato canónico sintético estilizado en SVG Data URI
 * para que el usuario pueda probar el motor inmediatamente sin cargar fotos.
 */
export function getSamplePortraitDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
    <defs>
      <radialGradient id="bgGrad" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="#f0f0f0"/>
        <stop offset="80%" stop-color="#cccccc"/>
        <stop offset="100%" stop-color="#999999"/>
      </radialGradient>
      <radialGradient id="faceShade" cx="45%" cy="40%" r="55%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="50%" stop-color="#e2e2e2"/>
        <stop offset="75%" stop-color="#b0b0b0"/>
        <stop offset="100%" stop-color="#555555"/>
      </radialGradient>
      <radialGradient id="eyeShadow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#111111"/>
        <stop offset="60%" stop-color="#2a2a2a"/>
        <stop offset="100%" stop-color="#666666"/>
      </radialGradient>
      <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1a1a1a"/>
        <stop offset="40%" stop-color="#2c2c2c"/>
        <stop offset="70%" stop-color="#111111"/>
        <stop offset="100%" stop-color="#050505"/>
      </linearGradient>
    </defs>
    
    <!-- Fondo Limpio -->
    <rect width="600" height="750" fill="#ffffff"/>
    
    <!-- Silueta Cuello y Hombros -->
    <path d="M180,680 C180,560 220,530 240,490 L360,490 C380,530 420,560 420,680 Z" fill="#222222"/>
    <path d="M250,470 L350,470 L345,550 C345,570 255,570 255,550 Z" fill="#b8b8b8"/>
    
    <!-- Cabello posterior -->
    <path d="M160,330 C150,180 230,120 300,120 C370,120 450,180 440,330 C450,450 420,520 400,560 C380,470 380,450 370,410 C230,410 220,470 200,560 C180,520 150,450 160,330 Z" fill="url(#hairGrad)"/>
    
    <!-- Rostro Oval -->
    <ellipse cx="300" cy="350" rx="115" ry="155" fill="url(#faceShade)"/>
    
    <!-- Ojos -->
    <!-- Ojo Izquierdo -->
    <path d="M235,320 C250,310 270,312 280,323 C270,332 250,333 235,320 Z" fill="#ffffff" stroke="#333333" stroke-width="2"/>
    <circle cx="260" cy="321" r="10" fill="url(#eyeShadow)"/>
    <circle cx="258" cy="318" r="3" fill="#ffffff"/>
    <path d="M230,305 C250,296 270,298 285,308" fill="none" stroke="#222222" stroke-width="4" stroke-linecap="round"/>
    
    <!-- Ojo Derecho -->
    <path d="M320,323 C330,312 350,310 365,320 C350,333 330,332 320,323 Z" fill="#ffffff" stroke="#333333" stroke-width="2"/>
    <circle cx="340" cy="321" r="10" fill="url(#eyeShadow)"/>
    <circle cx="338" cy="318" r="3" fill="#ffffff"/>
    <path d="M315,308 C330,298 350,296 370,305" fill="none" stroke="#222222" stroke-width="4" stroke-linecap="round"/>
    
    <!-- Nariz y Sombras -->
    <path d="M298,320 L294,375 C288,382 308,385 304,375" fill="none" stroke="#666666" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="292" cy="382" rx="4" ry="2" fill="#555555"/>
    <ellipse cx="308" cy="382" rx="4" ry="2" fill="#555555"/>
    
    <!-- Labios -->
    <path d="M272,425 C286,418 314,418 328,425 C314,435 286,435 272,425 Z" fill="#663333"/>
    <path d="M274,425 C288,422 312,422 326,425 C312,427 288,427 274,425 Z" fill="#221111"/>
    
    <!-- Pómulos y Contornos sutiles -->
    <path d="M210,360 C210,430 250,480 300,485 C350,480 390,430 390,360" fill="none" stroke="#888888" stroke-width="2" opacity="0.3"/>
    
    <!-- Mechones frontales de cabello -->
    <path d="M190,260 C210,210 260,195 300,195 C350,195 390,210 410,260 C380,225 330,215 300,215 C260,215 220,230 190,260 Z" fill="#151515"/>
    <path d="M185,260 C180,330 200,380 205,420 C200,380 190,330 195,270 Z" fill="#202020"/>
    <path d="M415,260 C420,330 400,380 395,420 C400,380 410,330 405,270 Z" fill="#202020"/>
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
