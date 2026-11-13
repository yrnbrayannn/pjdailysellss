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
      butchery_sales: {
        Row: {
          check_status: Database["public"]["Enums"]["check_status_enum"] | null
          cost_kshs: number
          created_at: string
          created_by: string | null
          id: string
          meat_item: string
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          price_per_kg: number
          quantity_kg: number
          sale_date: string
          shift: Database["public"]["Enums"]["shift_enum"]
        }
        Insert: {
          check_status?: Database["public"]["Enums"]["check_status_enum"] | null
          cost_kshs: number
          created_at?: string
          created_by?: string | null
          id?: string
          meat_item: string
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          price_per_kg: number
          quantity_kg: number
          sale_date?: string
          shift: Database["public"]["Enums"]["shift_enum"]
        }
        Update: {
          check_status?: Database["public"]["Enums"]["check_status_enum"] | null
          cost_kshs?: number
          created_at?: string
          created_by?: string | null
          id?: string
          meat_item?: string
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          price_per_kg?: number
          quantity_kg?: number
          sale_date?: string
          shift?: Database["public"]["Enums"]["shift_enum"]
        }
        Relationships: []
      }
      butchery_stock: {
        Row: {
          counted_by: string | null
          counted_kg: number | null
          created_at: string
          expected_kg: number | null
          id: string
          meat_item: string
          missing_or_extra_kg: number | null
          shift: Database["public"]["Enums"]["shift_enum"]
          stock_date: string
        }
        Insert: {
          counted_by?: string | null
          counted_kg?: number | null
          created_at?: string
          expected_kg?: number | null
          id?: string
          meat_item: string
          missing_or_extra_kg?: number | null
          shift: Database["public"]["Enums"]["shift_enum"]
          stock_date?: string
        }
        Update: {
          counted_by?: string | null
          counted_kg?: number | null
          created_at?: string
          expected_kg?: number | null
          id?: string
          meat_item?: string
          missing_or_extra_kg?: number | null
          shift?: Database["public"]["Enums"]["shift_enum"]
          stock_date?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          paid_from: Database["public"]["Enums"]["payment_method_enum"]
          shift: Database["public"]["Enums"]["shift_enum"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          paid_from: Database["public"]["Enums"]["payment_method_enum"]
          shift: Database["public"]["Enums"]["shift_enum"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          paid_from?: Database["public"]["Enums"]["payment_method_enum"]
          shift?: Database["public"]["Enums"]["shift_enum"]
        }
        Relationships: []
      }
      hotel_sales: {
        Row: {
          cash_received: number | null
          check_status: Database["public"]["Enums"]["check_status_enum"] | null
          created_at: string
          created_by: string | null
          food_item: string
          id: string
          mpesa_part: number | null
          mpesa_received: number | null
          notes: string | null
          order_type: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          sale_date: string
          shift: Database["public"]["Enums"]["shift_enum"]
          table_no: string | null
          total_cost: number
        }
        Insert: {
          cash_received?: number | null
          check_status?: Database["public"]["Enums"]["check_status_enum"] | null
          created_at?: string
          created_by?: string | null
          food_item: string
          id?: string
          mpesa_part?: number | null
          mpesa_received?: number | null
          notes?: string | null
          order_type?: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          sale_date?: string
          shift: Database["public"]["Enums"]["shift_enum"]
          table_no?: string | null
          total_cost: number
        }
        Update: {
          cash_received?: number | null
          check_status?: Database["public"]["Enums"]["check_status_enum"] | null
          created_at?: string
          created_by?: string | null
          food_item?: string
          id?: string
          mpesa_part?: number | null
          mpesa_received?: number | null
          notes?: string | null
          order_type?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          sale_date?: string
          shift?: Database["public"]["Enums"]["shift_enum"]
          table_no?: string | null
          total_cost?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category: string
          created_at: string
          id: string
          item_name: string
          selling_price: number
          unit_type: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          item_name: string
          selling_price: number
          unit_type?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          item_name?: string
          selling_price?: number
          unit_type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      check_status_enum:
        | "OK"
        | "FILL IN MISSING"
        | "CHECK SPLIT"
        | "UNPAID"
        | "CHECK PRICE"
      payment_method_enum:
        | "Cash"
        | "M-Pesa"
        | "Cash + M-Pesa"
        | "Unpaid"
        | "Owner"
        | "Internal Transfer"
      shift_enum: "Day" | "Night"
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
    Enums: {
      check_status_enum: [
        "OK",
        "FILL IN MISSING",
        "CHECK SPLIT",
        "UNPAID",
        "CHECK PRICE",
      ],
      payment_method_enum: [
        "Cash",
        "M-Pesa",
        "Cash + M-Pesa",
        "Unpaid",
        "Owner",
        "Internal Transfer",
      ],
      shift_enum: ["Day", "Night"],
    },
  },
} as const
