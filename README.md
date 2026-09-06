# 🪖 Sherman Solitario - Wargame PWA

Una aplicación web progresiva (PWA estática) optimizada para **iPad (touch-first)** y **escritorio**, basada en el wargame táctico determinista en solitario **Sherman Solitario**.

![Versión](https://img.shields.io/badge/Versi%C3%B3n-0.1.0-emerald)
![Licencia](https://img.shields.io/badge/Licencia-MIT-blue)
![Stack](https://img.shields.io/badge/Stack-React%2019%20%7C%20TypeScript%20%7C%20Vite%20%7C%20Tailwind-amber)

---

## 🎯 Características Principales

- **13 Misiones Completas:** Desde la primera patrulla hasta duelistas pesados (Tiger I, Tiger II, Panzer IV, Panzer III, infantería en edificios y camiones de suministros).
- **Motor Hexagonal Desacoplado:** Coordenadas axiales `{q, r}`, cálculo exacto de distancias en hexágonos, algoritmo de Línea de Visión (LoS) deteniéndose en bosques/edificios y arcos de blindaje (Delantero D, Lateral-Delantero LD, Lateral-Trasero LT y Trasero T) según el encaramiento (0-5).
- **Game Loop de 7 Fases:**
  1. Limpieza de humo del Sherman.
  2. Asignación del Comandante (Asomado / Interior).
  3. Operaciones del Sherman (Maniobra, Ataque, Varios / Rescate de tripulación).
  4. Limpieza de humo alemán.
  5. Verificación de fuego activo.
  6. Operaciones de la IA alemana.
  7. Tirada 2d6 de eventos de fin de turno.
- **Optimizada para Pantalla Táctil (iPad/PC):** Zoom fluido, panning interactivo, controles protegidos contra menús contextuales no deseados e interfaz responsive.
- **Modo Campaña y Persistencia Local:** Guardado automático del estado de partida en `localStorage` y progreso a través del libro de misiones con sustitución de bajas.
- **Soporte PWA Offline:** Instalable en iPad y PC sin necesidad de conexión activa tras la primera carga.

---

## 🛠️ Tecnologías

- **Librería de UI:** React 19
- **Lenguaje:** TypeScript 5.7
- **Bundler & Dev Server:** Vite 6
- **Estilos:** Tailwind CSS v4
- **Gestión de Estado:** Zustand 5
- **Pruebas Unitarias e Integración:** Vitest
- **Soporte PWA:** `vite-plugin-pwa`
- **Despliegue:** `gh-pages` (GitHub Pages)

---

## 📂 Estructura del Proyecto

```text
sherman/
├── docs/                      # Especificaciones de misiones y diseño técnico
├── src/
│   ├── components/            # Componentes de UI (Tablero Hexagonal, Consola de Fases, Dashboard, Modales)
│   ├── core/
│   │   ├── hex/               # Matemáticas hexagonales, LoS, encaramiento y arcos de blindaje
│   │   └── rules/             # Reglas de combate, IA alemana, flujo de turnos y cargador de misiones
│   ├── data/
│   │   └── missions/          # Especificaciones JSON de las 13 misiones (mission1.json ... mission13.json)
│   ├── store/                 # Estado global del juego con Zustand (gameStore.ts)
│   └── types/                 # Interfaces TypeScript centralizadas (game.ts)
├── index.html                 # Punto de entrada HTML con meta viewport táctil para iOS
├── vite.config.ts             # Configuración de Vite, PWA y base path para GitHub Pages
└── package.json               # Dependencias y scripts de construcción / despliegue
```

---

## 🚀 Instalación y Desarrollo

### Requisitos previos
- **Node.js**: v18.0.0 o superior
- **npm**: v9.0.0 o superior

### Pasos para ejecutar en local

```bash
# 1. Clonar el repositorio
git clone https://github.com/<tu-usuario>/sherman.git
cd sherman

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación se abrirá en `http://localhost:5173`.

---

## 🧪 Pruebas Automatizadas

El proyecto incluye 69 pruebas unitarias y de integración en **Vitest** que verifican las matemáticas hexagonales, las tablas de combate 2d6, la IA alemana y las condiciones de victoria/derrota de las 13 misiones.

```bash
# Ejecutar todas las pruebas unitarias e integración
npm run test
```

---

## 📦 Compilación y Despliegue en GitHub Pages

```bash
# Compilar la versión de producción PWA en dist/
npm run build

# Desplegar en la rama gh-pages de GitHub
npm run deploy
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
