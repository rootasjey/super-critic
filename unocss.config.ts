import extratorUna from '@una-ui/extractor-vue-script'
import presetUna from '@una-ui/preset'
import prefixes from '@una-ui/preset/prefixes'
import presetAnimations from 'unocss-preset-animations'
import { createLocalFontProcessor } from '@unocss/preset-web-fonts/local'

import {
  presetAttributify,
  presetIcons,
  presetWebFonts,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default {
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetWebFonts({
      provider: 'coollabs',
      fonts: {
        body: 'Workbench',
        ui: 'Jersey 20',
      },
      processors: [
        createLocalFontProcessor({
          cacheDir: 'node_modules/.cache/unocss/fonts',
          fontAssetsDir: 'public/fonts',
          fontServeBaseUrl: '/fonts',
        }),
      ],
    }),
    presetUna(),
    presetAnimations(),
  ],
  safelist: [
    // Ensure these rules are always generated
    // because they are generated dynamically in some cases
    'font-ui',
  ],
  shortcuts: [
    {},
  ],
  extractors: [
    extratorUna({
      prefixes,
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
}
