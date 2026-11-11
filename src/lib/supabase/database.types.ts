export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_calls: {
        Row: {
          cost_usd: number;
          created_at: string;
          duration_ms: number;
          error: string | null;
          fingerprint: string | null;
          id: string;
          input_tokens: number;
          kind: string;
          model: string;
          ok: boolean;
          output: Json | null;
          output_tokens: number;
          subject_id: string | null;
          subject_type: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cost_usd?: number;
          created_at?: string;
          duration_ms?: number;
          error?: string | null;
          fingerprint?: string | null;
          id?: string;
          input_tokens?: number;
          kind: string;
          model: string;
          ok: boolean;
          output?: Json | null;
          output_tokens?: number;
          subject_id?: string | null;
          subject_type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          cost_usd?: number;
          created_at?: string;
          duration_ms?: number;
          error?: string | null;
          fingerprint?: string | null;
          id?: string;
          input_tokens?: number;
          kind?: string;
          model?: string;
          ok?: boolean;
          output?: Json | null;
          output_tokens?: number;
          subject_id?: string | null;
          subject_type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_feedback: {
        Row: {
          ai_value: NonNullable<Json>;
          created_at: string;
          id: string;
          input_summary: string;
          kind: string;
          module_slug: string;
          updated_at: string;
          user_id: string;
          user_value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          ai_value: NonNullable<Json>;
          created_at?: string;
          id?: string;
          input_summary: string;
          kind: string;
          module_slug: string;
          updated_at?: string;
          user_id?: string;
          user_value: NonNullable<Json>;
        };
        Update: {
          ai_value?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          input_summary?: string;
          kind?: string;
          module_slug?: string;
          updated_at?: string;
          user_id?: string;
          user_value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      areas: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          sort: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          sort?: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      block_series: {
        Row: {
          created_at: string;
          day_type: Database["public"]["Enums"]["day_type"] | null;
          end_time: string;
          id: string;
          kind: Database["public"]["Enums"]["block_kind"];
          location: string | null;
          module_id: string | null;
          source_id: string | null;
          source_type: string | null;
          start_time: string;
          title: string;
          travel_after_min: number;
          travel_before_min: number;
          updated_at: string;
          user_id: string;
          valid_from: string;
          valid_to: string | null;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          day_type?: Database["public"]["Enums"]["day_type"] | null;
          end_time: string;
          id?: string;
          kind?: Database["public"]["Enums"]["block_kind"];
          location?: string | null;
          module_id?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          start_time: string;
          title: string;
          travel_after_min?: number;
          travel_before_min?: number;
          updated_at?: string;
          user_id?: string;
          valid_from?: string;
          valid_to?: string | null;
          weekday: number;
        };
        Update: {
          created_at?: string;
          day_type?: Database["public"]["Enums"]["day_type"] | null;
          end_time?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["block_kind"];
          location?: string | null;
          module_id?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          start_time?: string;
          title?: string;
          travel_after_min?: number;
          travel_before_min?: number;
          updated_at?: string;
          user_id?: string;
          valid_from?: string;
          valid_to?: string | null;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "block_series_module_id_user_id_fkey";
            columns: ["module_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      blocks: {
        Row: {
          created_at: string;
          day_type: Database["public"]["Enums"]["day_type"] | null;
          ends_at: string;
          id: string;
          key: string | null;
          kind: Database["public"]["Enums"]["block_kind"];
          location: string | null;
          module_id: string | null;
          occurrence_on: string | null;
          provenance: NonNullable<Json>;
          series_id: string | null;
          source_id: string | null;
          source_type: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["block_status"];
          title: string;
          travel_after_min: number;
          travel_before_min: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          day_type?: Database["public"]["Enums"]["day_type"] | null;
          ends_at: string;
          id?: string;
          key?: string | null;
          kind?: Database["public"]["Enums"]["block_kind"];
          location?: string | null;
          module_id?: string | null;
          occurrence_on?: string | null;
          provenance?: NonNullable<Json>;
          series_id?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["block_status"];
          title: string;
          travel_after_min?: number;
          travel_before_min?: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          day_type?: Database["public"]["Enums"]["day_type"] | null;
          ends_at?: string;
          id?: string;
          key?: string | null;
          kind?: Database["public"]["Enums"]["block_kind"];
          location?: string | null;
          module_id?: string | null;
          occurrence_on?: string | null;
          provenance?: NonNullable<Json>;
          series_id?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["block_status"];
          title?: string;
          travel_after_min?: number;
          travel_before_min?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_module_id_user_id_fkey";
            columns: ["module_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "blocks_series_id_user_id_fkey";
            columns: ["series_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "block_series";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      days: {
        Row: {
          closed_at: string | null;
          closing_note: string | null;
          created_at: string;
          date: string;
          day_type: Database["public"]["Enums"]["day_type"] | null;
          finish_line: string | null;
          id: string;
          life_mode: Database["public"]["Enums"]["life_mode"];
          plan: Json | null;
          plan_reasons: Json | null;
          plan_source: Database["public"]["Enums"]["plan_source"] | null;
          started_at: string | null;
          top3: string[];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          closed_at?: string | null;
          closing_note?: string | null;
          created_at?: string;
          date: string;
          day_type?: Database["public"]["Enums"]["day_type"] | null;
          finish_line?: string | null;
          id?: string;
          life_mode?: Database["public"]["Enums"]["life_mode"];
          plan?: Json | null;
          plan_reasons?: Json | null;
          plan_source?: Database["public"]["Enums"]["plan_source"] | null;
          started_at?: string | null;
          top3?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          closed_at?: string | null;
          closing_note?: string | null;
          created_at?: string;
          date?: string;
          day_type?: Database["public"]["Enums"]["day_type"] | null;
          finish_line?: string | null;
          id?: string;
          life_mode?: Database["public"]["Enums"]["life_mode"];
          plan?: Json | null;
          plan_reasons?: Json | null;
          plan_source?: Database["public"]["Enums"]["plan_source"] | null;
          started_at?: string | null;
          top3?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      deneme_items: {
        Row: {
          created_at: string;
          done: boolean;
          due_on: string | null;
          feedback: string | null;
          id: string;
          kind: string;
          minutes: number | null;
          spent_minutes: number | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          done?: boolean;
          due_on?: string | null;
          feedback?: string | null;
          id?: string;
          kind?: string;
          minutes?: number | null;
          spent_minutes?: number | null;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          done?: boolean;
          due_on?: string | null;
          feedback?: string | null;
          id?: string;
          kind?: string;
          minutes?: number | null;
          spent_minutes?: number | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          created_at: string;
          id: string;
          module_slug: string | null;
          occurred_at: string;
          payload: NonNullable<Json>;
          type: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          module_slug?: string | null;
          occurred_at?: string;
          payload?: NonNullable<Json>;
          type: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          module_slug?: string | null;
          occurred_at?: string;
          payload?: NonNullable<Json>;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      horizon_reviews: {
        Row: {
          created_at: string;
          id: string;
          load: NonNullable<Json>;
          period_start: string;
          proposals: NonNullable<Json>;
          scope: Database["public"]["Enums"]["horizon_scope"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          load?: NonNullable<Json>;
          period_start: string;
          proposals?: NonNullable<Json>;
          scope: Database["public"]["Enums"]["horizon_scope"];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          load?: NonNullable<Json>;
          period_start?: string;
          proposals?: NonNullable<Json>;
          scope?: Database["public"]["Enums"]["horizon_scope"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      inbox_entries: {
        Row: {
          created_at: string;
          id: string;
          raw_text: string;
          routed: Json | null;
          routed_at: string | null;
          status: Database["public"]["Enums"]["inbox_status"];
          suggestion: Json | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          raw_text: string;
          routed?: Json | null;
          routed_at?: string | null;
          status?: Database["public"]["Enums"]["inbox_status"];
          suggestion?: Json | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          raw_text?: string;
          routed?: Json | null;
          routed_at?: string | null;
          status?: Database["public"]["Enums"]["inbox_status"];
          suggestion?: Json | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      life_mode_periods: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          mode: Database["public"]["Enums"]["life_mode"];
          note: string | null;
          starts_on: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          mode: Database["public"]["Enums"]["life_mode"];
          note?: string | null;
          starts_on: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          mode?: Database["public"]["Enums"]["life_mode"];
          note?: string | null;
          starts_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      modules: {
        Row: {
          area_id: string | null;
          color: string;
          created_at: string;
          end_condition: string | null;
          ends_on: string | null;
          id: string;
          kind: Database["public"]["Enums"]["module_kind"];
          mode_behavior: NonNullable<Json>;
          name: string;
          settings: NonNullable<Json>;
          slug: string;
          sort: number;
          starts_on: string | null;
          status: Database["public"]["Enums"]["module_status"];
          updated_at: string;
          user_id: string;
          weekly_floor_minutes: number;
          weight: number;
        };
        ComputedFields: never;
        Insert: {
          area_id?: string | null;
          color?: string;
          created_at?: string;
          end_condition?: string | null;
          ends_on?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["module_kind"];
          mode_behavior?: NonNullable<Json>;
          name: string;
          settings?: NonNullable<Json>;
          slug: string;
          sort?: number;
          starts_on?: string | null;
          status?: Database["public"]["Enums"]["module_status"];
          updated_at?: string;
          user_id?: string;
          weekly_floor_minutes?: number;
          weight?: number;
        };
        Update: {
          area_id?: string | null;
          color?: string;
          created_at?: string;
          end_condition?: string | null;
          ends_on?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["module_kind"];
          mode_behavior?: NonNullable<Json>;
          name?: string;
          settings?: NonNullable<Json>;
          slug?: string;
          sort?: number;
          starts_on?: string | null;
          status?: Database["public"]["Enums"]["module_status"];
          updated_at?: string;
          user_id?: string;
          weekly_floor_minutes?: number;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "modules_area_id_user_id_fkey";
            columns: ["area_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      planner_stats: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          sample_size: number;
          updated_at: string;
          user_id: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          sample_size?: number;
          updated_at?: string;
          user_id?: string;
          value: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          sample_size?: number;
          updated_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [];
      };
      prompts: {
        Row: {
          answer: Json | null;
          answered_at: string | null;
          ask_after: string;
          created_at: string;
          id: string;
          kind: string;
          module_id: string;
          options: NonNullable<Json>;
          question: string;
          status: Database["public"]["Enums"]["prompt_status"];
          subject_id: string | null;
          subject_type: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer?: Json | null;
          answered_at?: string | null;
          ask_after?: string;
          created_at?: string;
          id?: string;
          kind: string;
          module_id: string;
          options?: NonNullable<Json>;
          question: string;
          status?: Database["public"]["Enums"]["prompt_status"];
          subject_id?: string | null;
          subject_type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          answer?: Json | null;
          answered_at?: string | null;
          ask_after?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          module_id?: string;
          options?: NonNullable<Json>;
          question?: string;
          status?: Database["public"]["Enums"]["prompt_status"];
          subject_id?: string | null;
          subject_type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prompts_module_id_user_id_fkey";
            columns: ["module_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      rhythm_logs: {
        Row: {
          created_at: string;
          done_on: string;
          id: string;
          rhythm_id: string;
          session_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          done_on?: string;
          id?: string;
          rhythm_id: string;
          session_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          done_on?: string;
          id?: string;
          rhythm_id?: string;
          session_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rhythm_logs_rhythm_id_user_id_fkey";
            columns: ["rhythm_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "rhythms";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "rhythm_logs_session_id_user_id_fkey";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      rhythms: {
        Row: {
          active: boolean;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          energy: Database["public"]["Enums"]["energy_kind"];
          est_minutes: number;
          floor_count: number;
          id: string;
          key: string | null;
          meta: NonNullable<Json>;
          mode_targets: Json | null;
          module_id: string;
          period: Database["public"]["Enums"]["period_kind"];
          provenance: NonNullable<Json>;
          source_id: string | null;
          source_type: string | null;
          target_count: number;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          energy?: Database["public"]["Enums"]["energy_kind"];
          est_minutes?: number;
          floor_count?: number;
          id?: string;
          key?: string | null;
          meta?: NonNullable<Json>;
          mode_targets?: Json | null;
          module_id: string;
          period: Database["public"]["Enums"]["period_kind"];
          provenance?: NonNullable<Json>;
          source_id?: string | null;
          source_type?: string | null;
          target_count: number;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          active?: boolean;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          energy?: Database["public"]["Enums"]["energy_kind"];
          est_minutes?: number;
          floor_count?: number;
          id?: string;
          key?: string | null;
          meta?: NonNullable<Json>;
          mode_targets?: Json | null;
          module_id?: string;
          period?: Database["public"]["Enums"]["period_kind"];
          provenance?: NonNullable<Json>;
          source_id?: string | null;
          source_type?: string | null;
          target_count?: number;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rhythms_module_id_user_id_fkey";
            columns: ["module_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      sessions: {
        Row: {
          confirmed_at: string | null;
          created_at: string;
          ended_at: string | null;
          id: string;
          measured: boolean;
          module_id: string | null;
          rhythm_id: string | null;
          started_at: string;
          task_id: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          confirmed_at?: string | null;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          measured?: boolean;
          module_id?: string | null;
          rhythm_id?: string | null;
          started_at?: string;
          task_id?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          confirmed_at?: string | null;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          measured?: boolean;
          module_id?: string | null;
          rhythm_id?: string | null;
          started_at?: string;
          task_id?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_module_id_user_id_fkey";
            columns: ["module_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "sessions_rhythm_id_user_id_fkey";
            columns: ["rhythm_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "rhythms";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "sessions_task_id_user_id_fkey";
            columns: ["task_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      settings: {
        Row: {
          ai_enabled: boolean;
          ai_monthly_budget_usd: number;
          capacity_factors: NonNullable<Json>;
          created_at: string;
          day_start_default: string;
          default_day_type: Database["public"]["Enums"]["day_type"];
          finish_line_default: string;
          id: string;
          return_after_days: number;
          slot: NonNullable<Json>;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          ai_enabled?: boolean;
          ai_monthly_budget_usd?: number;
          capacity_factors?: NonNullable<Json>;
          created_at?: string;
          day_start_default?: string;
          default_day_type?: Database["public"]["Enums"]["day_type"];
          finish_line_default?: string;
          id?: string;
          return_after_days?: number;
          slot?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          ai_enabled?: boolean;
          ai_monthly_budget_usd?: number;
          capacity_factors?: NonNullable<Json>;
          created_at?: string;
          day_start_default?: string;
          default_day_type?: Database["public"]["Enums"]["day_type"];
          finish_line_default?: string;
          id?: string;
          return_after_days?: number;
          slot?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          ai: Json | null;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          defer_count: number;
          done_at: string | null;
          due_at: string | null;
          energy: Database["public"]["Enums"]["energy_kind"];
          est_minutes: number;
          follow_up_on: string | null;
          id: string;
          importance: number;
          kind: Database["public"]["Enums"]["task_kind"];
          meta: NonNullable<Json>;
          module_id: string;
          planned_date: string | null;
          position: number | null;
          source_id: string | null;
          source_type: string | null;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
          user_id: string;
          waiting_on: string | null;
          work_item_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          ai?: Json | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          defer_count?: number;
          done_at?: string | null;
          due_at?: string | null;
          energy?: Database["public"]["Enums"]["energy_kind"];
          est_minutes?: number;
          follow_up_on?: string | null;
          id?: string;
          importance?: number;
          kind?: Database["public"]["Enums"]["task_kind"];
          meta?: NonNullable<Json>;
          module_id: string;
          planned_date?: string | null;
          position?: number | null;
          source_id?: string | null;
          source_type?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
          user_id?: string;
          waiting_on?: string | null;
          work_item_id?: string | null;
        };
        Update: {
          ai?: Json | null;
          context?: Database["public"]["Enums"]["context_kind"];
          created_at?: string;
          defer_count?: number;
          done_at?: string | null;
          due_at?: string | null;
          energy?: Database["public"]["Enums"]["energy_kind"];
          est_minutes?: number;
          follow_up_on?: string | null;
          id?: string;
          importance?: number;
          kind?: Database["public"]["Enums"]["task_kind"];
          meta?: NonNullable<Json>;
          module_id?: string;
          planned_date?: string | null;
          position?: number | null;
          source_id?: string | null;
          source_type?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
          waiting_on?: string | null;
          work_item_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_module_id_user_id_fkey";
            columns: ["module_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "tasks_work_item_id_user_id_fkey";
            columns: ["work_item_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "work_items";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      week_plans: {
        Row: {
          capacity_minutes: number | null;
          committed: string[];
          created_at: string;
          day_capacity: NonNullable<Json>;
          id: string;
          life_mode: Database["public"]["Enums"]["life_mode"] | null;
          module_budgets: NonNullable<Json>;
          plan_source: Database["public"]["Enums"]["plan_source"] | null;
          reasons: Json | null;
          shares: NonNullable<Json>;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          capacity_minutes?: number | null;
          committed?: string[];
          created_at?: string;
          day_capacity?: NonNullable<Json>;
          id?: string;
          life_mode?: Database["public"]["Enums"]["life_mode"] | null;
          module_budgets?: NonNullable<Json>;
          plan_source?: Database["public"]["Enums"]["plan_source"] | null;
          reasons?: Json | null;
          shares?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
          week_start: string;
        };
        Update: {
          capacity_minutes?: number | null;
          committed?: string[];
          created_at?: string;
          day_capacity?: NonNullable<Json>;
          id?: string;
          life_mode?: Database["public"]["Enums"]["life_mode"] | null;
          module_budgets?: NonNullable<Json>;
          plan_source?: Database["public"]["Enums"]["plan_source"] | null;
          reasons?: Json | null;
          shares?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      weekly_reviews: {
        Row: {
          created_at: string;
          id: string;
          summary: NonNullable<Json>;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          summary?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
          week_start: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          summary?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      work_items: {
        Row: {
          ai: Json | null;
          artifact_url: string | null;
          context: Database["public"]["Enums"]["context_kind"] | null;
          created_at: string;
          depends_on: string[];
          depends_on_keys: string[];
          droppable: boolean;
          due_at: string | null;
          due_is_hard: boolean;
          earliest_at: string | null;
          effort_done_minutes: number;
          effort_max_minutes: number | null;
          effort_min_minutes: number | null;
          effort_total_minutes: number | null;
          energy: Database["public"]["Enums"]["energy_kind"] | null;
          id: string;
          importance: number;
          key: string | null;
          meta: NonNullable<Json>;
          module_id: string;
          parent_id: string | null;
          provenance: NonNullable<Json>;
          session_minutes: number | null;
          source_id: string | null;
          source_type: string | null;
          splittable: boolean;
          status: Database["public"]["Enums"]["work_item_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          ai?: Json | null;
          artifact_url?: string | null;
          context?: Database["public"]["Enums"]["context_kind"] | null;
          created_at?: string;
          depends_on?: string[];
          depends_on_keys?: string[];
          droppable?: boolean;
          due_at?: string | null;
          due_is_hard?: boolean;
          earliest_at?: string | null;
          effort_done_minutes?: number;
          effort_max_minutes?: number | null;
          effort_min_minutes?: number | null;
          effort_total_minutes?: number | null;
          energy?: Database["public"]["Enums"]["energy_kind"] | null;
          id?: string;
          importance?: number;
          key?: string | null;
          meta?: NonNullable<Json>;
          module_id: string;
          parent_id?: string | null;
          provenance?: NonNullable<Json>;
          session_minutes?: number | null;
          source_id?: string | null;
          source_type?: string | null;
          splittable?: boolean;
          status?: Database["public"]["Enums"]["work_item_status"];
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          ai?: Json | null;
          artifact_url?: string | null;
          context?: Database["public"]["Enums"]["context_kind"] | null;
          created_at?: string;
          depends_on?: string[];
          depends_on_keys?: string[];
          droppable?: boolean;
          due_at?: string | null;
          due_is_hard?: boolean;
          earliest_at?: string | null;
          effort_done_minutes?: number;
          effort_max_minutes?: number | null;
          effort_min_minutes?: number | null;
          effort_total_minutes?: number | null;
          energy?: Database["public"]["Enums"]["energy_kind"] | null;
          id?: string;
          importance?: number;
          key?: string | null;
          meta?: NonNullable<Json>;
          module_id?: string;
          parent_id?: string | null;
          provenance?: NonNullable<Json>;
          session_minutes?: number | null;
          source_id?: string | null;
          source_type?: string | null;
          splittable?: boolean;
          status?: Database["public"]["Enums"]["work_item_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_items_module_id_user_id_fkey";
            columns: ["module_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "work_items_parent_id_user_id_fkey";
            columns: ["parent_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "work_items";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ai_spend_since: { Args: { p_since: string }; Returns: number };
      ai_usage_since: {
        Args: { p_since: string };
        Returns: {
          calls: number;
          cost_usd: number;
          failed: number;
          input_tokens: number;
          kind: string;
          model: string;
          output_tokens: number;
        }[];
      };
      archive_module: {
        Args: { p_module_id: string };
        Returns: {
          area_id: string | null;
          color: string;
          created_at: string;
          end_condition: string | null;
          ends_on: string | null;
          id: string;
          kind: Database["public"]["Enums"]["module_kind"];
          mode_behavior: NonNullable<Json>;
          name: string;
          settings: NonNullable<Json>;
          slug: string;
          sort: number;
          starts_on: string | null;
          status: Database["public"]["Enums"]["module_status"];
          updated_at: string;
          user_id: string;
          weekly_floor_minutes: number;
          weight: number;
        };
        SetofOptions: {
          from: "*";
          to: "modules";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      close_unanswered_session: {
        Args: { p_session_id: string };
        Returns: {
          confirmed_at: string | null;
          created_at: string;
          ended_at: string | null;
          id: string;
          measured: boolean;
          module_id: string | null;
          rhythm_id: string | null;
          started_at: string;
          task_id: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      complete_task: {
        Args: { p_task_id: string };
        Returns: {
          ai: Json | null;
          context: Database["public"]["Enums"]["context_kind"];
          created_at: string;
          defer_count: number;
          done_at: string | null;
          due_at: string | null;
          energy: Database["public"]["Enums"]["energy_kind"];
          est_minutes: number;
          follow_up_on: string | null;
          id: string;
          importance: number;
          kind: Database["public"]["Enums"]["task_kind"];
          meta: NonNullable<Json>;
          module_id: string;
          planned_date: string | null;
          position: number | null;
          source_id: string | null;
          source_type: string | null;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
          user_id: string;
          waiting_on: string | null;
          work_item_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "tasks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      end_session: {
        Args: { p_outcome?: string; p_session_id: string };
        Returns: {
          confirmed_at: string | null;
          created_at: string;
          ended_at: string | null;
          id: string;
          measured: boolean;
          module_id: string | null;
          rhythm_id: string | null;
          started_at: string;
          task_id: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      istanbul_today: { Args: Record<PropertyKey, never>; Returns: string };
      start_session: {
        Args: {
          p_module_id?: string;
          p_rhythm_id?: string;
          p_task_id?: string;
          p_title?: string;
          p_work_item_id?: string;
        };
        Returns: {
          confirmed_at: string | null;
          created_at: string;
          ended_at: string | null;
          id: string;
          measured: boolean;
          module_id: string | null;
          rhythm_id: string | null;
          started_at: string;
          task_id: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      block_kind: "work" | "class" | "appointment" | "protected";
      block_status: "planned" | "cancelled" | "done";
      context_kind: "any" | "desk" | "home" | "campus" | "office" | "out" | "commute";
      day_type: "home" | "office" | "campus";
      energy_kind: "deep" | "light" | "physical";
      horizon_scope: "month" | "term";
      inbox_status: "new" | "needs_confirm" | "routed" | "dismissed";
      life_mode: "normal" | "busy" | "minimum" | "holiday";
      module_kind: "lifelong" | "term" | "until_goal";
      module_status: "active" | "paused" | "archived";
      period_kind: "day" | "week" | "month";
      plan_source: "closing" | "ai" | "auto";
      prompt_status: "pending" | "answered" | "expired";
      task_kind: "task" | "prep" | "deadline" | "admin";
      task_status: "todo" | "doing" | "waiting" | "done" | "dropped";
      work_item_status: "proposed" | "active" | "waiting" | "done" | "dropped";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      block_kind: ["work", "class", "appointment", "protected"],
      block_status: ["planned", "cancelled", "done"],
      context_kind: ["any", "desk", "home", "campus", "office", "out", "commute"],
      day_type: ["home", "office", "campus"],
      energy_kind: ["deep", "light", "physical"],
      horizon_scope: ["month", "term"],
      inbox_status: ["new", "needs_confirm", "routed", "dismissed"],
      life_mode: ["normal", "busy", "minimum", "holiday"],
      module_kind: ["lifelong", "term", "until_goal"],
      module_status: ["active", "paused", "archived"],
      period_kind: ["day", "week", "month"],
      plan_source: ["closing", "ai", "auto"],
      prompt_status: ["pending", "answered", "expired"],
      task_kind: ["task", "prep", "deadline", "admin"],
      task_status: ["todo", "doing", "waiting", "done", "dropped"],
      work_item_status: ["proposed", "active", "waiting", "done", "dropped"],
    },
  },
} as const;
