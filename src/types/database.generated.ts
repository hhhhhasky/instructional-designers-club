// Generated from the linked Supabase schema on 2026-07-24, then extended
// with the pending local migration 20260724090000_hai_trace_v2_daily_review_drafts.
// Regenerate after that migration is applied remotely to remove this overlay.
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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          end_time: string | null
          id: string
          is_active: boolean
          location: string | null
          meeting_url: string | null
          sort_order: number
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_type?: string
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          meeting_url?: string | null
          sort_order?: number
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          meeting_url?: string | null
          sort_order?: number
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          is_pinned: boolean
          link_label: string | null
          link_url: string | null
          published_at: string
          sort_order: number
          summary: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          link_label?: string | null
          link_url?: string | null
          published_at?: string
          sort_order?: number
          summary?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          link_label?: string | null
          link_url?: string | null
          published_at?: string
          sort_order?: number
          summary?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_attachments: {
        Row: {
          course_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          is_active: boolean
          mime_type: string | null
          sort_order: number
          storage_key: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          is_active?: boolean
          mime_type?: string | null
          sort_order?: number
          storage_key: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean
          mime_type?: string | null
          sort_order?: number
          storage_key?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_attachments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_categories: {
        Row: {
          applicable_audience: string[] | null
          applicable_scenarios: string[] | null
          content_types: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          plus_track_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          applicable_audience?: string[] | null
          applicable_scenarios?: string[] | null
          content_types?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          plus_track_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          applicable_audience?: string[] | null
          applicable_scenarios?: string[] | null
          content_types?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          plus_track_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_categories_plus_track_id_fkey"
            columns: ["plus_track_id"]
            isOneToOne: false
            referencedRelation: "plus_course_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      course_question_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_anonymous: boolean
          question_id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          question_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          question_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_question_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_question_replies_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "course_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_question_tag_links: {
        Row: {
          created_at: string
          question_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          question_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          question_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_question_tag_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "course_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_question_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "course_question_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      course_question_tags: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          tag_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          tag_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tag_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_questions: {
        Row: {
          author_id: string
          body: string
          course_id: string
          created_at: string
          id: string
          is_anonymous: boolean
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          course_id: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_questions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          audio_url: string | null
          body: string | null
          category: string | null
          category_id: string | null
          created_at: string | null
          credits: number | null
          description: string | null
          duration: number | null
          essence: string | null
          has_audio: boolean | null
          has_body: boolean | null
          has_essence: boolean | null
          has_images: boolean | null
          has_meeting: boolean | null
          has_video: boolean | null
          id: string
          image_url: string | null
          images: string[] | null
          instructor: string | null
          is_trial: boolean | null
          level: Database["public"]["Enums"]["course_level"] | null
          meeting_url: string | null
          membership_type: string | null
          password_access_enabled: boolean
          plus_lesson_order: number | null
          plus_representative: boolean | null
          sort_order: number | null
          status: Database["public"]["Enums"]["course_status"] | null
          title: string
          updated_at: string | null
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          audio_url?: string | null
          body?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          credits?: number | null
          description?: string | null
          duration?: number | null
          essence?: string | null
          has_audio?: boolean | null
          has_body?: boolean | null
          has_essence?: boolean | null
          has_images?: boolean | null
          has_meeting?: boolean | null
          has_video?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          instructor?: string | null
          is_trial?: boolean | null
          level?: Database["public"]["Enums"]["course_level"] | null
          meeting_url?: string | null
          membership_type?: string | null
          password_access_enabled?: boolean
          plus_lesson_order?: number | null
          plus_representative?: boolean | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["course_status"] | null
          title: string
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          audio_url?: string | null
          body?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          credits?: number | null
          description?: string | null
          duration?: number | null
          essence?: string | null
          has_audio?: boolean | null
          has_body?: boolean | null
          has_essence?: boolean | null
          has_images?: boolean | null
          has_meeting?: boolean | null
          has_video?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          instructor?: string | null
          is_trial?: boolean | null
          level?: Database["public"]["Enums"]["course_level"] | null
          meeting_url?: string | null
          membership_type?: string | null
          password_access_enabled?: boolean
          plus_lesson_order?: number | null
          plus_representative?: boolean | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["course_status"] | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          admin_id: string
          amount: number
          created_at: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          admin_id: string
          amount: number
          created_at?: string | null
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          amount?: number
          created_at?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      hai_chat_skill_bindings: {
        Row: {
          created_at: string
          created_by: string | null
          is_enabled: boolean
          module_id: string
          skill_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_enabled?: boolean
          module_id: string
          skill_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_enabled?: boolean
          module_id?: string
          skill_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_chat_skill_bindings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_chat_skill_bindings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "hai_feature_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_chat_skill_bindings_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hai_chat_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_chat_skill_references: {
        Row: {
          content: string
          content_hash: string
          created_at: string
          description: string
          id: string
          load_mode: string
          max_chars: number
          media_type: string
          metadata: Json
          name: string
          path: string
          skill_version_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          content: string
          content_hash: string
          created_at?: string
          description?: string
          id?: string
          load_mode?: string
          max_chars?: number
          media_type?: string
          metadata?: Json
          name?: string
          path: string
          skill_version_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          content?: string
          content_hash?: string
          created_at?: string
          description?: string
          id?: string
          load_mode?: string
          max_chars?: number
          media_type?: string
          metadata?: Json
          name?: string
          path?: string
          skill_version_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_chat_skill_references_skill_version_id_fkey"
            columns: ["skill_version_id"]
            isOneToOne: false
            referencedRelation: "hai_chat_skill_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_chat_skill_versions: {
        Row: {
          created_at: string
          created_by: string | null
          default_instructions: string
          id: string
          instructions: string
          published_at: string | null
          reference_config: Json
          reference_count: number
          skill_id: string
          snapshot_hash: string | null
          snapshot_manifest: Json
          status: string
          updated_at: string
          version_label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_instructions?: string
          id?: string
          instructions: string
          published_at?: string | null
          reference_config?: Json
          reference_count?: number
          skill_id: string
          snapshot_hash?: string | null
          snapshot_manifest?: Json
          status?: string
          updated_at?: string
          version_label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_instructions?: string
          id?: string
          instructions?: string
          published_at?: string | null
          reference_config?: Json
          reference_count?: number
          skill_id?: string
          snapshot_hash?: string | null
          snapshot_manifest?: Json
          status?: string
          updated_at?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_chat_skill_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_chat_skill_versions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hai_chat_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_chat_skills: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_enabled: boolean
          name: string
          slug: string
          source_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_enabled?: boolean
          name: string
          slug: string
          source_path?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_enabled?: boolean
          name?: string
          slug?: string
          source_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_chat_skills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_conversations: {
        Row: {
          archived_at: string | null
          context_compressed_at: string | null
          context_compressed_until: string | null
          created_at: string
          id: string
          mode: string
          module_slug: string | null
          quality_test_run_id: string | null
          roundtable_phase: string
          roundtable_role_ids: string[]
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          context_compressed_at?: string | null
          context_compressed_until?: string | null
          created_at?: string
          id?: string
          mode?: string
          module_slug?: string | null
          quality_test_run_id?: string | null
          roundtable_phase?: string
          roundtable_role_ids?: string[]
          summary?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          context_compressed_at?: string | null
          context_compressed_until?: string | null
          created_at?: string
          id?: string
          mode?: string
          module_slug?: string | null
          quality_test_run_id?: string | null
          roundtable_phase?: string
          roundtable_role_ids?: string[]
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_conversations_module_slug_fkey"
            columns: ["module_slug"]
            isOneToOne: false
            referencedRelation: "hai_feature_modules"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "hai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_daily_review_scheduler_config: {
        Row: {
          auth_secret: string
          enabled: boolean
          endpoint_url: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          auth_secret: string
          enabled?: boolean
          endpoint_url: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          auth_secret?: string
          enabled?: boolean
          endpoint_url?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      hai_feature_modules: {
        Row: {
          category: string
          created_at: string
          default_max_output_tokens: number
          default_model: string
          default_temperature: number
          default_top_p: number | null
          description: string
          history_message_limit: number
          icon_key: string
          id: string
          input_schema: Json
          is_enabled: boolean
          knowledge_match_count: number
          material_match_count: number
          memory_limit: number
          model_provider_id: string | null
          name: string
          reasoning_effort: string | null
          response_format: string
          short_label: string
          slug: string
          sort_order: number
          stop_sequences: string[]
          surface_mode: string
          thinking_enabled: boolean
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_max_output_tokens?: number
          default_model?: string
          default_temperature?: number
          default_top_p?: number | null
          description?: string
          history_message_limit?: number
          icon_key?: string
          id?: string
          input_schema?: Json
          is_enabled?: boolean
          knowledge_match_count?: number
          material_match_count?: number
          memory_limit?: number
          model_provider_id?: string | null
          name: string
          reasoning_effort?: string | null
          response_format?: string
          short_label: string
          slug: string
          sort_order?: number
          stop_sequences?: string[]
          surface_mode?: string
          thinking_enabled?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_max_output_tokens?: number
          default_model?: string
          default_temperature?: number
          default_top_p?: number | null
          description?: string
          history_message_limit?: number
          icon_key?: string
          id?: string
          input_schema?: Json
          is_enabled?: boolean
          knowledge_match_count?: number
          material_match_count?: number
          memory_limit?: number
          model_provider_id?: string | null
          name?: string
          reasoning_effort?: string | null
          response_format?: string
          short_label?: string
          slug?: string
          sort_order?: number
          stop_sequences?: string[]
          surface_mode?: string
          thinking_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      hai_invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string
          max_uses: number
          quota_policy_key: string
          starts_at: string | null
          status: string
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string
          max_uses?: number
          quota_policy_key?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string
          max_uses?: number
          quota_policy_key?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "hai_invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          source_id: string
          token_count: number | null
          topic: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id: string
          token_count?: number | null
          topic?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id?: string
          token_count?: number | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hai_knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_knowledge_sources: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          metadata: Json
          source_type: string
          title: string
          topic: string
          updated_at: string
          visibility: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          source_type?: string
          title: string
          topic?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          source_type?: string
          title?: string
          topic?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_knowledge_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_material_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          material_id: string
          metadata: Json
          token_count: number | null
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          material_id: string
          metadata?: Json
          token_count?: number | null
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          material_id?: string
          metadata?: Json
          token_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_material_chunks_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "hai_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_material_chunks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_materials: {
        Row: {
          conversation_id: string | null
          created_at: string
          error_message: string | null
          file_name: string
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_materials_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "hai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_materials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_message_feedback: {
        Row: {
          created_at: string
          id: string
          message_id: string
          rating: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          rating: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          rating?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_message_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "hai_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_message_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_messages: {
        Row: {
          citations: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          input_tokens: number | null
          metadata: Json
          output_tokens: number | null
          role: string
          token_estimate: number | null
          user_id: string
        }
        Insert: {
          citations?: Json
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          metadata?: Json
          output_tokens?: number | null
          role: string
          token_estimate?: number | null
          user_id: string
        }
        Update: {
          citations?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          metadata?: Json
          output_tokens?: number | null
          role?: string
          token_estimate?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "hai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_method_card_configs: {
        Row: {
          aliases: string[]
          answer_focus: string
          avoid_when: string[]
          core_judgement: string
          course: string
          created_at: string
          enabled: boolean
          id: string
          intents: string[]
          is_deleted: boolean
          kind: string
          moves: string[]
          name: string
          ownership: string
          priority: number
          query_terms: string[]
          related: string[]
          source_refs: string[]
          summary: string
          updated_at: string
          updated_by: string | null
          use_when: string[]
        }
        Insert: {
          aliases?: string[]
          answer_focus?: string
          avoid_when?: string[]
          core_judgement?: string
          course: string
          created_at?: string
          enabled?: boolean
          id: string
          intents?: string[]
          is_deleted?: boolean
          kind: string
          moves?: string[]
          name: string
          ownership: string
          priority?: number
          query_terms?: string[]
          related?: string[]
          source_refs?: string[]
          summary?: string
          updated_at?: string
          updated_by?: string | null
          use_when?: string[]
        }
        Update: {
          aliases?: string[]
          answer_focus?: string
          avoid_when?: string[]
          core_judgement?: string
          course?: string
          created_at?: string
          enabled?: boolean
          id?: string
          intents?: string[]
          is_deleted?: boolean
          kind?: string
          moves?: string[]
          name?: string
          ownership?: string
          priority?: number
          query_terms?: string[]
          related?: string[]
          source_refs?: string[]
          summary?: string
          updated_at?: string
          updated_by?: string | null
          use_when?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "hai_method_card_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_model_providers: {
        Row: {
          id: string
          label: string
          model_name: string
          api_key: string
          base_url: string
          is_enabled: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          label: string
          model_name: string
          api_key: string
          base_url: string
          is_enabled?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          model_name?: string
          api_key?: string
          base_url?: string
          is_enabled?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hai_optimization_log: {
        Row: {
          average_score: number | null
          baseline_skill_version_id: string | null
          candidate_changes: Json
          candidate_comparison: Json
          candidate_skill_version_id: string | null
          changes_applied: Json
          changes_pending: Json
          completed_at: string | null
          config_snapshot_after: Json
          config_snapshot_before: Json
          created_at: string
          dimension_scores: Json
          error_message: string | null
          id: string
          issues_found: Json
          low_score_count: number
          negative_feedback_count: number
          note: string | null
          pass_rate: number | null
          positive_feedback_count: number
          publish_mode: string
          report: Json
          run_date: string
          started_at: string | null
          status: string
          turns_evaluated: number
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          average_score?: number | null
          baseline_skill_version_id?: string | null
          candidate_changes?: Json
          candidate_comparison?: Json
          candidate_skill_version_id?: string | null
          changes_applied?: Json
          changes_pending?: Json
          completed_at?: string | null
          config_snapshot_after?: Json
          config_snapshot_before?: Json
          created_at?: string
          dimension_scores?: Json
          error_message?: string | null
          id?: string
          issues_found?: Json
          low_score_count?: number
          negative_feedback_count?: number
          note?: string | null
          pass_rate?: number | null
          positive_feedback_count?: number
          publish_mode?: string
          report?: Json
          run_date: string
          started_at?: string | null
          status?: string
          turns_evaluated?: number
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          average_score?: number | null
          baseline_skill_version_id?: string | null
          candidate_changes?: Json
          candidate_comparison?: Json
          candidate_skill_version_id?: string | null
          changes_applied?: Json
          changes_pending?: Json
          completed_at?: string | null
          config_snapshot_after?: Json
          config_snapshot_before?: Json
          created_at?: string
          dimension_scores?: Json
          error_message?: string | null
          id?: string
          issues_found?: Json
          low_score_count?: number
          negative_feedback_count?: number
          note?: string | null
          pass_rate?: number | null
          positive_feedback_count?: number
          publish_mode?: string
          report?: Json
          run_date?: string
          started_at?: string | null
          status?: string
          turns_evaluated?: number
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hai_optimization_log_baseline_skill_version_id_fkey"
            columns: ["baseline_skill_version_id"]
            isOneToOne: false
            referencedRelation: "hai_chat_skill_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_optimization_log_candidate_skill_version_id_fkey"
            columns: ["candidate_skill_version_id"]
            isOneToOne: true
            referencedRelation: "hai_chat_skill_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_quality_test_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          mode: string
          name: string
          notes: string | null
          objective: string | null
          scenario: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mode?: string
          name: string
          notes?: string | null
          objective?: string | null
          scenario?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mode?: string
          name?: string
          notes?: string | null
          objective?: string | null
          scenario?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_quality_test_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_quota_policies: {
        Row: {
          created_at: string
          daily_token_limit: number
          enabled: boolean
          global_concurrency_limit: number
          key: string
          label: string
          max_output_tokens: number
          single_request_token_limit: number
          updated_at: string
          user_concurrency_limit: number
          weekly_token_limit: number
        }
        Insert: {
          created_at?: string
          daily_token_limit: number
          enabled?: boolean
          global_concurrency_limit?: number
          key: string
          label: string
          max_output_tokens?: number
          single_request_token_limit: number
          updated_at?: string
          user_concurrency_limit?: number
          weekly_token_limit: number
        }
        Update: {
          created_at?: string
          daily_token_limit?: number
          enabled?: boolean
          global_concurrency_limit?: number
          key?: string
          label?: string
          max_output_tokens?: number
          single_request_token_limit?: number
          updated_at?: string
          user_concurrency_limit?: number
          weekly_token_limit?: number
        }
        Relationships: []
      }
      hai_request_reservations: {
        Row: {
          actual_input_tokens: number | null
          actual_output_tokens: number | null
          completed_at: string | null
          created_at: string
          estimated_input_tokens: number
          estimated_output_tokens: number
          expires_at: string
          id: string
          metadata: Json
          request_id: string
          route: string
          status: string
          user_id: string
        }
        Insert: {
          actual_input_tokens?: number | null
          actual_output_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          estimated_input_tokens?: number
          estimated_output_tokens?: number
          expires_at?: string
          id?: string
          metadata?: Json
          request_id: string
          route: string
          status?: string
          user_id: string
        }
        Update: {
          actual_input_tokens?: number | null
          actual_output_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          estimated_input_tokens?: number
          estimated_output_tokens?: number
          expires_at?: string
          id?: string
          metadata?: Json
          request_id?: string
          route?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_request_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_runtime_settings: {
        Row: {
          category: string
          created_at: string
          default_value: Json
          description: string
          enabled: boolean
          key: string
          label: string
          max_value: number | null
          min_value: number | null
          options: Json
          step: number | null
          unit: string | null
          updated_at: string
          updated_by: string | null
          value: Json
          value_type: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_value: Json
          description?: string
          enabled?: boolean
          key: string
          label: string
          max_value?: number | null
          min_value?: number | null
          options?: Json
          step?: number | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          value: Json
          value_type: string
        }
        Update: {
          category?: string
          created_at?: string
          default_value?: Json
          description?: string
          enabled?: boolean
          key?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          options?: Json
          step?: number | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_runtime_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_textbook_collections: {
        Row: {
          content_type: string
          created_at: string
          edition_family: string
          edition_label: string
          effective_from: string | null
          effective_to: string | null
          grade_label: string
          grade_level: number
          id: string
          is_active: boolean
          metadata: Json
          publication_status: string
          publisher: string
          requires_confirmation: boolean
          slug: string
          source_file_name: string
          source_hash: string
          source_note: string
          source_type: string
          stage: string
          subject: string
          title: string
          updated_at: string
          verification_status: string
          volume: string
        }
        Insert: {
          content_type?: string
          created_at?: string
          edition_family?: string
          edition_label: string
          effective_from?: string | null
          effective_to?: string | null
          grade_label: string
          grade_level: number
          id?: string
          is_active?: boolean
          metadata?: Json
          publication_status?: string
          publisher?: string
          requires_confirmation?: boolean
          slug: string
          source_file_name?: string
          source_hash: string
          source_note?: string
          source_type?: string
          stage: string
          subject: string
          title: string
          updated_at?: string
          verification_status?: string
          volume: string
        }
        Update: {
          content_type?: string
          created_at?: string
          edition_family?: string
          edition_label?: string
          effective_from?: string | null
          effective_to?: string | null
          grade_label?: string
          grade_level?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          publication_status?: string
          publisher?: string
          requires_confirmation?: boolean
          slug?: string
          source_file_name?: string
          source_hash?: string
          source_note?: string
          source_type?: string
          stage?: string
          subject?: string
          title?: string
          updated_at?: string
          verification_status?: string
          volume?: string
        }
        Relationships: []
      }
      hai_textbook_sections: {
        Row: {
          char_count: number
          collection_id: string
          content_hash: string
          content_markdown: string
          content_text: string
          content_type: string
          created_at: string
          frame_label: string
          frame_number: number
          frame_title: string
          id: string
          is_active: boolean
          knowledge_point_count: number
          lesson_label: string
          lesson_number: number
          lesson_title: string
          metadata: Json
          section_key: string
          section_path: string
          sort_order: number
          unit_label: string
          unit_number: number
          unit_title: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          char_count?: number
          collection_id: string
          content_hash: string
          content_markdown: string
          content_text: string
          content_type?: string
          created_at?: string
          frame_label: string
          frame_number: number
          frame_title: string
          id?: string
          is_active?: boolean
          knowledge_point_count?: number
          lesson_label: string
          lesson_number: number
          lesson_title: string
          metadata?: Json
          section_key: string
          section_path: string
          sort_order?: number
          unit_label: string
          unit_number: number
          unit_title: string
          updated_at?: string
          verification_status: string
        }
        Update: {
          char_count?: number
          collection_id?: string
          content_hash?: string
          content_markdown?: string
          content_text?: string
          content_type?: string
          created_at?: string
          frame_label?: string
          frame_number?: number
          frame_title?: string
          id?: string
          is_active?: boolean
          knowledge_point_count?: number
          lesson_label?: string
          lesson_number?: number
          lesson_title?: string
          metadata?: Json
          section_key?: string
          section_path?: string
          sort_order?: number
          unit_label?: string
          unit_number?: number
          unit_title?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_textbook_sections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "hai_textbook_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_usage_alerts: {
        Row: {
          created_at: string
          description: string
          fingerprint: string
          id: string
          metadata: Json
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          fingerprint: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          fingerprint?: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hai_usage_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_usage_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_usage_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          input_tokens: number | null
          metadata: Json
          output_tokens: number | null
          request_id: string | null
          route: string
          status: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          input_tokens?: number | null
          metadata?: Json
          output_tokens?: number | null
          request_id?: string | null
          route: string
          status: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          input_tokens?: number | null
          metadata?: Json
          output_tokens?: number | null
          request_id?: string | null
          route?: string
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hai_usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_user_access: {
        Row: {
          access_source: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          invite_code_id: string | null
          notes: string | null
          quota_policy_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_source?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          invite_code_id?: string | null
          notes?: string | null
          quota_policy_key?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_source?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          invite_code_id?: string | null
          notes?: string | null
          quota_policy_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_user_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_user_access_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "hai_invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_user_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_user_memories: {
        Row: {
          category: string
          confidence: number | null
          content: string
          created_at: string
          id: string
          source_id: string | null
          source_type: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          confidence?: number | null
          content: string
          created_at?: string
          id?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number | null
          content?: string
          created_at?: string
          id?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_user_memories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_work_artifacts: {
        Row: {
          content_json: Json
          content_markdown: string
          created_at: string
          id: string
          parent_artifact_id: string | null
          run_id: string
          task_id: string
          title: string
          user_id: string
          version_number: number
        }
        Insert: {
          content_json?: Json
          content_markdown: string
          created_at?: string
          id?: string
          parent_artifact_id?: string | null
          run_id: string
          task_id: string
          title: string
          user_id: string
          version_number: number
        }
        Update: {
          content_json?: Json
          content_markdown?: string
          created_at?: string
          id?: string
          parent_artifact_id?: string | null
          run_id?: string
          task_id?: string
          title?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "hai_work_artifacts_parent_artifact_id_fkey"
            columns: ["parent_artifact_id"]
            isOneToOne: false
            referencedRelation: "hai_work_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_artifacts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "hai_work_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_artifacts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hai_work_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_artifacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_work_runs: {
        Row: {
          client_request_id: string
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input_snapshot: Json
          input_tokens: number | null
          output_tokens: number | null
          parent_artifact_id: string | null
          revision_instruction: string | null
          skill_snapshot: Json
          skill_version_id: string | null
          started_at: string | null
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_request_id: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_snapshot?: Json
          input_tokens?: number | null
          output_tokens?: number | null
          parent_artifact_id?: string | null
          revision_instruction?: string | null
          skill_snapshot?: Json
          skill_version_id?: string | null
          started_at?: string | null
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_request_id?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_snapshot?: Json
          input_tokens?: number | null
          output_tokens?: number | null
          parent_artifact_id?: string | null
          revision_instruction?: string | null
          skill_snapshot?: Json
          skill_version_id?: string | null
          started_at?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_work_runs_parent_artifact_id_fkey"
            columns: ["parent_artifact_id"]
            isOneToOne: false
            referencedRelation: "hai_work_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_runs_skill_version_id_fkey"
            columns: ["skill_version_id"]
            isOneToOne: false
            referencedRelation: "hai_work_skill_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hai_work_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_work_skill_references: {
        Row: {
          content: string
          content_hash: string
          created_at: string
          description: string
          id: string
          load_mode: string
          max_chars: number
          media_type: string
          metadata: Json
          name: string
          path: string
          skill_version_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          content: string
          content_hash: string
          created_at?: string
          description?: string
          id?: string
          load_mode?: string
          max_chars?: number
          media_type?: string
          metadata?: Json
          name: string
          path: string
          skill_version_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          content?: string
          content_hash?: string
          created_at?: string
          description?: string
          id?: string
          load_mode?: string
          max_chars?: number
          media_type?: string
          metadata?: Json
          name?: string
          path?: string
          skill_version_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_work_skill_references_skill_version_id_fkey"
            columns: ["skill_version_id"]
            isOneToOne: false
            referencedRelation: "hai_work_skill_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_work_skill_versions: {
        Row: {
          created_at: string
          created_by: string | null
          default_prompt_template: string
          id: string
          input_contract: Json
          output_contract: Json
          prompt_template: string
          published_at: string | null
          skill_id: string
          snapshot_hash: string
          source_metadata: Json
          status: string
          updated_at: string
          version_label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_prompt_template?: string
          id?: string
          input_contract?: Json
          output_contract?: Json
          prompt_template: string
          published_at?: string | null
          skill_id: string
          snapshot_hash?: string
          source_metadata?: Json
          status?: string
          updated_at?: string
          version_label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_prompt_template?: string
          id?: string
          input_contract?: Json
          output_contract?: Json
          prompt_template?: string
          published_at?: string | null
          skill_id?: string
          snapshot_hash?: string
          source_metadata?: Json
          status?: string
          updated_at?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_work_skill_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_skill_versions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hai_work_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_work_skills: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_enabled: boolean
          is_fallback: boolean
          match_criteria: Json
          module_slug: string
          name: string
          priority: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_enabled?: boolean
          is_fallback?: boolean
          match_criteria?: Json
          module_slug: string
          name: string
          priority?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_enabled?: boolean
          is_fallback?: boolean
          match_criteria?: Json
          module_slug?: string
          name?: string
          priority?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_work_skills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_skills_module_slug_fkey"
            columns: ["module_slug"]
            isOneToOne: false
            referencedRelation: "hai_feature_modules"
            referencedColumns: ["slug"]
          },
        ]
      }
      hai_work_task_materials: {
        Row: {
          created_at: string
          material_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          material_id: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          material_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_work_task_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "hai_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_task_materials_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hai_work_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_task_materials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_work_tasks: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          latest_artifact_id: string | null
          module_slug: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          latest_artifact_id?: string | null
          module_slug: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          latest_artifact_id?: string | null
          module_slug?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_work_tasks_latest_artifact_id_fkey"
            columns: ["latest_artifact_id"]
            isOneToOne: false
            referencedRelation: "hai_work_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_tasks_module_slug_fkey"
            columns: ["module_slug"]
            isOneToOne: false
            referencedRelation: "hai_feature_modules"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "hai_work_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      isd_profiles: {
        Row: {
          access_level: Database["public"]["Enums"]["isd_access_level"]
          created_at: string | null
          id: string
          nickname: string
          phone: string
          status: Database["public"]["Enums"]["isd_user_status"]
          updated_at: string | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["isd_access_level"]
          created_at?: string | null
          id: string
          nickname?: string
          phone: string
          status?: Database["public"]["Enums"]["isd_user_status"]
          updated_at?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["isd_access_level"]
          created_at?: string | null
          id?: string
          nickname?: string
          phone?: string
          status?: Database["public"]["Enums"]["isd_user_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      isd_usage_records: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "isd_usage_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "isd_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_records: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          last_watched_at: string | null
          progress: number
          status: Database["public"]["Enums"]["learning_status"]
          updated_at: string | null
          user_id: string
          watch_count: number
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          progress?: number
          status?: Database["public"]["Enums"]["learning_status"]
          updated_at?: string | null
          user_id: string
          watch_count?: number
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          progress?: number
          status?: Database["public"]["Enums"]["learning_status"]
          updated_at?: string | null
          user_id?: string
          watch_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_records_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          created_at: string
          id: string
          note: string
          phone: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          temp_password: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string
          phone: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          temp_password?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          phone?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          temp_password?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      plus_course_modules: {
        Row: {
          category_names: string[]
          created_at: string
          description: string
          icon_key: string | null
          id: string
          is_active: boolean
          representative_titles: string[]
          short_title: string | null
          sort_order: number
          title: string
          track_id: string
          updated_at: string
        }
        Insert: {
          category_names?: string[]
          created_at?: string
          description?: string
          icon_key?: string | null
          id: string
          is_active?: boolean
          representative_titles?: string[]
          short_title?: string | null
          sort_order?: number
          title: string
          track_id: string
          updated_at?: string
        }
        Update: {
          category_names?: string[]
          created_at?: string
          description?: string
          icon_key?: string | null
          id?: string
          is_active?: boolean
          representative_titles?: string[]
          short_title?: string | null
          sort_order?: number
          title?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_course_modules_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "plus_course_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_course_tracks: {
        Row: {
          accent: string
          audience: string
          created_at: string
          description: string
          icon_key: string
          id: string
          is_active: boolean
          short_title: string
          sort_order: number
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          accent?: string
          audience?: string
          created_at?: string
          description?: string
          icon_key?: string
          id: string
          is_active?: boolean
          short_title?: string
          sort_order?: number
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          accent?: string
          audience?: string
          created_at?: string
          description?: string
          icon_key?: string
          id?: string
          is_active?: boolean
          short_title?: string
          sort_order?: number
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          avatar_url: string | null
          bonus_credits: number
          created_at: string | null
          id: string
          nickname: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          total_credits: number
          updated_at: string | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          avatar_url?: string | null
          bonus_credits?: number
          created_at?: string | null
          id: string
          nickname: string
          phone: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          total_credits?: number
          updated_at?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          avatar_url?: string | null
          bonus_credits?: number
          created_at?: string | null
          id?: string
          nickname?: string
          phone?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          total_credits?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      resources: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          links: Json
          resource_type: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          links?: Json
          resource_type?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          links?: Json
          resource_type?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          data: Json
          section_key: string
          section_label: string
          updated_at: string
        }
        Insert: {
          data?: Json
          section_key: string
          section_label: string
          updated_at?: string
        }
        Update: {
          data?: Json
          section_key?: string
          section_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          alt_text: string
          author: string | null
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          alt_text?: string
          author?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          alt_text?: string
          author?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_stats: {
        Row: {
          first_visit_at: string
          id: number
          last_visit_at: string
          visit_count: number
          visitor_uuid: string
        }
        Insert: {
          first_visit_at?: string
          id?: never
          last_visit_at?: string
          visit_count?: number
          visitor_uuid: string
        }
        Update: {
          first_visit_at?: string
          id?: never
          last_visit_at?: string
          visit_count?: number
          visitor_uuid?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_bonus_credits: {
        Args: { p_amount: number; p_reason: string; p_user_id: string }
        Returns: Json
      }
      admin_course_attachments: { Args: { p_course_id: string }; Returns: Json }
      admin_course_detail: { Args: { p_course_id: string }; Returns: Json }
      admin_course_list: { Args: never; Returns: Json }
      admin_course_rankings: { Args: never; Returns: Json }
      admin_inactive_students: { Args: never; Returns: Json }
      admin_member_overview: { Args: never; Returns: Json }
      admin_set_course_access_password: {
        Args: { p_course_id: string; p_password?: string }
        Returns: boolean
      }
      admin_student_leaderboard: { Args: never; Returns: Json }
      admin_student_list: { Args: never; Returns: Json }
      admin_update_user_access_level: {
        Args: { p_new_level: string; p_user_id: string }
        Returns: Json
      }
      calculate_user_total_credits: {
        Args: { p_bonus_credits?: number; p_user_id: string }
        Returns: number
      }
      can_access_course: { Args: { p_course_id: string }; Returns: boolean }
      course_catalog_snapshot: { Args: never; Returns: Json }
      course_detail_snapshot: { Args: { p_course_id: string }; Returns: Json }
      course_password_attempt_status: {
        Args: { p_course_id: string; p_identifier: string }
        Returns: Json
      }
      course_questions_feed: { Args: { p_course_id: string }; Returns: Json }
      get_my_notifications: { Args: never; Returns: Json }
      get_unread_notification_count: { Args: never; Returns: number }
      hai_access_status: { Args: never; Returns: Json }
      hai_check_and_reserve_usage: {
        Args: {
          p_estimated_input_tokens: number
          p_estimated_output_tokens?: number
          p_metadata?: Json
          p_request_id: string
          p_route: string
        }
        Returns: Json
      }
      hai_create_chat_skill_review_draft: {
        Args: {
          p_comparison?: Json
          p_expected_baseline_version_id: string
          p_file_changes: Json
          p_run_date: string
        }
        Returns: Json
      }
      hai_clone_work_skill_version: {
        Args: { p_skill_id: string; p_version_label: string }
        Returns: string
      }
      hai_finalize_usage: {
        Args: {
          p_duration_ms?: number
          p_entity_id?: string
          p_entity_type?: string
          p_input_tokens: number
          p_metadata?: Json
          p_output_tokens: number
          p_request_id: string
          p_route?: string
          p_status: string
        }
        Returns: undefined
      }
      hai_has_access: { Args: { p_user_id?: string }; Returns: boolean }
      hai_import_chat_skill_snapshot: {
        Args: {
          p_instructions: string
          p_reference_config: Json
          p_references: Json
          p_skill_id: string
          p_version_label: string
        }
        Returns: string
      }
      hai_import_textbook_payload: { Args: { p_payload: Json }; Returns: Json }
      hai_import_work_skill_snapshot: {
        Args: {
          p_input_contract: Json
          p_instructions: string
          p_output_contract: Json
          p_publish?: boolean
          p_references: Json
          p_skill_slug: string
          p_snapshot_hash: string
          p_source_metadata: Json
          p_version_label: string
        }
        Returns: string
      }
      hai_list_textbook_catalog: {
        Args: { p_stage?: string; p_subject?: string }
        Returns: {
          collection_slug: string
          collection_title: string
          edition_label: string
          frame_label: string
          frame_number: number
          frame_title: string
          grade_label: string
          grade_level: number
          lesson_label: string
          lesson_number: number
          lesson_title: string
          publication_status: string
          requires_confirmation: boolean
          stage: string
          subject: string
          unit_label: string
          unit_number: number
          unit_title: string
          verification_status: string
          volume: string
        }[]
      }
      hai_mark_stale_work_runs: {
        Args: { p_task_id?: string }
        Returns: number
      }
      hai_match_knowledge_chunks: {
        Args: { match_count?: number; query_text: string }
        Returns: {
          content: string
          id: string
          metadata: Json
          score: number
          source_id: string
          title: string
          topic: string
        }[]
      }
      hai_match_material_chunks: {
        Args: {
          match_count?: number
          query_text: string
          target_conversation_id?: string
          target_user_id?: string
        }
        Returns: {
          content: string
          id: string
          kind: string
          material_id: string
          metadata: Json
          score: number
          title: string
        }[]
      }
      hai_match_selected_material_chunks: {
        Args: {
          match_count?: number
          query_text: string
          selected_material_ids: string[]
          target_user_id?: string
        }
        Returns: {
          content: string
          id: string
          kind: string
          material_id: string
          metadata: Json
          score: number
          title: string
        }[]
      }
      hai_match_textbook_sections: {
        Args: {
          p_frame_query?: string
          p_grade_level?: number
          p_lesson_query?: string
          p_match_count?: number
          p_stage: string
          p_subject: string
          p_unit_query?: string
          p_volume?: string
        }
        Returns: {
          collection_id: string
          collection_slug: string
          collection_title: string
          content_hash: string
          content_markdown: string
          content_type: string
          edition_label: string
          frame_label: string
          frame_number: number
          frame_title: string
          grade_label: string
          grade_level: number
          lesson_label: string
          lesson_number: number
          lesson_title: string
          publication_status: string
          requires_confirmation: boolean
          score: number
          section_id: string
          section_path: string
          source_hash: string
          unit_label: string
          unit_number: number
          unit_title: string
          verification_status: string
          volume: string
        }[]
      }
      hai_publish_chat_skill_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      hai_publish_work_skill_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      hai_recompute_work_module_enabled: {
        Args: { p_module_slug: string }
        Returns: boolean
      }
      hai_redeem_invite_code: { Args: { p_code: string }; Returns: Json }
      hai_replace_chat_skill_references: {
        Args: { p_references: Json; p_version_id: string }
        Returns: undefined
      }
      hai_replace_work_skill_references: {
        Args: { p_references: Json; p_version_id: string }
        Returns: undefined
      }
      hai_save_chat_skill_draft_snapshot: {
        Args: {
          p_instructions: string
          p_reference_config: Json
          p_references: Json
          p_version_id: string
          p_version_label: string
        }
        Returns: undefined
      }
      hai_save_work_skill_draft_snapshot: {
        Args: {
          p_input_contract: Json
          p_instructions: string
          p_output_contract: Json
          p_references: Json
          p_version_id: string
          p_version_label: string
        }
        Returns: undefined
      }
      hai_set_work_fallback_skill: {
        Args: { p_skill_id: string }
        Returns: undefined
      }
      hai_set_work_skill_enabled: {
        Args: { p_enabled: boolean; p_skill_id: string }
        Returns: boolean
      }
      hai_trigger_daily_review: { Args: never; Returns: number }
      hai_usage_summary: { Args: { p_user_id?: string }; Returns: Json }
      home_page_snapshot: {
        Args: {
          activity_limit?: number
          announcement_limit?: number
          home_course_limit?: number
          latest_course_days?: number
          latest_course_limit?: number
        }
        Returns: Json
      }
      increment_course_view_count: {
        Args: { course_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      mark_notifications_read: { Args: { p_ids: string[] }; Returns: undefined }
      public_member_count: { Args: never; Returns: number }
      record_course_password_attempt: {
        Args: { p_course_id: string; p_identifier: string; p_success: boolean }
        Returns: undefined
      }
      record_course_visit: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: undefined
      }
      record_visit: { Args: { p_visitor_uuid: string }; Returns: Json }
      refresh_user_total_credits: {
        Args: { p_user_id: string }
        Returns: number
      }
      verify_course_access_password: {
        Args: { p_course_id: string; p_password: string }
        Returns: boolean
      }
    }
    Enums: {
      access_level: "free" | "plus" | "pro"
      course_level: "入门" | "初级" | "中级" | "高级"
      course_status: "draft" | "published" | "archived"
      isd_access_level: "free" | "paid"
      isd_user_status: "active" | "banned"
      learning_status: "not_started" | "in_progress" | "completed"
      user_role: "admin" | "editor" | "viewer" | "member"
      user_status: "active" | "banned"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_level: ["free", "plus", "pro"],
      course_level: ["入门", "初级", "中级", "高级"],
      course_status: ["draft", "published", "archived"],
      isd_access_level: ["free", "paid"],
      isd_user_status: ["active", "banned"],
      learning_status: ["not_started", "in_progress", "completed"],
      user_role: ["admin", "editor", "viewer", "member"],
      user_status: ["active", "banned"],
    },
  },
} as const
