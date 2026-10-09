export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit: {
        Row: {
          acao: string
          admin_id: string
          alvo_user_id: string
          criado_em: string
          detalhe: Json
          id: string
        }
        Insert: {
          acao: string
          admin_id: string
          alvo_user_id: string
          criado_em?: string
          detalhe?: Json
          id?: string
        }
        Update: {
          acao?: string
          admin_id?: string
          alvo_user_id?: string
          criado_em?: string
          detalhe?: Json
          id?: string
        }
        Relationships: []
      }
      app_admins: {
        Row: {
          criado_em: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          user_id: string
        }
        Update: {
          criado_em?: string
          user_id?: string
        }
        Relationships: []
      }
      config_app: {
        Row: {
          chave: string
          valor: Json
        }
        Insert: {
          chave: string
          valor: Json
        }
        Update: {
          chave?: string
          valor?: Json
        }
        Relationships: []
      }
      cortesias: {
        Row: {
          admin_id: string | null
          ativa: boolean
          criado_em: string
          fim: string | null
          id: string
          inicio: string
          motivo: string | null
          por_dia: number | null
          premium: boolean
          tipo: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          ativa?: boolean
          criado_em?: string
          fim?: string | null
          id?: string
          inicio?: string
          motivo?: string | null
          por_dia?: number | null
          premium?: boolean
          tipo: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          ativa?: boolean
          criado_em?: string
          fim?: string | null
          id?: string
          inicio?: string
          motivo?: string | null
          por_dia?: number | null
          premium?: boolean
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      creditos_lotes: {
        Row: {
          criado_em: string
          expira_em: string | null
          id: string
          origem: string
          quantidade: number
          referencia: string | null
          restante: number
          user_id: string
        }
        Insert: {
          criado_em?: string
          expira_em?: string | null
          id?: string
          origem: string
          quantidade: number
          referencia?: string | null
          restante: number
          user_id: string
        }
        Update: {
          criado_em?: string
          expira_em?: string | null
          id?: string
          origem?: string
          quantidade?: number
          referencia?: string | null
          restante?: number
          user_id?: string
        }
        Relationships: []
      }
      creditos_movimentos: {
        Row: {
          admin_id: string | null
          criado_em: string
          id: string
          job_id: string | null
          lote_id: string | null
          motivo: string | null
          quantidade: number
          tipo: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          criado_em?: string
          id?: string
          job_id?: string | null
          lote_id?: string | null
          motivo?: string | null
          quantidade: number
          tipo: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          criado_em?: string
          id?: string
          job_id?: string | null
          lote_id?: string | null
          motivo?: string | null
          quantidade?: number
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creditos_movimentos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_movimentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "creditos_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      cupom_tentativas: {
        Row: {
          criado_em: string
          id: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      cupom_usos: {
        Row: {
          criado_em: string
          cupom_id: string
          id: string
          lote_id: string | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          cupom_id: string
          id?: string
          lote_id?: string | null
          user_id: string
        }
        Update: {
          criado_em?: string
          cupom_id?: string
          id?: string
          lote_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cupom_usos_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupom_usos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "creditos_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          ativo: boolean
          codigo: string
          creditos: number
          criado_em: string
          criado_por: string | null
          fim: string | null
          id: string
          inicio: string
          limite_total: number | null
          so_primeira_compra: boolean
          usos: number
          validade_dias: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          creditos: number
          criado_em?: string
          criado_por?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          limite_total?: number | null
          so_primeira_compra?: boolean
          usos?: number
          validade_dias?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          creditos?: number
          criado_em?: string
          criado_por?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          limite_total?: number | null
          so_primeira_compra?: boolean
          usos?: number
          validade_dias?: number
        }
        Relationships: []
      }
      device_commands: {
        Row: {
          atualizado_em: string
          criado_em: string
          device_id: string
          estado: string
          id: string
          parametros: Json
          resposta: Json | null
          tipo: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          device_id: string
          estado?: string
          id?: string
          parametros?: Json
          resposta?: Json | null
          tipo: string
          user_id?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          device_id?: string
          estado?: string
          id?: string
          parametros?: Json
          resposta?: Json | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          criado_em: string
          id: string
          impressoras_escolhidas: Json
          limite_gasto_usd: number
          maquina_hash: string | null
          nome: string
          relatorio: Json
          revogado: boolean
          sistema: string
          token_hash: string
          ultimo_contato: string | null
          user_id: string
          usos_claude: string[]
          versao_ponte: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          impressoras_escolhidas?: Json
          limite_gasto_usd?: number
          maquina_hash?: string | null
          nome: string
          relatorio?: Json
          revogado?: boolean
          sistema: string
          token_hash: string
          ultimo_contato?: string | null
          user_id: string
          usos_claude?: string[]
          versao_ponte?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          impressoras_escolhidas?: Json
          limite_gasto_usd?: number
          maquina_hash?: string | null
          nome?: string
          relatorio?: Json
          revogado?: boolean
          sistema?: string
          token_hash?: string
          ultimo_contato?: string | null
          user_id?: string
          usos_claude?: string[]
          versao_ponte?: string | null
        }
        Relationships: []
      }
      estimativas_roteiro: {
        Row: {
          fatiamentos_tipicos: number
          roteiro: string
          tokens_entrada_tipicos: number
          tokens_saida_tipicos: number
        }
        Insert: {
          fatiamentos_tipicos: number
          roteiro: string
          tokens_entrada_tipicos: number
          tokens_saida_tipicos: number
        }
        Update: {
          fatiamentos_tipicos?: number
          roteiro?: string
          tokens_entrada_tipicos?: number
          tokens_saida_tipicos?: number
        }
        Relationships: []
      }
      feedback_respostas: {
        Row: {
          comentario: string | null
          criado_em: string
          fez_sentido: string
          id: string
          imprimiu: string
          job_id: string
          problemas: string[]
          tempo_poupado: string | null
          user_id: string
        }
        Insert: {
          comentario?: string | null
          criado_em?: string
          fez_sentido: string
          id?: string
          imprimiu: string
          job_id: string
          problemas?: string[]
          tempo_poupado?: string | null
          user_id?: string
        }
        Update: {
          comentario?: string | null
          criado_em?: string
          fez_sentido?: string
          id?: string
          imprimiu?: string
          job_id?: string
          problemas?: string[]
          tempo_poupado?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_respostas_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_chamadas: {
        Row: {
          cache_escrita: number
          cache_leitura: number
          criado_em: string
          custo_usd: number
          duracao_ms: number
          entrada: number
          id: string
          job_id: string
          modelo: string
          saida: number
          user_id: string
        }
        Insert: {
          cache_escrita?: number
          cache_leitura?: number
          criado_em?: string
          custo_usd?: number
          duracao_ms?: number
          entrada?: number
          id?: string
          job_id: string
          modelo: string
          saida?: number
          user_id: string
        }
        Update: {
          cache_escrita?: number
          cache_leitura?: number
          criado_em?: string
          custo_usd?: number
          duracao_ms?: number
          entrada?: number
          id?: string
          job_id?: string
          modelo?: string
          saida?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_chamadas_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_events: {
        Row: {
          conteudo: Json
          criado_em: string
          id: string
          job_id: string
          tipo: string
        }
        Insert: {
          conteudo?: Json
          criado_em?: string
          id?: string
          job_id: string
          tipo: string
        }
        Update: {
          conteudo?: Json
          criado_em?: string
          id?: string
          job_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          arquivo_path: string | null
          atualizado_em: string
          creditos_reservados: number
          criado_em: string
          custo_real: Json | null
          device_id: string | null
          estado: string
          fatiador: string | null
          fonte: string | null
          id: string
          motor: string
          nome_peca: string | null
          opcoes: Json
          premium: boolean
          resultado: Json | null
          roteiro: string
          user_id: string
        }
        Insert: {
          arquivo_path?: string | null
          atualizado_em?: string
          creditos_reservados?: number
          criado_em?: string
          custo_real?: Json | null
          device_id?: string | null
          estado?: string
          fatiador?: string | null
          fonte?: string | null
          id?: string
          motor: string
          nome_peca?: string | null
          opcoes?: Json
          premium?: boolean
          resultado?: Json | null
          roteiro: string
          user_id?: string
        }
        Update: {
          arquivo_path?: string | null
          atualizado_em?: string
          creditos_reservados?: number
          criado_em?: string
          custo_real?: Json | null
          device_id?: string | null
          estado?: string
          fatiador?: string | null
          fonte?: string | null
          id?: string
          motor?: string
          nome_peca?: string | null
          opcoes?: Json
          premium?: boolean
          resultado?: Json | null
          roteiro?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinas_teste: {
        Row: {
          criado_em: string
          maquina_hash: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          maquina_hash: string
          user_id: string
        }
        Update: {
          criado_em?: string
          maquina_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      mp_eventos: {
        Row: {
          criado_em: string
          id: string
          motivo: string | null
          origem: string | null
          payment_id: string | null
          status: string | null
          valido: boolean
        }
        Insert: {
          criado_em?: string
          id?: string
          motivo?: string | null
          origem?: string | null
          payment_id?: string | null
          status?: string | null
          valido?: boolean
        }
        Update: {
          criado_em?: string
          id?: string
          motivo?: string | null
          origem?: string | null
          payment_id?: string | null
          status?: string | null
          valido?: boolean
        }
        Relationships: []
      }
      pacotes: {
        Row: {
          ativo: boolean
          creditos: number
          criado_em: string
          destaque: boolean
          id: string
          nome: string
          ordem: number
          preco_centavos: number
          validade_meses: number
        }
        Insert: {
          ativo?: boolean
          creditos: number
          criado_em?: string
          destaque?: boolean
          id?: string
          nome: string
          ordem?: number
          preco_centavos: number
          validade_meses?: number
        }
        Update: {
          ativo?: boolean
          creditos?: number
          criado_em?: string
          destaque?: boolean
          id?: string
          nome?: string
          ordem?: number
          preco_centavos?: number
          validade_meses?: number
        }
        Relationships: []
      }
      pair_attempts: {
        Row: {
          criado_em: string
          id: string
          ip: string
        }
        Insert: {
          criado_em?: string
          id?: string
          ip: string
        }
        Update: {
          criado_em?: string
          id?: string
          ip?: string
        }
        Relationships: []
      }
      pairing_codes: {
        Row: {
          codigo_hash: string
          criado_em: string
          expira_em: string
          id: string
          usado: boolean
          user_id: string
        }
        Insert: {
          codigo_hash: string
          criado_em?: string
          expira_em: string
          id?: string
          usado?: boolean
          user_id: string
        }
        Update: {
          codigo_hash?: string
          criado_em?: string
          expira_em?: string
          id?: string
          usado?: boolean
          user_id?: string
        }
        Relationships: []
      }
      pecas: {
        Row: {
          arquivo_original_path: string | null
          arquivo_otimizado_path: string | null
          atualizado_em: string
          criado_em: string
          id: string
          job_id: string | null
          nome: string
          nome_arquivo_original: string | null
          nome_arquivo_otimizado: string | null
          observacao: string | null
          user_id: string
        }
        Insert: {
          arquivo_original_path?: string | null
          arquivo_otimizado_path?: string | null
          atualizado_em?: string
          criado_em?: string
          id?: string
          job_id?: string | null
          nome: string
          nome_arquivo_original?: string | null
          nome_arquivo_otimizado?: string | null
          observacao?: string | null
          user_id?: string
        }
        Update: {
          arquivo_original_path?: string | null
          arquivo_otimizado_path?: string | null
          atualizado_em?: string
          criado_em?: string
          id?: string
          job_id?: string | null
          nome?: string
          nome_arquivo_original?: string | null
          nome_arquivo_otimizado?: string | null
          observacao?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pecas_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          atualizado_em: string
          conferido_em: string | null
          creditos: number
          criado_em: string
          id: string
          lote_id: string | null
          metodo: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          pacote_id: string
          pago_em: string | null
          status: string
          user_id: string
          valor_centavos: number
        }
        Insert: {
          atualizado_em?: string
          conferido_em?: string | null
          creditos: number
          criado_em?: string
          id?: string
          lote_id?: string | null
          metodo?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          pacote_id: string
          pago_em?: string | null
          status?: string
          user_id: string
          valor_centavos: number
        }
        Update: {
          atualizado_em?: string
          conferido_em?: string | null
          creditos?: number
          criado_em?: string
          id?: string
          lote_id?: string | null
          metodo?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          pacote_id?: string
          pago_em?: string | null
          status?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "creditos_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "pacotes"
            referencedColumns: ["id"]
          },
        ]
      }
      ponte_versoes: {
        Row: {
          arquivo_path: string
          assinatura: string
          criado_em: string
          id: string
          nome_arquivo: string
          notas: string | null
          plataforma: string
          publicada: boolean
          publicada_por_assinatura: boolean
          sha256: string
          tamanho_bytes: number
          versao: string
        }
        Insert: {
          arquivo_path: string
          assinatura: string
          criado_em?: string
          id?: string
          nome_arquivo: string
          notas?: string | null
          plataforma: string
          publicada?: boolean
          publicada_por_assinatura?: boolean
          sha256: string
          tamanho_bytes: number
          versao: string
        }
        Update: {
          arquivo_path?: string
          assinatura?: string
          criado_em?: string
          id?: string
          nome_arquivo?: string
          notas?: string | null
          plataforma?: string
          publicada?: boolean
          publicada_por_assinatura?: boolean
          sha256?: string
          tamanho_bytes?: number
          versao?: string
        }
        Relationships: []
      }
      presets: {
        Row: {
          criado_em: string
          id: string
          nome: string
          opcoes: Json
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
          opcoes?: Json
          user_id?: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          opcoes?: Json
          user_id?: string
        }
        Relationships: []
      }
      price_table: {
        Row: {
          atualizado_em: string
          modelo: string
          preco_entrada_usd_por_milhao: number
          preco_saida_usd_por_milhao: number
        }
        Insert: {
          atualizado_em?: string
          modelo: string
          preco_entrada_usd_por_milhao: number
          preco_saida_usd_por_milhao: number
        }
        Update: {
          atualizado_em?: string
          modelo?: string
          preco_entrada_usd_por_milhao?: number
          preco_saida_usd_por_milhao?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          criado_em: string
          id: string
          nome: string | null
          termos_aceitos_em: string | null
          termos_versao: string | null
        }
        Insert: {
          criado_em?: string
          id: string
          nome?: string | null
          termos_aceitos_em?: string | null
          termos_versao?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string | null
          termos_aceitos_em?: string | null
          termos_versao?: string | null
        }
        Relationships: []
      }
      testes_gratis: {
        Row: {
          fim: string
          inicio: string
          maquina_hash: string | null
          user_id: string
        }
        Insert: {
          fim?: string
          inicio?: string
          maquina_hash?: string | null
          user_id: string
        }
        Update: {
          fim?: string
          inicio?: string
          maquina_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_termos: { Args: { p_versao: string }; Returns: undefined }
      admin_dar_creditos: {
        Args: {
          p_admin: string
          p_motivo: string
          p_origem: string
          p_qtd: number
          p_user: string
          p_validade_dias: number
        }
        Returns: string
      }
      admin_remover_creditos: {
        Args: {
          p_admin: string
          p_motivo: string
          p_qtd: number
          p_user: string
        }
        Returns: undefined
      }
      admin_resetar_meu_aceite: { Args: never; Returns: undefined }
      claim_next_command: {
        Args: { p_device_id: string }
        Returns: {
          atualizado_em: string
          criado_em: string
          device_id: string
          estado: string
          id: string
          parametros: Json
          resposta: Json | null
          tipo: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "device_commands"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_next_job: {
        Args: { p_device_id: string }
        Returns: {
          arquivo_path: string | null
          atualizado_em: string
          creditos_reservados: number
          criado_em: string
          custo_real: Json | null
          device_id: string | null
          estado: string
          fatiador: string | null
          fonte: string | null
          id: string
          motor: string
          nome_peca: string | null
          opcoes: Json
          premium: boolean
          resultado: Json | null
          roteiro: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_pairing_code: {
        Args: never
        Returns: {
          codigo: string
          expira_em: string
        }[]
      }
      creditar_pedido: {
        Args: { p_metodo: string; p_payment_id: string; p_pedido: string }
        Returns: string
      }
      criar_analise: {
        Args: {
          p_arquivo_path: string
          p_device: string
          p_fatiador: string
          p_motor: string
          p_nome_peca: string
          p_opcoes: Json
          p_premium: boolean
          p_roteiro: string
          p_user: string
        }
        Returns: Json
      }
      estornar_credito: { Args: { p_job: string }; Returns: undefined }
      estornar_pedido: {
        Args: { p_motivo: string; p_pedido: string }
        Returns: undefined
      }
      impressoras_escolhidas_valido: { Args: { v: Json }; Returns: boolean }
      inicio_dia_sp: { Args: { p?: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      job_contou: {
        Args: { p_estado: string; p_job: string }
        Returns: boolean
      }
      reservar_credito: {
        Args: { p_job: string; p_qtd: number; p_user: string }
        Returns: undefined
      }
      resgatar_cupom: {
        Args: { p_codigo: string; p_user: string }
        Returns: Json
      }
      saldo_creditos: { Args: { p_user: string }; Returns: number }
      vencer_lotes: { Args: { p_user: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
