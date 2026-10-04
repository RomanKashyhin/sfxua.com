// SoundFX · extra-presets.js
// Six more looks for deadcat-fur-kit's fur.js, made for the site: two anime, two cartoon and two
// slightly stylised ones. Only parameters of fur.js are used (no shader changes), so the kit's
// module stays untouched; js/mic.js and tools/fur-gallery.html merge these into FUR_PRESETS.
// Anime looks: merged strands (high thickness, no per-strand tint) so locks read as drawn shapes,
// two light bands (toonSteps 2), dark partings between locks and a light root, so the shading
// comes from the bands, not from dark roots showing through.
export const EXTRA_PRESETS = {
  'anime-locks': {
    name: 'Аніме-пасма',
    description: 'Світлі гострі пасма, як намальоване аніме-волосся: два тони світла, темні проділи, яскравий край.',
    tags: ['нове', 'аніме', 'cel-shading'],
    params: {
      shells: 40, length: 0.28, density: 10, thickness: 0.7, taper: 0.95, lengthJitter: 0.05,
      clump: 0.92, clumpScale: 3.0, tuftPoint: 0.95, gravity: 0.3, inertia: 0.12, stiffness: 75,
      damping: 0.22, wind: 0.06, rootColor: '#8a8fd0', tipColor: '#f7f8ff', tipStart: 0,
      rimColor: '#ffffff', rim: 0.9, ao: 0.3, toonSteps: 2, clumpTint: 0.03, strandTint: 0,
      parting: 0.85, edgeFix: 0.5
    }
  },
  'anime-pastel': {
    name: 'Аніме-пастель',
    description: 'Пастельні рожево-бузкові пасма з м\'яким сяйвом по краю. Мило й по-аніме.',
    tags: ['нове', 'аніме', 'пастель'],
    params: {
      shells: 40, length: 0.26, density: 12, thickness: 0.68, taper: 0.9, lengthJitter: 0.08,
      clump: 0.85, clumpScale: 3.4, tuftPoint: 0.85, gravity: 0.3, inertia: 0.11, stiffness: 70,
      damping: 0.22, wind: 0.08, rootColor: '#c48ad8', tipColor: '#ffe0f2', tipStart: 0,
      rimColor: '#fff0fa', rim: 0.8, ao: 0.3, toonSteps: 2, clumpTint: 0.05, strandTint: 0,
      parting: 0.6, edgeFix: 0.5
    }
  },
  'cartoon-monster': {
    name: 'Монстрик',
    description: 'Бірюзове хутро мультяшного монстрика: пухнасті пучки, три тони світла, чіткі проділи.',
    tags: ['нове', 'мультяшний', 'яскравий'],
    params: {
      shells: 44, length: 0.26, density: 20, thickness: 0.5, taper: 0.82, lengthJitter: 0.2,
      clump: 0.65, clumpScale: 3.6, tuftPoint: 0.7, gravity: 0.4, inertia: 0.12, stiffness: 78,
      damping: 0.22, wind: 0.08, rootColor: '#0b6b70', tipColor: '#4fe0d8', tipStart: 0.05,
      rimColor: '#d6fffb', rim: 0.5, ao: 0.6, toonSteps: 3, clumpTint: 0.08, strandTint: 0.04,
      parting: 0.45
    }
  },
  'cartoon-bubblegum': {
    name: 'Жуйка',
    description: 'Яскраво-рожеві мультяшні пучки в кольорі сайту, три тони світла й чіткі проділи.',
    tags: ['нове', 'мультяшний', 'яскравий'],
    params: {
      shells: 44, length: 0.24, density: 20, thickness: 0.5, taper: 0.8, lengthJitter: 0.2,
      clump: 0.7, clumpScale: 3.2, tuftPoint: 0.75, gravity: 0.4, inertia: 0.12, stiffness: 80,
      damping: 0.22, wind: 0.08, rootColor: '#9a1650', tipColor: '#ff7ab4', tipStart: 0.1,
      rimColor: '#ffd0e4', rim: 0.6, ao: 0.6, toonSteps: 3, clumpTint: 0.08, strandTint: 0.04,
      parting: 0.45
    }
  },
  'soft-stylized': {
    name: 'М\'який стилізований',
    description: 'Довгий світлий ворс, начесаний назад, як на справжньому дедкеті, але світло лягає м\'якими сходинками.',
    tags: ['нове', 'напівреалістичний', 'начесаний'],
    params: {
      shells: 52, length: 0.36, density: 26, thickness: 0.45, taper: 0.9, lengthJitter: 0.35,
      clump: 0.65, clumpScale: 4, tuftPoint: 0.6, combDir: [-1, -0.25, 0], combStrength: 0.7,
      gravity: 0.45, inertia: 0.14, stiffness: 50, damping: 0.17, wind: 0.1,
      rootColor: '#3a3d48', tipColor: '#e3e6ee', tipStart: 0.05, rimColor: '#f1ecf8', rim: 0.6,
      ao: 0.7, toonSteps: 4, clumpTint: 0.08, strandTint: 0.06, parting: 0.35
    }
  },
  'pompom': {
    name: 'Помпон',
    description: 'Густий легкий пух із закрученими ворсинками й сяйвом по краю. Як помпон на шапці.',
    tags: ['нове', 'напівреалістичний', 'пухнастий'],
    params: {
      shells: 48, length: 0.3, density: 34, thickness: 0.32, taper: 0.85, lengthJitter: 0.4,
      clump: 0.12, clumpScale: 8, tuftPoint: 0.2, strandCurl: 0.2, strandCurlTurns: 1.2,
      gravity: 0.1, inertia: 0.09, stiffness: 65, damping: 0.2, wind: 0.14,
      rootColor: '#9aa7c9', tipColor: '#ffffff', tipStart: 0.4, rimColor: '#ffffff', rim: 1.0,
      ao: 0.55, toonSteps: 0, clumpTint: 0.05, strandTint: 0.1, parting: 0
    }
  }
};

/** Adds the extra looks to fur.js's FUR_PRESETS (once). */
export function addExtraPresets(presets) {
  for (const [id, p] of Object.entries(EXTRA_PRESETS)) if (!presets[id]) presets[id] = p;
  return presets;
}
