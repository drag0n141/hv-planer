<script lang="ts" module>
  // Eigene, schlichte Liniensymbole (24er Raster).
  const PATHS = {
    back: "M15 5l-7 7 7 7",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    close: "M6 6l12 12M18 6L6 18",
    undo: "M9 7L4 12l5 5M4 12h10a6 6 0 010 12h-2",
    redo: "M15 7l5 5-5 5M20 12H10a6 6 0 000 12h2",
    trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6",
    copy: "M9 9h11v11H9zM5 15H4V4h11v1",
    edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z",
    eyeOff: "M3 3l18 18M10.6 5.2A9.7 9.7 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.6A17 17 0 002 12s4 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 004.2 4.2",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l5 5",
    menu: "M4 6h16M4 12h16M4 18h16",
    more: "M12 5.5v.01M12 12v.01M12 18.5v.01",
    fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
    share: "M8 12a3 3 0 11-6 0 3 3 0 016 0zM22 6a3 3 0 11-6 0 3 3 0 016 0zM22 18a3 3 0 11-6 0 3 3 0 016 0zM7.6 10.6l8.8-3.6M7.6 13.4l8.8 3.6",
    history: "M4 12a8 8 0 108-8 8 8 0 00-6 2.7L4 9M4 4v5h5M12 8v4l3 2",
    print: "M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z",
    download: "M12 4v11M7 11l5 5 5-5M5 20h14",
    upload: "M12 16V5M7 9l5-5 5 5M5 20h14",
    settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
    up: "M6 15l6-6 6 6",
    down: "M6 9l6 6 6-6",
    check: "M5 12l5 5 9-10",
    bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
    logout: "M10 5H5v14h5M14 8l4 4-4 4M18 12H9",
    link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 18 }: { name: IconName; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={PATHS[name]} />
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
