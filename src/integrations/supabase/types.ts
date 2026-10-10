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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      medical_records: {
        Row: {
          amount: number | null
          created_at: string
          date: string
          doctor: string
          extracted_data: Json | null
          medications: Json | null
          bill_items: Json | null
          bill_summary: Json | null
          file_name: string
          file_path: string | null
          hospital: string
          id: string
          notes: string | null
          patient_name: string | null
          processing_status: string
          reviewed_at: string | null
          status: string
          summary: string | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          date?: string
          doctor?: string
          extracted_data?: Json | null
          medications?: Json | null
          bill_items?: Json | null
          bill_summary?: Json | null
          file_name: string
          file_path?: string | null
          hospital?: string
          id?: string
          notes?: string | null
          patient_name?: string | null
          processing_status?: string
          reviewed_at?: string | null
          status?: string
          summary?: string | null
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          date?: string
          doctor?: string
          extracted_data?: Json | null
          medications?: Json | null
          bill_items?: Json | null
          bill_summary?: Json | null
          file_name?: string
          file_path?: string | null
          hospital?: string
          id?: string
          notes?: string | null
          patient_name?: string | null
          processing_status?: string
          reviewed_at?: string | null
          status?: string
          summary?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ml_training_datasets: {
        Row: {
          confidence_score: number | null
          created_at: string
          features: Json
          id: string
          labels: Json
          model_type: string
          record_id: string | null
          user_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          features?: Json
          id?: string
          labels?: Json
          model_type?: string
          record_id?: string | null
          user_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          features?: Json
          id?: string
          labels?: Json
          model_type?: string
          record_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ml_training_datasets_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          analytics_opt_in: boolean
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          analytics_opt_in?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          analytics_opt_in?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: string | null
          row_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip?: string | null
          row_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: string | null
          row_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          success: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      prediction_reviews: {
        Row: {
          id: string
          patient_user_id: string
          condition: string
          original_risk_level: string
          original_probability: number
          action: string
          override_risk_level: string | null
          note: string | null
          reviewed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_user_id: string
          condition: string
          original_risk_level: string
          original_probability: number
          action: string
          override_risk_level?: string | null
          note?: string | null
          reviewed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_user_id?: string
          condition?: string
          original_risk_level?: string
          original_probability?: number
          action?: string
          override_risk_level?: string | null
          note?: string | null
          reviewed_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      model_training_runs: {
        Row: {
          dataset_size: number
          metrics_json: Json
          model_version: string
          run_id: string
          target: string
          trained_at: string
          trained_by: string
        }
        Insert: {
          dataset_size: number
          metrics_json: Json
          model_version: string
          run_id?: string
          target: string
          trained_at?: string
          trained_by?: string
        }
        Update: {
          dataset_size?: number
          metrics_json?: Json
          model_version?: string
          run_id?: string
          target?: string
          trained_at?: string
          trained_by?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_risk_trends: {
        Row: {
          user_id: string | null
          record_id: string
          date: string | null
          type: string
          status: string | null
          extracted_data: Json | null
          created_at: string
        }
      }
      population_health_aggregates: {
        Row: {
          type: string
          status: string | null
          month: string | null
          record_count: number
        }
      }
      model_performance_over_time: {
        Row: {
          target: string
          model_version: string
          trained_at: string
          dataset_size: number
          selected_model: string | null
          test_auc: number | null
          test_f1: number | null
          test_brier_score: number | null
        }
      }
    }
    Functions: {
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_clinician_or_admin: {
        Args: {
          _user_id: string
        }
        Returns: boolean
      }
      is_account_locked: {
        Args: {
          _email: string
        }
        Returns: boolean
      }
      record_login_attempt: {
        Args: {
          _email: string
          _success: boolean
          _user_agent?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "patient" | "clinician" | "admin"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["patient", "clinician", "admin"],
    },
  },
} as const
