import { useId, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import * as RadioPrimitive from "@radix-ui/react-radio-group";
import { Check, KeyRound, Star } from "lucide-react";
import { RadioGroup } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { estimativasQuery, precosQuery } from "@/lib/queries";
import { custoApiUSD, formatUSD, type Motor, type Roteiro } from "@/lib/fatia";
import { cn } from "@/lib/utils";

export interface MotorChoiceProps extends Omit<ComponentProps<typeof RadioGroup>, "value" | "onValueChange" | "children"> {
  value: Motor | null;
  options: readonly Motor[];
  roteiro: Roteiro | null;
  onChange: (motor: Motor) => void;
  invalid?: boolean;
}

export function MotorChoice({ value, options, roteiro, onChange, invalid, className, ...props }: MotorChoiceProps) {
  const id = useId();
  const { data: estimativas = [] } = useQuery(estimativasQuery);
  const { data: precos = [] } = useQuery(precosQuery);
  const estimativa = estimativas.find((e) => e.roteiro === roteiro);
  const preco = precos[0];
  const custo = preco && estimativa ? `≈ ${formatUSD(custoApiUSD(estimativa, preco))} nesta análise` : "cobrado pela Anthropic";

  return (
    <RadioGroup {...props} value={value ?? ""} orientation="vertical" aria-invalid={invalid || undefined}
      onValueChange={(motor) => { if (motor === "api" || motor === "assinatura") onChange(motor); }}
      className={cn("w-full gap-2 rounded-[14px]", invalid && "ring-2 ring-destructive/25 ring-offset-2", className)}>
      {options.map((motor) => {
        const selected = value === motor;
        const Icon = motor === "api" ? KeyRound : Star;
        return (
          <RadioPrimitive.Item key={motor} value={motor} asChild aria-labelledby={`${id}-${motor}-title`} aria-describedby={`${id}-${motor}-hint`}>
            <Button variant="ghost" className={cn(
              "h-auto min-h-[74px] w-full justify-start gap-3 whitespace-normal rounded-[14px] border p-3 text-left shadow-none focus-visible:ring-2",
              selected ? "border-2 border-primary bg-primary/6 hover:bg-primary/6" : "border-input bg-transparent hover:bg-choice-hover",
            )}>
              <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground", motor === "api" ? "bg-g-orange" : "bg-g-purple")}><Icon /></span>
              <span className="min-w-0 flex-1">
                <span id={`${id}-${motor}-title`} className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-5">
                  {motor === "api" ? "Sua chave de API" : "Sua assinatura"}
                  {motor === "assinatura" && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary-ink">admin</span>}
                </span>
                <span id={`${id}-${motor}-hint`} className="mt-0.5 block text-xs font-normal leading-4 text-muted-foreground">{motor === "api" ? custo : "sem cobrança extra · usa o limite do plano"}</span>
              </span>
              <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center text-primary-ink">{selected && <Check />}</span>
            </Button>
          </RadioPrimitive.Item>
        );
      })}
    </RadioGroup>
  );
}