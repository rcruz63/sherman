# ESPECIFICACIÓN TÉCNICA: ADAPTACIÓN DIGITAL "SHERMAN SOLITARIO"

## 1. OBJETIVO DEL PROYECTO
Desarrollar una aplicación web responsive/PWA para iPad (touch-first) y navegador de escritorio (mouse), que reproduzca fielmente las mecánicas del libro-juego "Sherman Solitario" de Mike Lambo.

## 2. ARQUITECTURA Y STACK RECOMENDADO
- Frontend: React + TypeScript (o Vanilla TS / Vue 3) + Tailwind CSS.
- Renderizado de Tablero: Canvas 2D / SVG interactivo para la rejilla hexagonal (coordenadas axiales/cúbicas).
- Gestión de Estado: Zustand o Redux Toolkit (máquina de estados finitos para las 7 fases).
- Persistencia: IndexedDB (guarda estado de cada turno, tiradas y configuración de campaña).
- Audio/Feedback (opcional): Efectos de sonido ligeros Web Audio API (dados, cañonazos, alarmas de fuego).
- Soporte Offline: Service Worker configurado para funcionamiento sin conexión.

---

## 3. MODELO DE DATOS Y ESTADO DEL JUEGO

### 3.1 Coordenadas del Tablero Hexagonal
- Sistema de coordenadas axiales (q, r) o cúbicas (x, y, z) con orientación "flat-topped" o "pointy-topped" según los mapas originales.
- Encaramiento (Facing): Entero de 0 a 5 representando las 6 caras del hexágono.

### 3.2 Terrenos y Propiedades (Hex Data)
- Tipos base: Carretera (Road), Campo (Field), Barro (Mud).
- Elementos superpuestos: Edificio (Pueblo/Granja), Bosque (Woods), Agua (Water).
- Bordes: Arboledas (Tree lines) asociadas a las aristas del hexágono.
- Metadatos de misión: Puntos de aparición con números negros (tanques) y rojos (infantería), flechas de entrada y salida.

### 3.3 Entidades (Units)
- Sherman:
  * Posición (q, r), Encaramiento (0-5).
  * Tripulantes (Array de 5 objetos: Comandante, Cargador, Artillero, Conductor, Asistente) con estados: [Activo, KIA].
  * Comandante: Posición [Interior (I), Asomado (A)].
  * Daños y Estados: Cañón Cargado (bool), Torreta Dañada (bool), Inmovilizado (bool), Nivel de Fuego (int >= 0), Humo (bool), Desenfilada (bool).
- Tanques Enemigos (Tiger, Panzer IV, Panzer III):
  * Id, Tipo, Posición (q, r), Encaramiento (0-5), Estado [Operativo, Dañado, Destruido], Humo (bool), Desenfilada (bool).
  * Estadísticas fijas: Tamaño (TAM), Blindaje (D, LD, LT, T), Penetración (PEN).
- Infantería Alemana:
  * Posición (q, r), Estado [Activo, Eliminado] (no tienen encaramiento).
- Objetos especiales de misión: Camión alemán (Misión 5), Sherman averiado (Misión 13).

---

## 4. MOTOR DE REGLAS (GAME LOOP)

El turno se gestiona mediante una máquina de estados estricta de 7 fases:

1. Fase 1: Limpieza de Humo Sherman (Resetear flag humo del Sherman a false).
2. Fase 2: Asignación Comandante (UI Modal/Toggle interactivo: "Interior" vs "Asomado").
3. Fase 3: Operaciones del Sherman
   - Jugador selecciona orden: [Maniobra -> Ataque -> Varios] o [Ataque -> Maniobra -> Varios].
   - Cálculo dinámico de reserva de dados d6 según terreno de inicio de fase y tripulación viva.
   - Lanzamiento de dados (animado o instantáneo).
   - Generación del pool de acciones disponibles (incluyendo emparejamiento de dobles si los tripulantes requeridos están vivos).
   - Ejecución interactiva de acciones (consumir dados, mover, girar, cargar, disparar con comprobación de línea de visión y tabla de daño).
4. Fase 4: Limpieza de Humo Alemán (Resetear flag humo de todos los tanques enemigos).
5. Fase 5: Comprobación de Fuego
   - Si Nivel de Fuego > 0: Lanzar N dados d6 = Nivel de Fuego.
   - Tomar el resultado menor y aplicar resolución directa en tabla "¿Qué Daños? Sherman".
6. Fase 6: Operaciones Tanques Alemanes (IA Determinista)
   - Orden de activación: Del más cercano al Sherman al más lejano (desempate por tirada d6).
   - Para cada tanque: Determinar dados según terreno inicial o estado Dañado (4, 3 o 2 dados).
   - Tirar dados, ordenar de menor a mayor.
   - Resolver secuencialmente cada dado según tabla de IA (evaluando acción primaria; si es imposible, acción secundaria).
   - Lógica estricta de Giro IA:
     * Regla 1: Directamente encarado a Sherman + celda frontal inaccesible -> Gira hacia hex accesible (si ambos o ninguno, azar).
     * Regla 2: Sherman en retaguardia directa -> Gira hacia hex accesible (desempate azar).
     * Regla 3: Si está directamente frente al Sherman -> No gira. En cualquier otro caso -> Girar hacia Sherman por el ángulo menor.
7. Fase 7: Eventos de Fin de Turno
   - Tirar 2d6 y consultar la tabla específica de la Misión activa.
   - Ejecutar evento correspondiente: Spawn de infantería/tanque, ataque de infantería adyacente, francotirador si Cte=A, minas en carretera, Stuka o acción extra de mando.

---

## 5. REQUISITOS DE LÓGICA ESPACIAL (HEX MATH)

- Línea de Visión (LOS):
  * Trazar trayectorias en línea recta pura a lo largo de las 6 direcciones hexagonales.
  * Hexágonos de Bosque y Edificios bloquean LOS a través de ellos (pero permiten ver la unidad situada dentro).
  * Arboledas y Agua no bloquean LOS.
- Arcos de Blindaje para Impacto:
  * Frontal (D): Dirección frontal exacta.
  * Trasero (T): Dirección trasera exacta.
  * Lateral Delantero (LD): Los dos vértices laterales frontales (±60°).
  * Lateral Trasero (LT): Los dos vértices laterales traseros (±120°).
- Modificadores de Disparo:
  * Dificultad base = TAM objetivo + Distancia en hexágonos.
  * +1 por cada arboleda cruzada (excluyendo las que tocan al atacante).
  * +1 si objetivo en Edificio / +1 con Humo / +2 en Desenfilada / +1 si objetivo en retaguardia del atacante.

---

## 6. REQUISITOS DE INTERFAZ DE USUARIO (UI / UX PARA IPAD & MOUSE)

- Layout de Pantalla Dividida / Dashboard:
  * Zona Central/Izquierda: Tablero táctil interactivo con soporte de Pan & Zoom fluido (pinch-to-zoom en iPad, rueda en ratón).
  * Zona Derecha (o panel deslizante en tablets): Panel de Control del Sherman.
    - Fichas de los 5 tripulantes (tocables para ver bonificaciones o marcar KIA).
    - Selector rápido Comandante (Interior / Asomado).
    - Indicadores luminosos/chips: Proyectil Cargado, Nivel de Fuego, Humo, Torreta Averiada, Inmovilizado.
    - Consola de Acciones y Dados: Botones grandes (mínimo 48x48 px touch target) para las tiradas y asignación de acciones.
- Log de Combate Detallado:
  * Cuadro de texto desplegable que audite cada cálculo: "Sherman dispara a Pz IV: Dificultad 8 (Tam 4 + Dist 3 + Edificio 1) -> Tirada 9 (Éxito) -> Blindaje 5 vs Pen 1 -> Daño infligido: Dañado".

