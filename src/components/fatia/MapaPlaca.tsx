import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export interface MapaPlacaDados {
  mesa: [number, number, number, number];
  forma: [number, number][];
  pecas: [number, number, number][];
  torre?: { x: number; y: number; largura: number; profundidade: number; borda: number };
}

export interface MapaPlacaProps extends ComponentProps<"figure"> {
  mapa: MapaPlacaDados;
  miniatura?: boolean;
}

/** Rotate in printer coordinates first; invert Y only for SVG output. */
export function pontosDaPeca(forma: MapaPlacaDados["forma"], [x, y, giro]: MapaPlacaDados["pecas"][number]): string {
  const g = giro * Math.PI / 180;
  return forma.map(([fx, fy]) => {
    const px = x + fx * Math.cos(g) - fy * Math.sin(g);
    const py = y + fx * Math.sin(g) + fy * Math.cos(g);
    return `${Number(px.toFixed(6))},${Number((-py).toFixed(6))}`;
  }).join(" ");
}

function grade(inicio: number, fim: number): number[] {
  const primeiro = Math.ceil(inicio / 50) * 50;
  const quantidade = Math.floor((fim - primeiro) / 50) + 1;
  return Array.from({ length: Math.max(0, Math.min(quantidade, 200)) }, (_, i) => primeiro + i * 50);
}

export function MapaPlaca({ mapa, miniatura = false, className, ...props }: MapaPlacaProps) {
  if (!Array.isArray(mapa?.mesa) || mapa.mesa.length !== 4 || !mapa.mesa.every(Number.isFinite)
    || !Array.isArray(mapa.forma) || mapa.forma.length < 3 || !Array.isArray(mapa.pecas)
    || !mapa.forma.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
    || !mapa.pecas.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))) return null;
  const [x0, y0, x1, y1] = mapa.mesa;
  const largura = x1 - x0;
  const altura = y1 - y0;
  if (largura <= 0 || altura <= 0) return null;
  const t = mapa.torre;
  const torre = t && [t.x, t.y, t.largura, t.profundidade, t.borda].every(Number.isFinite)
    && t.largura > 0 && t.profundidade > 0 && t.borda >= 0 ? t : null;
  const legenda = `Placa 1 vista de cima · ${mapa.pecas.length} peças${torre ? " · torre aproximada" : ""}`;
  return (
    <figure className={cn(miniatura ? "w-24 shrink-0" : "w-full max-w-[420px]", className)} {...props}>
      <svg viewBox={`${x0} ${-y1} ${largura} ${altura}`} role="img" aria-label={legenda} className="block h-auto w-full overflow-hidden rounded-md">
        <rect x={x0} y={-y1} width={largura} height={altura} className="fill-card stroke-muted-foreground" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <g className="stroke-border" strokeWidth={0.5}>
          {grade(x0, x1).map((x) => <line key={`x-${x}`} x1={x} x2={x} y1={-y1} y2={-y0} vectorEffect="non-scaling-stroke" />)}
          {grade(y0, y1).map((y) => <line key={`y-${y}`} x1={x0} x2={x1} y1={-y} y2={-y} vectorEffect="non-scaling-stroke" />)}
        </g>
        <g className="fill-primary/35 stroke-primary" strokeWidth={0.7}>
          {mapa.pecas.map((peca, i) => <polygon key={`${peca.join(",")}-${i}`} points={pontosDaPeca(mapa.forma, peca)} vectorEffect="non-scaling-stroke" />)}
        </g>
        {torre && (
          <g aria-label="Torre">
            <rect x={torre.x - torre.borda} y={-(torre.y + torre.profundidade + torre.borda)} width={torre.largura + 2 * torre.borda} height={torre.profundidade + 2 * torre.borda} className="fill-warning/30 stroke-warning" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
            <text x={torre.x + torre.largura / 2} y={-(torre.y + torre.profundidade / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(largura, altura) / 30} className="fill-foreground">Torre</text>
          </g>
        )}
      </svg>
      <figcaption className={cn("mt-2 text-xs text-muted-foreground", miniatura && "sr-only")}>{legenda}</figcaption>
    </figure>
  );
}