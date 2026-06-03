import type { ElementType } from "react";

export type View = "calendar" | "pipeline" | "feed" | "contents" | "campaigns" | "goals" | "metrics" | "clients" | "team" | "billing" | "workspace";

export type ViewItem = {
  id: View;
  label: string;
  icon: ElementType;
  agencyOnly?: boolean;
};

export type AgencyWorkspace = {
  name: string;
  description: string;
  address: string;
  phone: string;
  instagram: string;
  site: string;
  portfolio: string;
  avatar: string;
  avatarZoom: number;
  avatarPositionX: number;
  avatarPositionY: number;
  banner: string;
  bannerPosition: number;
  brandColor: string;
  toneOfVoice: string;
  palette: string[];
  fonts: string;
  notes: string;
  links: string;
  references: string;
};
