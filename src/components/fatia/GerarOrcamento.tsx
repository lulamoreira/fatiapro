import { useState } from "react";
import { FileText } from "lucide-react";
import { useNegocio } from "@/hooks/use-negocio";
import { lerPrecos, nomeSemExtensao } from "@/lib/orcamento";
import { Button } from "@/components/ui/button";
import { OrcamentoDialog } from "./OrcamentoDialog";
import { NegocioPendente } from "./NegocioPendente";

/** "Gerar orçamento em PDF" under a finished price analysis. */
export function GerarOrcamento({ jobId, nomePeca, conteudo }: { jobId: string; nomePeca: string | null; conteudo: unknown }) {
  const { data: negocio, isLoading } = useNegocio();
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState(false);
  return (
    <div className="flex justify-end">
      <Button variant="secondary" disabled={isLoading} onClick={() => (negocio ? setAberto(true) : setAviso(true))}>
        <FileText className="size-4" aria-hidden />Gerar orçamento em PDF
      </Button>
      {aberto && <OrcamentoDialog open={aberto} onOpenChange={setAberto} jobId={jobId} descricaoInicial={nomeSemExtensao(nomePeca ?? "")} precos={lerPrecos(conteudo)} />}
      <NegocioPendente open={aviso} onOpenChange={setAviso} />
    </div>
  );
}
