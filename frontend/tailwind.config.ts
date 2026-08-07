import type { Config } from 'tailwindcss';

// Paleta adaptada de la identidad visual de Haskell Cosméticos
// (verde musgo/bosque, acento magenta, promociones en naranja).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        musgo: {
          DEFAULT: '#8A9A4E',
          light: '#A8B871',
          dark: '#6E7A3E',
        },
        bosque: {
          DEFAULT: '#1F4A2E',
          light: '#2C6440',
          dark: '#13301D',
        },
        acento: {
          DEFAULT: '#E91E8C',
          light: '#F14FA8',
          dark: '#B81570',
        },
        promo: {
          DEFAULT: '#F5821F',
          light: '#F8A050',
        },
        crema: '#FAF8F2',
        // Semáforo de estado del tablero de indicadores (a favor/en
        // riesgo/en contra de la meta) — semántico, deliberadamente
        // separado del acento de marca (acento/promo), ver
        // docs/PROMPT_dashboard_indicadores_frontend.md sección 4.
        exito: '#2E8B4F',
        alerta: '#D9A017',
        riesgo: '#C0392B',
      },
      borderRadius: {
        card: '16px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};

export default config;
