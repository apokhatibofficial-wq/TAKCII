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
      admin_pending_changes: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          op: string
          patch: Json
          row_id: string | null
          table_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: never
          op: string
          patch: Json
          row_id?: string | null
          table_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: never
          op?: string
          patch?: Json
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          admin_username: string
          id: boolean
        }
        Insert: {
          admin_username?: string
          id?: boolean
        }
        Update: {
          admin_username?: string
          id?: boolean
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          active: boolean
          audience: Database["public"]["Enums"]["ad_audience"]
          body: string | null
          button_label: string | null
          button_url: string | null
          created_at: string
          height: number
          id: string
          image_fit: string
          image_urls: string[]
          impressions_count: number
          link_clicks_count: number
          title: string
        }
        Insert: {
          active?: boolean
          audience?: Database["public"]["Enums"]["ad_audience"]
          body?: string | null
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          height?: number
          id?: string
          image_fit?: string
          image_urls?: string[]
          impressions_count?: number
          link_clicks_count?: number
          title: string
        }
        Update: {
          active?: boolean
          audience?: Database["public"]["Enums"]["ad_audience"]
          body?: string | null
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          height?: number
          id?: string
          image_fit?: string
          image_urls?: string[]
          impressions_count?: number
          link_clicks_count?: number
          title?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          accepted_count: number
          car: string
          car_photo_url: string | null
          email: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          online: boolean
          phone: string
          plate: string
          rejected_count: number
          selfie_url: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
          username: string
        }
        Insert: {
          accepted_count?: number
          car: string
          car_photo_url?: string | null
          email: string
          id: string
          lat?: number | null
          lng?: number | null
          name: string
          online?: boolean
          phone: string
          plate: string
          rejected_count?: number
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          username: string
        }
        Update: {
          accepted_count?: number
          car?: string
          car_photo_url?: string | null
          email?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          online?: boolean
          phone?: string
          plate?: string
          rejected_count?: number
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          created_at: string
          id: string
          target_id: string | null
          target_kind: string | null
          title: string
        }
        Insert: {
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          created_at?: string
          id?: string
          target_id?: string | null
          target_kind?: string | null
          title: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["message_audience"]
          body?: string
          created_at?: string
          id?: string
          target_id?: string | null
          target_kind?: string | null
          title?: string
        }
        Relationships: []
      }
      places: {
        Row: {
          area: string
          created_at: string
          id: string
          kind: string | null
          lat: number
          lng: number
          name: string
          source: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          kind?: string | null
          lat: number
          lng: number
          name: string
          source?: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          kind?: string | null
          lat?: number
          lng?: number
          name?: string
          source?: string
        }
        Relationships: []
      }
      pricing: {
        Row: {
          base: number
          currency: Database["public"]["Enums"]["currency_code"]
          min_fare: number
          per_km: number
          per_min: number
          per_wait_hour: number
          round_to: number
        }
        Insert: {
          base: number
          currency: Database["public"]["Enums"]["currency_code"]
          min_fare: number
          per_km: number
          per_min: number
          per_wait_hour: number
          round_to: number
        }
        Update: {
          base?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          min_fare?: number
          per_km?: number
          per_min?: number
          per_wait_hour?: number
          round_to?: number
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          active_currency: Database["public"]["Enums"]["currency_code"]
          id: boolean
          show_to_riders: boolean
        }
        Insert: {
          active_currency?: Database["public"]["Enums"]["currency_code"]
          id?: boolean
          show_to_riders?: boolean
        }
        Update: {
          active_currency?: Database["public"]["Enums"]["currency_code"]
          id?: boolean
          show_to_riders?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          expo_token: string | null
          id: string
          platform: string
          user_id: string
          web_auth: string | null
          web_endpoint: string | null
          web_p256dh: string | null
        }
        Insert: {
          created_at?: string
          expo_token?: string | null
          id?: string
          platform: string
          user_id: string
          web_auth?: string | null
          web_endpoint?: string | null
          web_p256dh?: string | null
        }
        Update: {
          created_at?: string
          expo_token?: string | null
          id?: string
          platform?: string
          user_id?: string
          web_auth?: string | null
          web_endpoint?: string | null
          web_p256dh?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          driver_id: string
          driver_stars: number | null
          edited_by_admin: boolean
          id: string
          ride_id: string
          rider_id: string
          rider_stars: number | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          driver_stars?: number | null
          edited_by_admin?: boolean
          id?: string
          ride_id: string
          rider_id: string
          rider_stars?: number | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          driver_stars?: number | null
          edited_by_admin?: boolean
          id?: string
          ride_id?: string
          rider_id?: string
          rider_stars?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: true
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          photo_url: string | null
          status: Database["public"]["Enums"]["user_status"]
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          phone: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          username?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          arrived_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          declined_driver_ids: string[]
          dest_lat: number
          dest_lng: number
          dest_name: string
          dispatched_at: string | null
          driver_id: string | null
          eta_minutes: number | null
          fare_amount: number | null
          fare_currency: Database["public"]["Enums"]["currency_code"] | null
          id: string
          km: number | null
          matched_at: string | null
          minutes: number | null
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          requested_at: string
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          wait_fare: number
          wait_runs: number
          wait_seconds: number
        }
        Insert: {
          arrived_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          declined_driver_ids?: string[]
          dest_lat: number
          dest_lng: number
          dest_name: string
          dispatched_at?: string | null
          driver_id?: string | null
          eta_minutes?: number | null
          fare_amount?: number | null
          fare_currency?: Database["public"]["Enums"]["currency_code"] | null
          id?: string
          km?: number | null
          matched_at?: string | null
          minutes?: number | null
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          requested_at?: string
          rider_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          wait_fare?: number
          wait_runs?: number
          wait_seconds?: number
        }
        Update: {
          arrived_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          declined_driver_ids?: string[]
          dest_lat?: number
          dest_lng?: number
          dest_name?: string
          dispatched_at?: string | null
          driver_id?: string | null
          eta_minutes?: number | null
          fare_amount?: number | null
          fare_currency?: Database["public"]["Enums"]["currency_code"] | null
          id?: string
          km?: number | null
          matched_at?: string | null
          minutes?: number | null
          pickup_lat?: number
          pickup_lng?: number
          pickup_name?: string
          requested_at?: string
          rider_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          wait_fare?: number
          wait_runs?: number
          wait_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_ride: {
        Args: { p_ride_id: string }
        Returns: {
          arrived_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          declined_driver_ids: string[]
          dest_lat: number
          dest_lng: number
          dest_name: string
          dispatched_at: string | null
          driver_id: string | null
          eta_minutes: number | null
          fare_amount: number | null
          fare_currency: Database["public"]["Enums"]["currency_code"] | null
          id: string
          km: number | null
          matched_at: string | null
          minutes: number | null
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          requested_at: string
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          wait_fare: number
          wait_runs: number
          wait_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_trip: {
        Args: {
          p_ride_id: string
          p_wait_runs?: number
          p_wait_seconds?: number
        }
        Returns: {
          arrived_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          declined_driver_ids: string[]
          dest_lat: number
          dest_lng: number
          dest_name: string
          dispatched_at: string | null
          driver_id: string | null
          eta_minutes: number | null
          fare_amount: number | null
          fare_currency: Database["public"]["Enums"]["currency_code"] | null
          id: string
          km: number | null
          matched_at: string | null
          minutes: number | null
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          requested_at: string
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          wait_fare: number
          wait_runs: number
          wait_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_ride: {
        Args: { p_ride_id: string }
        Returns: {
          arrived_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          declined_driver_ids: string[]
          dest_lat: number
          dest_lng: number
          dest_name: string
          dispatched_at: string | null
          driver_id: string | null
          eta_minutes: number | null
          fare_amount: number | null
          fare_currency: Database["public"]["Enums"]["currency_code"] | null
          id: string
          km: number | null
          matched_at: string | null
          minutes: number | null
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          requested_at: string
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          wait_fare: number
          wait_runs: number
          wait_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_username_taken: { Args: { candidate: string }; Returns: boolean }
      nearest_available_driver: {
        Args: { p_exclude?: string[]; p_lat: number; p_lng: number }
        Returns: string
      }
      rate_ride: {
        Args: { p_ride_id: string; p_stars: number }
        Returns: {
          created_at: string
          driver_id: string
          driver_stars: number | null
          edited_by_admin: boolean
          id: string
          ride_id: string
          rider_id: string
          rider_stars: number | null
        }
        SetofOptions: {
          from: "*"
          to: "ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_ride: {
        Args: { p_ride_id: string }
        Returns: {
          arrived_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          declined_driver_ids: string[]
          dest_lat: number
          dest_lng: number
          dest_name: string
          dispatched_at: string | null
          driver_id: string | null
          eta_minutes: number | null
          fare_amount: number | null
          fare_currency: Database["public"]["Enums"]["currency_code"] | null
          id: string
          km: number | null
          matched_at: string | null
          minutes: number | null
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          requested_at: string
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          wait_fare: number
          wait_runs: number
          wait_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_ride: {
        Args: {
          p_dest_lat: number
          p_dest_lng: number
          p_dest_name: string
          p_km: number
          p_minutes: number
          p_pickup_lat: number
          p_pickup_lng: number
          p_pickup_name: string
        }
        Returns: {
          arrived_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          declined_driver_ids: string[]
          dest_lat: number
          dest_lng: number
          dest_name: string
          dispatched_at: string | null
          driver_id: string | null
          eta_minutes: number | null
          fare_amount: number | null
          fare_currency: Database["public"]["Enums"]["currency_code"] | null
          id: string
          km: number | null
          matched_at: string | null
          minutes: number | null
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          requested_at: string
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          wait_fare: number
          wait_runs: number
          wait_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sweep_stale_rides: { Args: Record<PropertyKey, never>; Returns: undefined }
      track_ad_impression: { Args: { p_ad_id: string }; Returns: undefined }
      track_ad_link_click: { Args: { p_ad_id: string }; Returns: undefined }
    }
    Enums: {
      ad_audience: "all" | "users" | "drivers"
      currency_code: "SYP" | "TRY" | "USD"
      driver_status: "pending" | "active" | "suspended"
      message_audience: "all" | "users" | "drivers" | "one"
      ride_status:
        | "searching"
        | "dispatched"
        | "toPickup"
        | "arrived"
        | "onTrip"
        | "done"
        | "cancelled"
      user_status: "active" | "suspended"
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
      ad_audience: ["all", "users", "drivers"],
      currency_code: ["SYP", "TRY", "USD"],
      driver_status: ["pending", "active", "suspended"],
      message_audience: ["all", "users", "drivers", "one"],
      ride_status: [
        "searching",
        "dispatched",
        "toPickup",
        "arrived",
        "onTrip",
        "done",
        "cancelled",
      ],
      user_status: ["active", "suspended"],
    },
  },
} as const
