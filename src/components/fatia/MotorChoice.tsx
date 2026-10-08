import { useId, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import * as RadioPrimitive from "@radix-ui/react-radio-group";
import { Check, KeyRound, Sparkles, Star } from "lucide-react";
import { RadioGroup } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { estimativasQuery, precosQuery } from "@/lib/queries";
import { custoEstimadoUSD, formatUSDEstimado, type Motor, type Roteiro } from "@/lib/fatia";
import { cn } from "@/lib/utils";

/** Rendered only for admins (common users have a single FatiaProAI engine and see no choice). */
export interface MotorChoiceProps extends Omit<ComponentProps<typeof RadioGroup>, "value" | "onValueChange" | "onChange" | "children"> {
  value: Motor | null;
  options: readonly Motor[];
  roteiro: Roteiro | null;
  onChange: (motor: Motor) => void;
  premium?: boolean;
  invalid?: boolean;
}

const ICONE = { fatiapro: Sparkles, api: KeyRound, assinatura: Star } as const;
const GRAD = { fatiapro: "bg-g-blue", api: "bg-g-orange", assinatura: "bg-g-purple" } as const;
const TITULO = { fatiapro: "FatiaProAI", api: "Minha chave de API", assinatura: "Minha assinatura Claude" } as const;

export function MotorChoice({ value, options, roteiro, onChange, invalid, premium = false, className, ...props }: MotorChoiceProps) {
  const id = useId();
  const { data: estimativas = [] } = useQuery(estimativasQuery);
  const { data: precos = [] } = useQuery(precosQuery);
  const estimativa = estimativas.find((e) => e.roteiro === roteiro);
  const usd = estimativa ? custoEstimadoUSD(estimativa, precos, premium) : null;
  const apoio = {
    fatiapro: "usa créditos como qualquer usuário",
    api: usd != null ? `≈ ${formatUSDEstimado(usd)} nesta análise · sem crédito` : "cobrado pela Anthropic · sem crédito",
    assinatura: "sem cobrança extra · usa o limite do plano",
  } as const;

  return (
    <RadioGroup {...props} value={value ?? ""} orientation="vertical" aria-invalid={invalid || undefined}
      onValueChange={(m) => { if ((options as readonly string[]).includes(m)) onChange(m as Motor); }}
      className={cn("w-full gap-2 rounded-[14px]", invalid && "ring-2 ring-destructive/25 ring-offset-2", className)}>
      {(["fatiapro", "api", "assinatura"] as const).filter((m) => options.includes(m)).map((motor) => {
        const selected = value === motor;
        const Icon = ICONE[motor];
        return (
          <RadioPrimitive.Item key={motor} value={motor} asChild aria-labelledby={`${id}-${motor}-title`} aria-describedby={`${id}-${motor}-hint`}>
            <Button variant="ghost" className={cn(
              "h-auto min-h-[74px] w-full justify-start gap-3 whitespace-normal rounded-[14px] border p-3 text-left shadow-none focus-visible:ring-2",
              selected ? "border-2 border-primary bg-primary/6 hover:bg-primary/6" : "border-input bg-transparent hover:bg-choice-hover",
            )}>
              <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground", GRAD[motor])}><Icon /></span>
              <span className="min-w-0 flex-1">
                <span id={`${id}-${motor}-title`} className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-5">
                  {TITULO[motor]}
                  {motor !== "fatiapro" && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary-ink">admin</span>}
                </span>
                <span id={`${id}-${motor}-hint`} className="mt-0.5 block text-xs font-normal leading-4 text-muted-foreground">{apoio[motor]}</span>
              </span>
              <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center text-primary-ink">{selected && <Check />}</span>
            </Button>
          </RadioPrimitive.Item>
        );
      })}
    </RadioGroup>
  );
}
