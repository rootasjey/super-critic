// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      title: 'Super Critic',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Action platformer game' },
        { name: 'og:title', content: 'Super Critic' },
        { name: 'og:description', content: 'Action platformer game' },
        { name: 'og:image', content: '/og-image.png' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  hub: {
    blob: true,
    cache: true,
    database: true,
    kv: true,
  },

  modules: [
    '@nuxt/image',
    '@una-ui/nuxt',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    'nuxt-auth-utils',
    '@nuxthub/core',
  ],

  unocss: {
    preflight: true,
    icons: {
      scale: 1.0,
      extraProperties: {
        "display": "inline-block",
        "vertical-align": "middle",
      },
    },
    theme: {
      colors: {
        primary: {
          DEFAULT: '#134686',
          50: '#E6ECF4',
          100: '#C1D1E4',
          200: '#99B3D2',
          300: '#6F93BF',
          400: '#4976AC',
          500: '#134686',
          600: '#113D77',
          700: '#0E3263',
          800: '#0B274F',
          900: '#081B3B',
        },
        secondary: {
          DEFAULT: '#FAA533',
          50: '#FFF3E6',
          100: '#FEE0B8',
          200: '#FDC78A',
          300: '#FDB15A',
          400: '#FF9A1F',
          500: '#FAA533',
          600: '#E88C00',
          700: '#B84217',
          800: '#993715',
          900: '#7A2C12',
        },
      },
    },
  },
  una: {
    prefix: "N",
    themeable: true,
  },
})