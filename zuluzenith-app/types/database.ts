// types/database.ts
// Hand-written starter types matching supabase/migrations/0001_init.sql.
// Once the project is live, regenerate the authoritative version with:
//   supabase gen types typescript --project-id <your-project-ref> > types/database.ts
// and this file becomes redundant — keep it only as a fallback/reference.

export type UserRole = "staff" | "office" | "super_admin";
export type ExchangeChannel = "In-store" | "Online";
export type ExchangeType = "Exchange" | "Return";

export interface ExchangeItem {
  sku_code: string;
  size: string;
  colour: string;
}

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          company_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string | null;
          role: UserRole;
          full_name: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id?: string | null;
          role?: UserRole;
          full_name: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          tenant_id: string | null;
          category: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          category: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      skus: {
        Row: {
          id: string;
          product_id: string;
          colorway: string;
          color_hex: string | null;
          size: string;
          sku_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          colorway: string;
          color_hex?: string | null;
          size: string;
          sku_code: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["skus"]["Insert"]>;
      };
      stock_take_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          started_by: string | null;
          started_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          started_by?: string | null;
          started_at?: string;
          closed_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["stock_take_sessions"]["Insert"]
        >;
      };
      stock_counts: {
        Row: {
          id: string;
          session_id: string;
          tenant_id: string;
          sku_id: string;
          counter_id: string | null;
          front_count: number | null;
          boh_count: number | null;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          tenant_id: string;
          sku_id: string;
          counter_id?: string | null;
          front_count?: number | null;
          boh_count?: number | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_counts"]["Insert"]>;
      };
      exchange_logs: {
        Row: {
          id: string;
          tenant_id: string;
          operator_id: string | null;
          order_number: string | null;
          customer_name: string | null;
          channel: ExchangeChannel;
          transaction_type: ExchangeType;
          items_in: ExchangeItem[];
          items_out: ExchangeItem[];
          inspector_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          operator_id?: string | null;
          order_number?: string | null;
          customer_name?: string | null;
          channel: ExchangeChannel;
          transaction_type: ExchangeType;
          items_in?: ExchangeItem[];
          items_out?: ExchangeItem[];
          inspector_name?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["exchange_logs"]["Insert"]
        >;
      };
    };
    Views: {
      stock_take_export_v: {
        Row: {
          session_id: string;
          company_name: string;
          category: string;
          style_name: string;
          colorway: string;
          size: string;
          sku_code: string;
          front_count: number | null;
          boh_count: number | null;
          total_in_store: number;
          notes: string | null;
          updated_at: string;
          counted_by: string | null;
        };
      };
    };
  };
}
