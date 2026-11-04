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
      course_access_products: {
        Row: {
          code: string
          created_at: string
          description: string | null
          is_grantable: boolean
          name: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          is_grantable?: boolean
          name: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          is_grantable?: boolean
          name?: string
          sort_order?: number
          status?: string
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
          access_product_code: string | null
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
          access_product_code?: string | null
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
          access_product_code?: string | null
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
            foreignKeyName: "course_categories_access_product_code_fkey"
            columns: ["access_product_code"]
            isOneToOne: false
            referencedRelation: "course_access_products"
            referencedColumns: ["code"]
          },
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
          access_product_code: string | null
          audio_url: string | null
          body: string | null
          category: string | null
          category_id: string | null
          course_type: string
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
          access_product_code?: string | null
          audio_url?: string | null
          body?: string | null
          category?: string | null
          category_id?: string | null
          course_type?: string
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
          access_product_code?: string | null
          audio_url?: string | null
          body?: string | null
          category?: string | null
          category_id?: string | null
          course_type?: string
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
        Relationships: [
          {
            foreignKeyName: "courses_access_product_code_fkey"
            columns: ["access_product_code"]
            isOneToOne: false
            referencedRelation: "course_access_products"
            referencedColumns: ["code"]
          },
        ]
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
      daofa_lesson_media: {
        Row: {
          is_active: boolean
          lesson_id: string
          media_type: string
          storage_key: string
        }
        Insert: {
          is_active?: boolean
          lesson_id: string
          media_type: string
          storage_key: string
        }
        Update: {
          is_active?: boolean
          lesson_id?: string
          media_type?: string
          storage_key?: string
        }
        Relationships: []
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
      hai_case_library: {
        Row: {
          case_records: Json
          content_text: string
          created_at: string
          id: string
          run_id: string | null
          source_pages: Json
          status: string
          title: string
          updated_at: string
          workflow_revision: number
        }
        Insert: {
          case_records?: Json
          content_text: string
          created_at?: string
          id?: string
          run_id?: string | null
          source_pages?: Json
          status: string
          title: string
          updated_at?: string
          workflow_revision: number
        }
        Update: {
          case_records?: Json
          content_text?: string
          created_at?: string
          id?: string
          run_id?: string | null
          source_pages?: Json
          status?: string
          title?: string
          updated_at?: string
          workflow_revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "hai_case_library_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "hai_work_runs"
            referencedColumns: ["id"]
          },
        ]
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
      hai_courseware_decks: {
        Row: {
          ai_output: Json | null
          ai_output_text: string | null
          client_request_id: string
          created_at: string
          deck_spec: Json
          error_message: string | null
          id: string
          lesson_genre: string | null
          skill_snapshot: Json
          skill_version_id: string | null
          source_artifact_id: string
          source_artifact_version: number
          source_task_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
          visual_mode: string
        }
        Insert: {
          ai_output?: Json | null
          ai_output_text?: string | null
          client_request_id: string
          created_at?: string
          deck_spec?: Json
          error_message?: string | null
          id?: string
          lesson_genre?: string | null
          skill_snapshot?: Json
          skill_version_id?: string | null
          source_artifact_id: string
          source_artifact_version: number
          source_task_id: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          visual_mode?: string
        }
        Update: {
          ai_output?: Json | null
          ai_output_text?: string | null
          client_request_id?: string
          created_at?: string
          deck_spec?: Json
          error_message?: string | null
          id?: string
          lesson_genre?: string | null
          skill_snapshot?: Json
          skill_version_id?: string | null
          source_artifact_id?: string
          source_artifact_version?: number
          source_task_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          visual_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_courseware_decks_skill_version_id_fkey"
            columns: ["skill_version_id"]
            isOneToOne: false
            referencedRelation: "hai_courseware_skill_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_courseware_decks_source_artifact_id_fkey"
            columns: ["source_artifact_id"]
            isOneToOne: false
            referencedRelation: "hai_work_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_courseware_decks_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "hai_work_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_courseware_decks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_courseware_skill_references: {
        Row: {
          content: string
          created_at: string
          description: string
          id: string
          load_mode: string
          match_criteria: Json
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
          created_at?: string
          description?: string
          id?: string
          load_mode?: string
          match_criteria?: Json
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
          created_at?: string
          description?: string
          id?: string
          load_mode?: string
          match_criteria?: Json
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
            foreignKeyName: "hai_courseware_skill_references_skill_version_id_fkey"
            columns: ["skill_version_id"]
            isOneToOne: false
            referencedRelation: "hai_courseware_skill_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_courseware_skill_versions: {
        Row: {
          created_at: string
          created_by: string | null
          default_instructions: string
          id: string
          input_contract: Json
          instructions: string
          output_contract: Json
          published_at: string | null
          skill_id: string
          source_metadata: Json
          status: string
          updated_at: string
          version_label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_instructions?: string
          id?: string
          input_contract?: Json
          instructions: string
          output_contract?: Json
          published_at?: string | null
          skill_id: string
          source_metadata?: Json
          status?: string
          updated_at?: string
          version_label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_instructions?: string
          id?: string
          input_contract?: Json
          instructions?: string
          output_contract?: Json
          published_at?: string | null
          skill_id?: string
          source_metadata?: Json
          status?: string
          updated_at?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_courseware_skill_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_courseware_skill_versions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hai_courseware_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_courseware_skills: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_enabled: boolean
          is_fallback: boolean
          match_criteria: Json
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
          name?: string
          priority?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_courseware_skills_created_by_fkey"
            columns: ["created_by"]
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
        Relationships: [
          {
            foreignKeyName: "hai_feature_modules_model_provider_id_fkey"
            columns: ["model_provider_id"]
            isOneToOne: false
            referencedRelation: "hai_model_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_image_generation_runs: {
        Row: {
          art_style: string
          client_request_id: string
          completed_at: string | null
          composed_prompt: string
          created_at: string
          delivered_at: string | null
          delivery_deadline_at: string | null
          duration_ms: number | null
          error_message: string | null
          failure_code: string | null
          failure_detail: Json
          failure_stage: string | null
          id: string
          image_size: string
          image_type: string
          image_url: string | null
          metadata: Json
          model: string | null
          optimized_prompt: string | null
          parent_run_id: string | null
          prompt: string
          prompt_optimizer_duration_ms: number | null
          prompt_optimizer_error: string | null
          prompt_optimizer_model: string | null
          prompt_optimizer_provider: string | null
          prompt_optimizer_usage: Json
          provider: string | null
          provider_response: Json
          provider_task_id: string | null
          r2_key: string | null
          reference_images: Json
          source_url: string | null
          started_at: string | null
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          art_style: string
          client_request_id: string
          completed_at?: string | null
          composed_prompt: string
          created_at?: string
          delivered_at?: string | null
          delivery_deadline_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          failure_code?: string | null
          failure_detail?: Json
          failure_stage?: string | null
          id?: string
          image_size: string
          image_type: string
          image_url?: string | null
          metadata?: Json
          model?: string | null
          optimized_prompt?: string | null
          parent_run_id?: string | null
          prompt: string
          prompt_optimizer_duration_ms?: number | null
          prompt_optimizer_error?: string | null
          prompt_optimizer_model?: string | null
          prompt_optimizer_provider?: string | null
          prompt_optimizer_usage?: Json
          provider?: string | null
          provider_response?: Json
          provider_task_id?: string | null
          r2_key?: string | null
          reference_images?: Json
          source_url?: string | null
          started_at?: string | null
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          art_style?: string
          client_request_id?: string
          completed_at?: string | null
          composed_prompt?: string
          created_at?: string
          delivered_at?: string | null
          delivery_deadline_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          failure_code?: string | null
          failure_detail?: Json
          failure_stage?: string | null
          id?: string
          image_size?: string
          image_type?: string
          image_url?: string | null
          metadata?: Json
          model?: string | null
          optimized_prompt?: string | null
          parent_run_id?: string | null
          prompt?: string
          prompt_optimizer_duration_ms?: number | null
          prompt_optimizer_error?: string | null
          prompt_optimizer_model?: string | null
          prompt_optimizer_provider?: string | null
          prompt_optimizer_usage?: Json
          provider?: string | null
          provider_response?: Json
          provider_task_id?: string | null
          r2_key?: string | null
          reference_images?: Json
          source_url?: string | null
          started_at?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_image_generation_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "hai_image_generation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_image_generation_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hai_image_generation_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_image_generation_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_image_generation_tasks: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          ppt_deck_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          ppt_deck_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          ppt_deck_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_image_generation_tasks_ppt_deck_id_fkey"
            columns: ["ppt_deck_id"]
            isOneToOne: false
            referencedRelation: "hai_image_ppt_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_image_generation_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_image_ppt_decks: {
        Row: {
          art_style: string | null
          client_request_id: string
          course: Json
          created_at: string
          error_message: string | null
          id: string
          image_task_id: string
          outline: Json
          outline_feedback: string
          outline_markdown: string
          preview_approved: boolean
          preview_page_id: string | null
          requirements: string
          revision: number
          settings: Json
          skill_instructions: string
          skill_version_id: string | null
          source_artifact_id: string | null
          source_snapshot: Json
          source_version: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          art_style?: string | null
          client_request_id: string
          course?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          image_task_id: string
          outline?: Json
          outline_feedback?: string
          outline_markdown?: string
          preview_approved?: boolean
          preview_page_id?: string | null
          requirements?: string
          revision?: number
          settings?: Json
          skill_instructions: string
          skill_version_id?: string | null
          source_artifact_id?: string | null
          source_snapshot: Json
          source_version: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          art_style?: string | null
          client_request_id?: string
          course?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          image_task_id?: string
          outline?: Json
          outline_feedback?: string
          outline_markdown?: string
          preview_approved?: boolean
          preview_page_id?: string | null
          requirements?: string
          revision?: number
          settings?: Json
          skill_instructions?: string
          skill_version_id?: string | null
          source_artifact_id?: string | null
          source_snapshot?: Json
          source_version?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_image_ppt_decks_image_task_id_fkey"
            columns: ["image_task_id"]
            isOneToOne: true
            referencedRelation: "hai_image_generation_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_image_ppt_decks_skill_version_id_fkey"
            columns: ["skill_version_id"]
            isOneToOne: false
            referencedRelation: "hai_work_skill_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_image_ppt_decks_source_artifact_id_fkey"
            columns: ["source_artifact_id"]
            isOneToOne: false
            referencedRelation: "hai_work_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_image_ppt_decks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_image_ppt_jobs: {
        Row: {
          deck_id: string
          lease_token: string | null
          lease_until: string | null
          model_started: boolean
          next_dispatch_at: string
          phase: string
          request_id: string
        }
        Insert: {
          deck_id: string
          lease_token?: string | null
          lease_until?: string | null
          model_started?: boolean
          next_dispatch_at?: string
          phase: string
          request_id: string
        }
        Update: {
          deck_id?: string
          lease_token?: string | null
          lease_until?: string | null
          model_started?: boolean
          next_dispatch_at?: string
          phase?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_image_ppt_jobs_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: true
            referencedRelation: "hai_image_ppt_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_image_ppt_pages: {
        Row: {
          attempt: number
          current_run_id: string | null
          deck_id: string
          page_id: string
          page_index: number
        }
        Insert: {
          attempt?: number
          current_run_id?: string | null
          deck_id: string
          page_id: string
          page_index: number
        }
        Update: {
          attempt?: number
          current_run_id?: string | null
          deck_id?: string
          page_id?: string
          page_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "hai_image_ppt_pages_current_run_id_fkey"
            columns: ["current_run_id"]
            isOneToOne: false
            referencedRelation: "hai_image_generation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_image_ppt_pages_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "hai_image_ppt_decks"
            referencedColumns: ["id"]
          },
        ]
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
      hai_membership_point_grants: {
        Row: {
          granted_at: string
          granted_by: string | null
          granted_points: number
          granted_tokens: number
          notified_at: string | null
          tokens_per_point: number
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          granted_points?: number
          granted_tokens?: number
          notified_at?: string | null
          tokens_per_point?: number
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          granted_points?: number
          granted_tokens?: number
          notified_at?: string | null
          tokens_per_point?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_membership_point_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_membership_point_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      hai_model_calls: {
        Row: {
          cache_hit_cost: number | null
          cache_hit_tokens: number | null
          cache_miss_cost: number | null
          cache_miss_tokens: number | null
          call_index: number
          completed_at: string | null
          completion_tokens: number | null
          created_at: string
          currency: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          model: string
          output_cost: number | null
          price_band: string
          price_snapshot: Json
          prompt_tokens: number | null
          provider: string
          provider_request_id: string | null
          reasoning_tokens: number | null
          request_id: string
          route: string
          stage: string
          started_at: string
          status: string
          total_cost: number | null
          total_tokens: number | null
          usage_status: string
          user_id: string | null
          visible_output_tokens: number | null
        }
        Insert: {
          cache_hit_cost?: number | null
          cache_hit_tokens?: number | null
          cache_miss_cost?: number | null
          cache_miss_tokens?: number | null
          call_index: number
          completed_at?: string | null
          completion_tokens?: number | null
          created_at?: string
          currency?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          model: string
          output_cost?: number | null
          price_band?: string
          price_snapshot?: Json
          prompt_tokens?: number | null
          provider: string
          provider_request_id?: string | null
          reasoning_tokens?: number | null
          request_id: string
          route: string
          stage: string
          started_at?: string
          status?: string
          total_cost?: number | null
          total_tokens?: number | null
          usage_status?: string
          user_id?: string | null
          visible_output_tokens?: number | null
        }
        Update: {
          cache_hit_cost?: number | null
          cache_hit_tokens?: number | null
          cache_miss_cost?: number | null
          cache_miss_tokens?: number | null
          call_index?: number
          completed_at?: string | null
          completion_tokens?: number | null
          created_at?: string
          currency?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          model?: string
          output_cost?: number | null
          price_band?: string
          price_snapshot?: Json
          prompt_tokens?: number | null
          provider?: string
          provider_request_id?: string | null
          reasoning_tokens?: number | null
          request_id?: string
          route?: string
          stage?: string
          started_at?: string
          status?: string
          total_cost?: number | null
          total_tokens?: number | null
          usage_status?: string
          user_id?: string | null
          visible_output_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hai_model_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_model_pricing: {
        Row: {
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          enabled: boolean
          id: string
          metadata: Json
          model_name: string
          off_peak_cache_hit_input_per_million: number
          off_peak_cache_miss_input_per_million: number
          off_peak_output_per_million: number
          peak_cache_hit_input_per_million: number
          peak_cache_miss_input_per_million: number
          peak_output_per_million: number
          provider: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_from: string
          effective_to?: string | null
          enabled?: boolean
          id?: string
          metadata?: Json
          model_name: string
          off_peak_cache_hit_input_per_million: number
          off_peak_cache_miss_input_per_million: number
          off_peak_output_per_million: number
          peak_cache_hit_input_per_million: number
          peak_cache_miss_input_per_million: number
          peak_output_per_million: number
          provider: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          enabled?: boolean
          id?: string
          metadata?: Json
          model_name?: string
          off_peak_cache_hit_input_per_million?: number
          off_peak_cache_miss_input_per_million?: number
          off_peak_output_per_million?: number
          peak_cache_hit_input_per_million?: number
          peak_cache_miss_input_per_million?: number
          peak_output_per_million?: number
          provider?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      hai_model_providers: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          id: string
          is_enabled: boolean
          label: string
          model_name: string
          provider_code: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          label: string
          model_name: string
          provider_code?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          label?: string
          model_name?: string
          provider_code?: string
          sort_order?: number
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
            isOneToOne: false
            referencedRelation: "hai_chat_skill_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_point_packages: {
        Row: {
          created_at: string
          description: string
          id: string
          is_enabled: boolean
          is_recommended: boolean
          name: string
          points: number
          price_cny: number
          sort_order: number
          updated_at: string
          value_metrics: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_enabled?: boolean
          is_recommended?: boolean
          name?: string
          points: number
          price_cny: number
          sort_order?: number
          updated_at?: string
          value_metrics?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_enabled?: boolean
          is_recommended?: boolean
          name?: string
          points?: number
          price_cny?: number
          sort_order?: number
          updated_at?: string
          value_metrics?: string
        }
        Relationships: []
      }
      hai_point_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          points_delta: number
          reason: string
          request_id: string | null
          token_delta: number
          tokens_per_point: number
          transaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          points_delta: number
          reason?: string
          request_id?: string | null
          token_delta: number
          tokens_per_point: number
          transaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          points_delta?: number
          reason?: string
          request_id?: string | null
          token_delta?: number
          tokens_per_point?: number
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_point_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_point_wallets: {
        Row: {
          balance_tokens: number
          created_at: string
          newcomer_grant_tokens: number
          newcomer_granted_at: string | null
          total_consumed_tokens: number
          total_credited_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_tokens?: number
          created_at?: string
          newcomer_grant_tokens?: number
          newcomer_granted_at?: string | null
          total_consumed_tokens?: number
          total_credited_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_tokens?: number
          created_at?: string
          newcomer_grant_tokens?: number
          newcomer_granted_at?: string | null
          total_consumed_tokens?: number
          total_credited_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_point_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_politics_case_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          slug: string
          source_file_name: string
          source_hash: string
          source_note: string
          stage_scope: string[]
          subject_scope: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          slug: string
          source_file_name?: string
          source_hash: string
          source_note?: string
          stage_scope?: string[]
          subject_scope?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          slug?: string
          source_file_name?: string
          source_hash?: string
          source_note?: string
          stage_scope?: string[]
          subject_scope?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hai_politics_cases: {
        Row: {
          case_key: string
          char_count: number
          classroom_question: string
          concepts: string[]
          content_hash: string
          content_markdown: string
          content_text: string
          created_at: string
          event_date: string
          id: string
          is_active: boolean
          metadata: Json
          sort_order: number
          source_id: string
          source_urls: string[]
          stage_scope: string[]
          summary: string
          title: string
          topic_direction: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          case_key: string
          char_count?: number
          classroom_question: string
          concepts?: string[]
          content_hash: string
          content_markdown: string
          content_text: string
          created_at?: string
          event_date?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          sort_order?: number
          source_id: string
          source_urls?: string[]
          stage_scope?: string[]
          summary: string
          title: string
          topic_direction?: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          case_key?: string
          char_count?: number
          classroom_question?: string
          concepts?: string[]
          content_hash?: string
          content_markdown?: string
          content_text?: string
          created_at?: string
          event_date?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          sort_order?: number
          source_id?: string
          source_urls?: string[]
          stage_scope?: string[]
          summary?: string
          title?: string
          topic_direction?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_politics_cases_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hai_politics_case_sources"
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
          edition_year: number | null
          effective_from: string | null
          effective_to: string | null
          grade_label: string
          grade_level: number
          id: string
          is_active: boolean
          is_default: boolean
          lifecycle_status: string
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
          structure_profile: string
          subject: string
          text_fidelity: string
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
          edition_year?: number | null
          effective_from?: string | null
          effective_to?: string | null
          grade_label: string
          grade_level: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          lifecycle_status?: string
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
          structure_profile?: string
          subject: string
          text_fidelity?: string
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
          edition_year?: number | null
          effective_from?: string | null
          effective_to?: string | null
          grade_label?: string
          grade_level?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          lifecycle_status?: string
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
          structure_profile?: string
          subject?: string
          text_fidelity?: string
          title?: string
          updated_at?: string
          verification_status?: string
          volume?: string
        }
        Relationships: []
      }
      hai_textbook_section_links: {
        Row: {
          created_at: string
          id: string
          linked_section_id: string
          relation_type: string
          section_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_section_id: string
          relation_type: string
          section_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_section_id?: string
          relation_type?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_textbook_section_links_linked_section_id_fkey"
            columns: ["linked_section_id"]
            isOneToOne: false
            referencedRelation: "hai_textbook_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_textbook_section_links_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "hai_textbook_sections"
            referencedColumns: ["id"]
          },
        ]
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
          frame_policy: string
          frame_title: string
          id: string
          is_active: boolean
          knowledge_point_count: number
          lesson_label: string
          lesson_number: number
          lesson_title: string
          metadata: Json
          native_label: string
          native_node_type: string
          section_key: string
          section_level: string
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
          frame_policy?: string
          frame_title: string
          id?: string
          is_active?: boolean
          knowledge_point_count?: number
          lesson_label: string
          lesson_number: number
          lesson_title: string
          metadata?: Json
          native_label?: string
          native_node_type?: string
          section_key: string
          section_level?: string
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
          frame_policy?: string
          frame_title?: string
          id?: string
          is_active?: boolean
          knowledge_point_count?: number
          lesson_label?: string
          lesson_number?: number
          lesson_title?: string
          metadata?: Json
          native_label?: string
          native_node_type?: string
          section_key?: string
          section_level?: string
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
          actual_cache_hit_tokens: number | null
          actual_cache_miss_tokens: number | null
          actual_completion_tokens: number | null
          actual_cost: number | null
          actual_currency: string | null
          actual_prompt_tokens: number | null
          actual_reasoning_tokens: number | null
          actual_total_tokens: number | null
          actual_usage_status: string
          actual_visible_output_tokens: number | null
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
          actual_cache_hit_tokens?: number | null
          actual_cache_miss_tokens?: number | null
          actual_completion_tokens?: number | null
          actual_cost?: number | null
          actual_currency?: string | null
          actual_prompt_tokens?: number | null
          actual_reasoning_tokens?: number | null
          actual_total_tokens?: number | null
          actual_usage_status?: string
          actual_visible_output_tokens?: number | null
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
          actual_cache_hit_tokens?: number | null
          actual_cache_miss_tokens?: number | null
          actual_completion_tokens?: number | null
          actual_cost?: number | null
          actual_currency?: string | null
          actual_prompt_tokens?: number | null
          actual_reasoning_tokens?: number | null
          actual_total_tokens?: number | null
          actual_usage_status?: string
          actual_visible_output_tokens?: number | null
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
      hai_web_tool_calls: {
        Row: {
          created_at: string
          points: number
          request_id: string
          request_number: number
          run_id: string
          tool_kind: string
          unit_cost_cny: number
          user_id: string
        }
        Insert: {
          created_at?: string
          points: number
          request_id: string
          request_number: number
          run_id: string
          tool_kind: string
          unit_cost_cny: number
          user_id: string
        }
        Update: {
          created_at?: string
          points?: number
          request_id?: string
          request_number?: number
          run_id?: string
          tool_kind?: string
          unit_cost_cny?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_web_tool_calls_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "hai_work_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_web_tool_calls_user_id_fkey"
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
      hai_work_debug_traces: {
        Row: {
          created_at: string
          debug_trace: Json
          id: string
          run_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debug_trace?: Json
          id?: string
          run_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          debug_trace?: Json
          id?: string
          run_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_work_debug_traces_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "hai_work_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_work_debug_traces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_work_jobs: {
        Row: {
          attempts: Json
          created_at: string
          error_message: string | null
          lease_token: string | null
          lease_until: string | null
          next_dispatch_at: string
          payload: Json
          phase: string
          run_id: string
        }
        Insert: {
          attempts?: Json
          created_at?: string
          error_message?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_dispatch_at?: string
          payload: Json
          phase?: string
          run_id: string
        }
        Update: {
          attempts?: Json
          created_at?: string
          error_message?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_dispatch_at?: string
          payload?: Json
          phase?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_work_jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "hai_work_runs"
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
          execution_mode: string
          execution_phase: string | null
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
          workflow_state: Json | null
        }
        Insert: {
          client_request_id: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_mode?: string
          execution_phase?: string | null
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
          workflow_state?: Json | null
        }
        Update: {
          client_request_id?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_mode?: string
          execution_phase?: string | null
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
          workflow_state?: Json | null
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
      hai_work_scheduler_config: {
        Row: {
          auth_secret: string
          enabled: boolean
          endpoint_url: string
          singleton: boolean
        }
        Insert: {
          auth_secret: string
          enabled?: boolean
          endpoint_url: string
          singleton?: boolean
        }
        Update: {
          auth_secret?: string
          enabled?: boolean
          endpoint_url?: string
          singleton?: boolean
        }
        Relationships: []
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
      live_participant_tags: {
        Row: {
          created_at: string
          live_id: string
          tag: string
          user_id: string
        }
        Insert: {
          created_at?: string
          live_id: string
          tag: string
          user_id: string
        }
        Update: {
          created_at?: string
          live_id?: string
          tag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_participant_tags_live_id_user_id_fkey"
            columns: ["live_id", "user_id"]
            isOneToOne: false
            referencedRelation: "live_participants"
            referencedColumns: ["live_id", "user_id"]
          },
        ]
      }
      live_participants: {
        Row: {
          joined_at: string
          last_seen_at: string
          live_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          last_seen_at?: string
          live_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          last_seen_at?: string
          live_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_participants_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_question_target_tags: {
        Row: {
          question_id: string
          tag: string
        }
        Insert: {
          question_id: string
          tag: string
        }
        Update: {
          question_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_question_target_tags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_question_target_users: {
        Row: {
          question_id: string
          user_id: string
        }
        Insert: {
          question_id: string
          user_id: string
        }
        Update: {
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_question_target_users_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_question_target_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          current_question_id: string | null
          id: string
          question_state: string
          room_code: string | null
          status: string
          title: string
        }
        Insert: {
          current_question_id?: string | null
          id?: string
          question_state: string
          room_code?: string | null
          status: string
          title: string
        }
        Update: {
          current_question_id?: string | null
          id?: string
          question_state?: string
          room_code?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_current_question_id_fkey"
            columns: ["current_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
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
      membership_course_access: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at: string
          product_code: string
        }
        Insert: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at?: string
          product_code: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          product_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_course_access_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "course_access_products"
            referencedColumns: ["code"]
          },
        ]
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
      question_keys: {
        Row: {
          correct_answer: Json
          question_id: string
        }
        Insert: {
          correct_answer: Json
          question_id: string
        }
        Update: {
          correct_answer?: Json
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          audience_mode: string
          content: string
          id: string
          live_id: string
          options: Json
          position: number
          title: string
          type: string
        }
        Insert: {
          audience_mode?: string
          content: string
          id?: string
          live_id: string
          options?: Json
          position: number
          title: string
          type: string
        }
        Update: {
          audience_mode?: string
          content?: string
          id?: string
          live_id?: string
          options?: Json
          position?: number
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      responses: {
        Row: {
          answer: Json
          answered_at: string
          question_id: string
          user_id: string
        }
        Insert: {
          answer: Json
          answered_at?: string
          question_id: string
          user_id: string
        }
        Update: {
          answer?: Json
          answered_at?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_course_entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          notes: string | null
          product_code: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          notes?: string | null
          product_code: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          notes?: string | null
          product_code?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_course_entitlements_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_course_entitlements_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "course_access_products"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_course_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      v2_assessment_blocks: {
        Row: {
          assessment_type_id: string | null
          created_at: string
          estimated_minutes: number | null
          id: string
          instructions_markdown: string | null
          lesson_id: string | null
          required: boolean
          sort_order: number
          status: string
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          assessment_type_id?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          instructions_markdown?: string | null
          lesson_id?: string | null
          required?: boolean
          sort_order?: number
          status?: string
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assessment_type_id?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          instructions_markdown?: string | null
          lesson_id?: string | null
          required?: boolean
          sort_order?: number
          status?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_assessment_blocks_assessment_type_id_fkey"
            columns: ["assessment_type_id"]
            isOneToOne: false
            referencedRelation: "v2_dictionary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_assessment_blocks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v2_course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_assessment_blocks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v2_course_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_assessment_items: {
        Row: {
          assessment_block_id: string
          case_markdown: string | null
          created_at: string
          grading_mode_id: string | null
          id: string
          is_required: boolean
          item_type_id: string | null
          max_score: number | null
          prompt_markdown: string
          rubric: Json | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          assessment_block_id: string
          case_markdown?: string | null
          created_at?: string
          grading_mode_id?: string | null
          id?: string
          is_required?: boolean
          item_type_id?: string | null
          max_score?: number | null
          prompt_markdown: string
          rubric?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          assessment_block_id?: string
          case_markdown?: string | null
          created_at?: string
          grading_mode_id?: string | null
          id?: string
          is_required?: boolean
          item_type_id?: string | null
          max_score?: number | null
          prompt_markdown?: string
          rubric?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_assessment_items_assessment_block_id_fkey"
            columns: ["assessment_block_id"]
            isOneToOne: false
            referencedRelation: "v2_assessment_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_assessment_items_grading_mode_id_fkey"
            columns: ["grading_mode_id"]
            isOneToOne: false
            referencedRelation: "v2_dictionary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_assessment_items_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "v2_dictionary_items"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_assessment_options: {
        Row: {
          id: string
          item_id: string
          option_key: string
          option_text: string
          sort_order: number
        }
        Insert: {
          id?: string
          item_id: string
          option_key: string
          option_text: string
          sort_order?: number
        }
        Update: {
          id?: string
          item_id?: string
          option_key?: string
          option_text?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_assessment_options_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v2_assessment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_course_access: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          notes: string | null
          starts_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          notes?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          notes?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_course_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_course_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_course_lessons: {
        Row: {
          body_markdown: string | null
          challenge_markdown: string | null
          challenge_title: string | null
          created_at: string
          credits: number
          description: string | null
          duration_minutes: number | null
          id: string
          is_trial: boolean
          lesson_type_id: string | null
          membership_type: string | null
          objectives: Json
          published_at: string | null
          slug: string | null
          sort_order: number
          status: string
          subtitle: string | null
          success_criteria_markdown: string | null
          takeaway_markdown: string | null
          title: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          body_markdown?: string | null
          challenge_markdown?: string | null
          challenge_title?: string | null
          created_at?: string
          credits?: number
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_trial?: boolean
          lesson_type_id?: string | null
          membership_type?: string | null
          objectives?: Json
          published_at?: string | null
          slug?: string | null
          sort_order?: number
          status?: string
          subtitle?: string | null
          success_criteria_markdown?: string | null
          takeaway_markdown?: string | null
          title: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          body_markdown?: string | null
          challenge_markdown?: string | null
          challenge_title?: string | null
          created_at?: string
          credits?: number
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_trial?: boolean
          lesson_type_id?: string | null
          membership_type?: string | null
          objectives?: Json
          published_at?: string | null
          slug?: string | null
          sort_order?: number
          status?: string
          subtitle?: string | null
          success_criteria_markdown?: string | null
          takeaway_markdown?: string | null
          title?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_course_lessons_lesson_type_id_fkey"
            columns: ["lesson_type_id"]
            isOneToOne: false
            referencedRelation: "v2_dictionary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_course_lessons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v2_course_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_course_units: {
        Row: {
          created_at: string
          description_markdown: string | null
          id: string
          is_active: boolean
          slug: string
          sort_order: number
          status: string
          title: string
          unit_type_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_markdown?: string | null
          id?: string
          is_active?: boolean
          slug: string
          sort_order?: number
          status?: string
          title: string
          unit_type_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_markdown?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          unit_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_course_units_unit_type_id_fkey"
            columns: ["unit_type_id"]
            isOneToOne: false
            referencedRelation: "v2_dictionary_items"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_dictionary_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      v2_dictionary_items: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          is_active: boolean
          key: string
          label: string
          metadata: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_dictionary_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v2_dictionary_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_learning_records: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_viewed_at: string | null
          lesson_id: string
          progress: number
          status: string
          updated_at: string
          user_id: string
          watch_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          lesson_id: string
          progress?: number
          status?: string
          updated_at?: string
          user_id: string
          watch_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          lesson_id?: string
          progress?: number
          status?: string
          updated_at?: string
          user_id?: string
          watch_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_learning_records_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v2_course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_learning_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_lesson_knowledge_cards: {
        Row: {
          card_type_id: string | null
          content_markdown: string
          created_at: string
          id: string
          is_active: boolean
          lesson_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          card_type_id?: string | null
          content_markdown: string
          created_at?: string
          id?: string
          is_active?: boolean
          lesson_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          card_type_id?: string | null
          content_markdown?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lesson_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_lesson_knowledge_cards_card_type_id_fkey"
            columns: ["card_type_id"]
            isOneToOne: false
            referencedRelation: "v2_dictionary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_lesson_knowledge_cards_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v2_course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_lesson_resources: {
        Row: {
          created_at: string
          description: string | null
          external_url: string | null
          file_name: string | null
          file_size: number | null
          id: string
          is_active: boolean
          is_downloadable: boolean
          lesson_id: string
          metadata: Json
          mime_type: string | null
          resource_type_id: string | null
          sort_order: number
          storage_key: string | null
          storage_provider: string | null
          title: string | null
          updated_at: string
          usage_type_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          is_downloadable?: boolean
          lesson_id: string
          metadata?: Json
          mime_type?: string | null
          resource_type_id?: string | null
          sort_order?: number
          storage_key?: string | null
          storage_provider?: string | null
          title?: string | null
          updated_at?: string
          usage_type_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          is_downloadable?: boolean
          lesson_id?: string
          metadata?: Json
          mime_type?: string | null
          resource_type_id?: string | null
          sort_order?: number
          storage_key?: string | null
          storage_provider?: string | null
          title?: string | null
          updated_at?: string
          usage_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v2_course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_lesson_resources_resource_type_id_fkey"
            columns: ["resource_type_id"]
            isOneToOne: false
            referencedRelation: "v2_dictionary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_lesson_resources_usage_type_id_fkey"
            columns: ["usage_type_id"]
            isOneToOne: false
            referencedRelation: "v2_dictionary_items"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_manual_reviews: {
        Row: {
          answer_id: string | null
          attempt_id: string
          created_at: string
          feedback_markdown: string | null
          id: string
          review_status: string
          reviewer_id: string
          revision_required: boolean
          rubric_result: Json | null
          score: number | null
          updated_at: string
        }
        Insert: {
          answer_id?: string | null
          attempt_id: string
          created_at?: string
          feedback_markdown?: string | null
          id?: string
          review_status?: string
          reviewer_id: string
          revision_required?: boolean
          rubric_result?: Json | null
          score?: number | null
          updated_at?: string
        }
        Update: {
          answer_id?: string | null
          attempt_id?: string
          created_at?: string
          feedback_markdown?: string | null
          id?: string
          review_status?: string
          reviewer_id?: string
          revision_required?: boolean
          rubric_result?: Json | null
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_manual_reviews_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "v2_submission_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_manual_reviews_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "v2_submission_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_manual_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_submission_answers: {
        Row: {
          answer_json: Json | null
          answer_text: string | null
          attachment_data: Json
          attempt_id: string
          auto_score: number | null
          created_at: string
          id: string
          item_id: string
          updated_at: string
        }
        Insert: {
          answer_json?: Json | null
          answer_text?: string | null
          attachment_data?: Json
          attempt_id: string
          auto_score?: number | null
          created_at?: string
          id?: string
          item_id: string
          updated_at?: string
        }
        Update: {
          answer_json?: Json | null
          answer_text?: string | null
          attachment_data?: Json
          attempt_id?: string
          auto_score?: number | null
          created_at?: string
          id?: string
          item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_submission_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "v2_submission_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_submission_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v2_assessment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_submission_attempts: {
        Row: {
          assessment_block_id: string
          attempt_no: number
          created_at: string
          final_score: number | null
          id: string
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_block_id: string
          attempt_no: number
          created_at?: string
          final_score?: number | null
          id?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_block_id?: string
          attempt_no?: number
          created_at?: string
          final_score?: number | null
          id?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_submission_attempts_assessment_block_id_fkey"
            columns: ["assessment_block_id"]
            isOneToOne: false
            referencedRelation: "v2_assessment_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_submission_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_user_saved_cards: {
        Row: {
          created_at: string
          knowledge_card_id: string
          user_id: string
          user_note: string | null
        }
        Insert: {
          created_at?: string
          knowledge_card_id: string
          user_id: string
          user_note?: string | null
        }
        Update: {
          created_at?: string
          knowledge_card_id?: string
          user_id?: string
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_user_saved_cards_knowledge_card_id_fkey"
            columns: ["knowledge_card_id"]
            isOneToOne: false
            referencedRelation: "v2_lesson_knowledge_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_user_saved_cards_user_id_fkey"
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
      admin_set_user_course_access: {
        Args: {
          p_enabled: boolean
          p_notes?: string
          p_product_code: string
          p_user_id: string
        }
        Returns: Json
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
      clear_phone_login_attempts: {
        Args: { p_phone: string }
        Returns: undefined
      }
      consume_legacy_email_binding: {
        Args: { p_digest: string; p_user: string }
        Returns: string
      }
      course_catalog_snapshot: { Args: never; Returns: Json }
      course_detail_snapshot: { Args: { p_course_id: string }; Returns: Json }
      course_password_attempt_status: {
        Args: { p_course_id: string; p_identifier: string }
        Returns: Json
      }
      course_questions_feed: { Args: { p_course_id: string }; Returns: Json }
      get_live_admin_participants: {
        Args: { p_live_id: string }
        Returns: Json
      }
      get_live_participant_results: {
        Args: { p_question_id: string }
        Returns: Json
      }
      get_live_room_audience_summary: {
        Args: { p_live_id: string }
        Returns: Json
      }
      get_my_notifications: { Args: never; Returns: Json }
      get_unread_notification_count: { Args: never; Returns: number }
      hai_access_status: { Args: never; Returns: Json }
      hai_acknowledge_image_delivery: {
        Args: { p_run_id: string }
        Returns: Json
      }
      hai_act_workflow: {
        Args: {
          p_action: string
          p_feedback?: string
          p_option_id?: string
          p_revision: number
          p_run_id: string
        }
        Returns: Json
      }
      hai_admin_add_points: {
        Args: { p_points: number; p_reason: string; p_user_id: string }
        Returns: Json
      }
      hai_admin_batch_adjust_points: {
        Args: { p_points: number; p_reason: string; p_user_ids: string[] }
        Returns: Json
      }
      hai_admin_course_point_users: {
        Args: { p_product_code: string }
        Returns: Json
      }
      hai_admin_update_point_billing_config: {
        Args: {
          p_flash_cache_hit_multiplier: number
          p_flash_cache_miss_multiplier: number
          p_flash_output_multiplier: number
          p_pro_cache_hit_multiplier: number
          p_pro_cache_miss_multiplier: number
          p_pro_output_multiplier: number
          p_tokens_per_point: number
        }
        Returns: Json
      }
      hai_check_and_reserve_courseware_image: {
        Args: { p_metadata?: Json; p_request_id: string; p_route: string }
        Returns: Json
      }
      hai_check_and_reserve_image_generation: {
        Args: { p_metadata?: Json; p_request_id: string; p_route: string }
        Returns: Json
      }
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
      hai_checkpoint_case_retrieval: {
        Args: {
          p_attempt?: Json
          p_error?: string
          p_lease_token: string
          p_release?: boolean
          p_run_id: string
          p_state: Json
        }
        Returns: undefined
      }
      hai_checkpoint_unit_work_job: {
        Args: { p_attempt: Json; p_lease_token: string; p_run_id: string }
        Returns: undefined
      }
      hai_checkpoint_work_job: {
        Args: { p_attempt: Json; p_lease_token: string; p_run_id: string }
        Returns: undefined
      }
      hai_checkpoint_workflow: {
        Args: {
          p_attempt: Json
          p_lease_token: string
          p_result: Json
          p_run_id: string
        }
        Returns: undefined
      }
      hai_claim_image_ppt_job: { Args: { p_deck_id: string }; Returns: Json }
      hai_claim_work_job: { Args: { p_run_id: string }; Returns: Json }
      hai_clone_courseware_skill_version: {
        Args: {
          p_skill_id: string
          p_source_version_id: string
          p_version_label: string
        }
        Returns: string
      }
      hai_clone_work_skill_version: {
        Args: { p_skill_id: string; p_version_label: string }
        Returns: string
      }
      hai_close_image_generation_failure: {
        Args: {
          p_code: string
          p_detail?: Json
          p_run_id: string
          p_stage: string
        }
        Returns: Json
      }
      hai_complete_image_generation_run: {
        Args: { p_run_id: string }
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
      hai_create_image_ppt: {
        Args: {
          p_instructions: string
          p_request_id: string
          p_requirements: string
          p_skill_id: string
          p_source: Json
          p_user_id: string
        }
        Returns: string
      }
      hai_dispatch_image_ppt_jobs: { Args: never; Returns: number }
      hai_dispatch_work_jobs: { Args: never; Returns: number }
      hai_edit_image_ppt: {
        Args: {
          p_action: string
          p_data: Json
          p_deck_id: string
          p_revision: number
          p_user_id: string
        }
        Returns: undefined
      }
      hai_enqueue_work_job: {
        Args: { p_payload: Json; p_run_id: string }
        Returns: undefined
      }
      hai_ensure_points_wallet: {
        Args: { p_user_id: string }
        Returns: {
          balance_tokens: number
          created_at: string
          newcomer_grant_tokens: number
          newcomer_granted_at: string | null
          total_consumed_tokens: number
          total_credited_tokens: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "hai_point_wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hai_expire_image_delivery_runs: { Args: never; Returns: number }
      hai_fail_image_generation_run: {
        Args: {
          p_code?: string
          p_detail?: Json
          p_run_id: string
          p_stage?: string
        }
        Returns: Json
      }
      hai_finalize_courseware_image: {
        Args: {
          p_duration_ms?: number
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
          p_request_id: string
          p_route?: string
          p_status: string
        }
        Returns: undefined
      }
      hai_finalize_image_generation: {
        Args: {
          p_duration_ms?: number
          p_entity_id?: string
          p_metadata?: Json
          p_request_id: string
          p_route?: string
          p_status: string
        }
        Returns: undefined
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
      hai_finalize_usage_service: {
        Args: {
          p_duration_ms?: number
          p_entity_id?: string
          p_entity_type?: string
          p_input_tokens: number
          p_metadata?: Json
          p_output_tokens: number
          p_request_id: string
          p_route: string
          p_status: string
          p_user_id: string
        }
        Returns: undefined
      }
      hai_find_case_library: {
        Args: {
          p_exclude_revision?: number
          p_exclude_run_id?: string
          p_limit?: number
          p_terms: string[]
        }
        Returns: {
          case_records: Json
          content_text: string
          id: string
          source_pages: Json
          title: string
          updated_at: string
        }[]
      }
      hai_finish_guided_work_job: {
        Args: { p_lease_token: string; p_run_id: string }
        Returns: Json
      }
      hai_finish_image_ppt_model: {
        Args: {
          p_deck_id: string
          p_error: string
          p_lease: string
          p_result: Json
          p_usage: Json
        }
        Returns: boolean
      }
      hai_finish_unit_work_job: {
        Args: { p_lease_token: string; p_run_id: string }
        Returns: Json
      }
      hai_finish_work_job: {
        Args: { p_lease_token: string; p_run_id: string }
        Returns: Json
      }
      hai_get_textbook_sections_by_route: {
        Args: {
          p_collection_slug: string
          p_frame_number?: number
          p_lesson_number: number
          p_unit_number: number
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
          section_id: string
          section_level: string
          section_path: string
          sort_order: number
          source_hash: string
          unit_label: string
          unit_number: number
          unit_title: string
          verification_status: string
          volume: string
        }[]
      }
      hai_has_access: { Args: { p_user_id?: string }; Returns: boolean }
      hai_heartbeat_work_job: {
        Args: { p_lease_token: string; p_run_id: string }
        Returns: boolean
      }
      hai_image_ppt_worker_usage: {
        Args: {
          p_args: Json
          p_deck_id: string
          p_lease: string
          p_name: string
        }
        Returns: Json
      }
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
      hai_import_politics_case_payload: {
        Args: { p_payload: Json }
        Returns: Json
      }
      hai_import_textbook_payload: { Args: { p_payload: Json }; Returns: Json }
      hai_import_textbook_v3_lite_payload: {
        Args: { p_payload: Json }
        Returns: Json
      }
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
          frame_route_number: number
          frame_title: string
          grade_label: string
          grade_level: number
          lesson_label: string
          lesson_number: number
          lesson_route_number: number
          lesson_title: string
          publication_status: string
          requires_confirmation: boolean
          stage: string
          subject: string
          unit_label: string
          unit_number: number
          unit_route_number: number
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
      hai_match_politics_cases: {
        Args: {
          p_frame_query?: string
          p_grade_level?: number
          p_lesson_query?: string
          p_match_count?: number
          p_stage: string
          p_subject: string
          p_teaching_mode?: string
          p_unit_query?: string
        }
        Returns: {
          case_id: string
          classroom_question: string
          concepts: string[]
          content_hash: string
          content_markdown: string
          event_date: string
          score: number
          source_file_name: string
          source_slug: string
          source_urls: string[]
          summary: string
          title: string
          topic_direction: string
          verification_status: string
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
      hai_point_ledger: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      hai_prepare_image_ppt_page: {
        Args: {
          p_deck_id: string
          p_lease: string
          p_page_id: string
          p_prompt: string
        }
        Returns: Json
      }
      hai_prepare_web_tool_billing: {
        Args: { p_lease_token: string; p_run_id: string }
        Returns: undefined
      }
      hai_prepare_work_run: {
        Args: {
          p_client_request_id: string
          p_module_slug: string
          p_run: Json
          p_task_id: string
          p_task_title: string
          p_user_id: string
        }
        Returns: Json
      }
      hai_publish_chat_skill_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      hai_publish_courseware_skill_version: {
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
      hai_record_web_tool_success: {
        Args: {
          p_lease_token: string
          p_request_number: number
          p_run_id: string
          p_tool_kind: string
        }
        Returns: undefined
      }
      hai_redeem_invite_code: { Args: { p_code: string }; Returns: Json }
      hai_release_image_ppt_job: {
        Args: { p_deck_id: string; p_error?: string; p_lease: string }
        Returns: boolean
      }
      hai_replace_chat_skill_references: {
        Args: { p_references: Json; p_version_id: string }
        Returns: undefined
      }
      hai_replace_courseware_skill_references: {
        Args: { p_references: Json; p_version_id: string }
        Returns: undefined
      }
      hai_replace_work_skill_references: {
        Args: { p_references: Json; p_version_id: string }
        Returns: undefined
      }
      hai_runtime_numeric: {
        Args: { p_fallback: number; p_key: string }
        Returns: number
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
      hai_save_courseware_skill_draft_snapshot: {
        Args: {
          p_input_contract: Json
          p_instructions: string
          p_output_contract: Json
          p_references: Json
          p_source_metadata: Json
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
      hai_set_courseware_fallback_skill: {
        Args: { p_skill_id: string }
        Returns: undefined
      }
      hai_set_courseware_skill_enabled: {
        Args: { p_enabled: boolean; p_skill_id: string }
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
      hai_start_image_ppt_model: {
        Args: { p_deck_id: string; p_lease: string }
        Returns: boolean
      }
      hai_trigger_daily_review: { Args: never; Returns: number }
      hai_update_web_tool_prices: {
        Args: { p_fetch_cny: number; p_search_cny: number }
        Returns: undefined
      }
      hai_usage_summary: { Args: { p_user_id?: string }; Returns: Json }
      hai_work_queue_ready: { Args: never; Returns: boolean }
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
      live_can_access_question: {
        Args: { p_question_id: string }
        Returns: boolean
      }
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
      record_live_participant: {
        Args: { p_live_id: string }
        Returns: undefined
      }
      record_visit: { Args: { p_visitor_uuid: string }; Returns: Json }
      refresh_user_total_credits: {
        Args: { p_user_id: string }
        Returns: number
      }
      reserve_phone_login_attempt: {
        Args: { p_phone: string }
        Returns: boolean
      }
      set_live_participant_tags: {
        Args: { p_live_id: string; p_tags: string[]; p_user_id: string }
        Returns: string[]
      }
      set_live_question_audience: {
        Args: {
          p_audience_mode: string
          p_question_id: string
          p_tags: string[]
          p_user_ids: string[]
        }
        Returns: Json
      }
      start_legacy_email_binding: {
        Args: { p_digest: string; p_email: string; p_user: string }
        Returns: boolean
      }
      v2_get_assessment_key_admin: {
        Args: { p_item_id: string }
        Returns: Json
      }
      v2_import_course_workbook: { Args: { p_payload: Json }; Returns: Json }
      v2_publish_lesson_admin: {
        Args: { p_lesson_id: string }
        Returns: {
          body_markdown: string | null
          challenge_markdown: string | null
          challenge_title: string | null
          created_at: string
          credits: number
          description: string | null
          duration_minutes: number | null
          id: string
          is_trial: boolean
          lesson_type_id: string | null
          membership_type: string | null
          objectives: Json
          published_at: string | null
          slug: string | null
          sort_order: number
          status: string
          subtitle: string | null
          success_criteria_markdown: string | null
          takeaway_markdown: string | null
          title: string
          unit_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "v2_course_lessons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      v2_save_assessment_item_admin: {
        Args: {
          p_answer_key: Json
          p_assessment_block_id: string
          p_case_markdown: string
          p_grading_mode_id: string
          p_is_required: boolean
          p_item_id: string
          p_item_type_id: string
          p_max_score: number
          p_options: Json
          p_prompt_markdown: string
          p_rubric: Json
          p_sort_order: number
        }
        Returns: string
      }
      v2_submit_attempt: {
        Args: { p_attempt_id: string }
        Returns: {
          assessment_block_id: string
          attempt_no: number
          created_at: string
          final_score: number | null
          id: string
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "v2_submission_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_course_access_password: {
        Args: { p_course_id: string; p_password: string }
        Returns: boolean
      }
    }
    Enums: {
      access_level: "free" | "plus" | "plus2025" | "pro"
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
      access_level: ["free", "plus", "plus2025", "pro"],
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
