import type { ContentStatus, MediaType, PipelineStage, TeamMember, UserRole } from "@/types/domain";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          avatar: string | null;
          agency_id: string | null;
          client_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & {
          id: string;
          name: string;
          email: string;
          role: UserRole;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      agencies: {
        Row: { id: string; name: string; owner_id: string; created_at: string };
        Insert: { id?: string; name: string; owner_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["agencies"]["Row"]>;
      };
      clients: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          email: string | null;
          instagram_handle: string | null;
          phone: string | null;
          avatar: string | null;
          brand_color: string | null;
          invite_code: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["clients"]["Row"]> & {
          agency_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
      };
      posts: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          caption: string | null;
          instructions: string | null;
          status: ContentStatus;
          pipeline_stage: PipelineStage;
          scheduled_date: string;
          scheduled_time: string | null;
          feed_order: number;
          created_by: string | null;
          created_at: string;
          submitted_at: string | null;
          approved_at: string | null;
          revision_requested_at: string | null;
          scheduled_at: string | null;
          updated_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["posts"]["Row"]> & {
          client_id: string;
          title: string;
          scheduled_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Row"]>;
      };
      post_media: {
        Row: {
          id: string;
          post_id: string;
          media_url: string;
          media_type: MediaType;
          order_index: number;
        };
        Insert: Partial<Database["public"]["Tables"]["post_media"]["Row"]> & {
          post_id: string;
          media_url: string;
          media_type: MediaType;
        };
        Update: Partial<Database["public"]["Tables"]["post_media"]["Row"]>;
      };
      comments: {
        Row: { id: string; post_id: string; user_id: string; content: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["comments"]["Row"]> & {
          post_id: string;
          user_id: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Row"]>;
      };
      team_members: {
        Row: TeamMember;
        Insert: Partial<TeamMember> & {
          agency_id: string;
          name: string;
          email: string;
          role_title: string;
          access_code: string;
        };
        Update: Partial<TeamMember>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
