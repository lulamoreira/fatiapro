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
          limite_gasto_usd: number
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
          limite_gasto_usd?: number
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
          limite_gasto_usd?: number
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
          criado_em: string
          custo_real: Json | null
          device_id: string | null
          estado: string
          fatiador: string | null
          id: string
          motor: string
          nome_peca: string | null
          opcoes: Json
          resultado: Json | null
          roteiro: string
          user_id: string
        }
        Insert: {
          arquivo_path?: string | null
          atualizado_em?: string
          criado_em?: string
          custo_real?: Json | null
          device_id?: string | null
          estado?: string
          fatiador?: string | null
          id?: string
          motor: string
          nome_peca?: string | null
          opcoes?: Json
          resultado?: Json | null
          roteiro: string
          user_id?: string
        }
        Update: {
          arquivo_path?: string | null
          atualizado_em?: string
          criado_em?: string
          custo_real?: Json | null
          device_id?: string | null
          estado?: string
          fatiador?: string | null
          id?: string
          motor?: string
          nome_peca?: string | null
          opcoes?: Json
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
        }
        Insert: {
          criado_em?: string
          id: string
          nome?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
          criado_em: string
          custo_real: Json | null
          device_id: string | null
          estado: string
          fatiador: string | null
          id: string
          motor: string
          nome_peca: string | null
          opcoes: Json
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
      is_admin: { Args: never; Returns: boolean }
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
