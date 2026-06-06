"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Eye,
  ExternalLink,
  FileText,
  Gift,
  Grid3X3,
  ImagePlus,
  LayoutDashboard,
  Lock,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Move,
  PanelRightOpen,
  Plus,
  RefreshCw,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  Target,
  Megaphone,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { ReveeLogo } from "@/components/logo";
import { FeedView } from "@/components/revee/feed-view";
import { MobileNav, Sidebar, Topbar, type NotificationItem } from "@/components/revee/navigation";
import type { AgencyWorkspace, View, ViewItem } from "@/components/revee/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { PLANS, formatCurrency, generateReferralCode, getContentLimit, getEstimatedPriceWithReferralDiscount, getLimit, getPastDueDaysLeft, getPlanLabel, getPlanPrice, getReferralDiscountAmount, getStatusLabel, getTrialDaysLeft, shouldSuspendAccess } from "@/lib/plans";
import { cn, formatDate, initials, toInstagramHandle } from "@/lib/utils";
import type { ActivityHistory, BillingCycle, BillingHistory, Campaign, CampaignMedia, CampaignPlatform, CampaignStatus, Client, Comment, ContentFormat, ContentStatus, MonthlyGoal, MonthlyGoalStatus, MonthlyMetric, MonthlyMetricStatus, PipelineStage, Post, PostMedia, Profile, Referral, Subscription, SubscriptionPlan, TeamMember } from "@/types/domain";

type AuthMode = "login" | "signup" | "forgot" | "reset" | "confirm";
type ClientInvite = Pick<Client, "id" | "name" | "avatar" | "agency_id">;
type MemberInvite = Pick<TeamMember, "id" | "name" | "avatar" | "agency_id" | "role_title">;
type StatusFilter = "all" | ContentStatus;
type TypeFilter = "all" | ContentFormat;
type ResponsibleOption = {
  key: string;
  userId: string | null;
  name: string;
  role: string;
};

type CampaignFormInput = {
  client_id: string;
  title: string;
  objective: string;
  platform: CampaignPlatform;
  audience: string;
  daily_budget: string;
  total_budget: string;
  start_date: string;
  end_date: string;
  status: CampaignStatus;
  responsible_user_id: string;
  responsible_name: string;
  copy: string;
  internal_notes: string;
  client_feedback: string;
  files: File[];
};

type MonthlyGoalFormInput = {
  client_id: string;
  month: number;
  year: number;
  title: string;
  description: string;
  planned_actions: string;
  responsible_user_id: string;
  responsible_name: string;
  status: MonthlyGoalStatus;
  client_feedback: string;
  result_notes: string;
};

type MonthlyMetricFormInput = {
  client_id: string;
  month: number;
  year: number;
  instagram_followers: string;
  instagram_reach: string;
  instagram_impressions: string;
  instagram_link_clicks: string;
  instagram_engagement: string;
  instagram_likes: string;
  instagram_comments: string;
  instagram_saves: string;
  instagram_shares: string;
  instagram_reposts: string;
  paid_investment: string;
  paid_reach: string;
  paid_impressions: string;
  paid_clicks: string;
  paid_leads: string;
  status: MonthlyMetricStatus;
};

const statusMeta: Record<ContentStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Rascunho", color: "#6f6a86", bg: "#f7f6fa" },
  creating: { label: "Em criação", color: "#7b4aa1", bg: "#f2e9f8" },
  awaiting_approval: { label: "Aguardando aprovação", color: "#7450a8", bg: "#efe8fb" },
  approved: { label: "Aprovado", color: "#2f7a5c", bg: "#e5f4ee" },
  revision_requested: { label: "Precisa de alteração", color: "#8a4a63", bg: "#f6e7ee" },
  scheduled: { label: "Agendado", color: "#46658e", bg: "#e8eef7" },
  published: { label: "Publicado", color: "#2f7a5c", bg: "#e5f4ee" }
};

const pipelineMeta: Record<PipelineStage, { label: string; description: string }> = {
  needs_recording: { label: "Falta gravação", description: "Conteúdos aguardando captação" },
  needs_design: { label: "Falta design", description: "Criativos em produção" },
  needs_caption: { label: "Falta legenda", description: "Texto e revisão da legenda" },
  waiting_client: { label: "Aguardando cliente", description: "Pendentes de aprovação" },
  revision: { label: "Precisa de alteração", description: "Ajustes solicitados pelo cliente" },
  approved: { label: "Aprovado", description: "Pronto para agendamento" },
  scheduled: { label: "Programado", description: "Conteúdos com data marcada" },
  published: { label: "Publicado", description: "Conteúdos finalizados" }
};

const pipelineStyle: Record<PipelineStage, { accent: string; bg: string }> = {
  needs_recording: { accent: "#6f6a86", bg: "#f7f6fa" },
  needs_design: { accent: "#7b4aa1", bg: "#f2e9f8" },
  needs_caption: { accent: "#7450a8", bg: "#efe8fb" },
  waiting_client: { accent: "#46658e", bg: "#e8eef7" },
  revision: { accent: "#8a4a63", bg: "#f6e7ee" },
  approved: { accent: "#2f7a5c", bg: "#e5f4ee" },
  scheduled: { accent: "#46658e", bg: "#e8eef7" },
  published: { accent: "#2f7a5c", bg: "#e5f4ee" }
};

type PipelineColumnStage = PipelineStage | "campaign_active";

const pipelineColumnMeta: Record<PipelineColumnStage, { label: string; description: string }> = {
  ...pipelineMeta,
  campaign_active: { label: "Campanhas ativas", description: "Tráfego rodando agora" }
};

const pipelineColumnStyle: Record<PipelineColumnStage, { accent: string; bg: string }> = {
  ...pipelineStyle,
  campaign_active: { accent: "#7b4aa1", bg: "#f2e9f8" }
};

const campaignStatusMeta: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  creating: { label: "Em criação", color: "#7b4aa1", bg: "#f2e9f8" },
  awaiting_approval: { label: "Aguardando aprovação", color: "#7450a8", bg: "#efe8fb" },
  approved: { label: "Aprovada", color: "#2f7a5c", bg: "#e5f4ee" },
  active: { label: "Ativa", color: "#2c7058", bg: "#e4f2ed" },
  paused: { label: "Pausada", color: "#6f6a86", bg: "#f7f6fa" },
  finished: { label: "Finalizada", color: "#46658e", bg: "#e8eef7" },
  revision_requested: { label: "Revisão solicitada", color: "#8a4a63", bg: "#f6e7ee" }
};

const monthlyGoalStatusMeta: Record<MonthlyGoalStatus, { label: string; color: string; bg: string }> = {
  planned: { label: "Planejado", color: "#7450a8", bg: "#efe8fb" },
  in_progress: { label: "Em andamento", color: "#46658e", bg: "#e8eef7" },
  done: { label: "Realizado", color: "#2f7a5c", bg: "#e5f4ee" },
  paused: { label: "Pausado", color: "#6f6a86", bg: "#f7f6fa" },
  cancelled: { label: "Cancelado", color: "#8a4a63", bg: "#f6e7ee" }
};

const monthlyMetricStatusMeta: Record<MonthlyMetricStatus, { label: string; color: string; bg: string }> = {
  filling: { label: "Em preenchimento", color: "#7450a8", bg: "#efe8fb" },
  sent_to_client: { label: "Enviado para cliente", color: "#46658e", bg: "#e8eef7" },
  reviewed: { label: "Revisado", color: "#6f6a86", bg: "#f7f6fa" },
  closed: { label: "Fechado", color: "#170b43", bg: "#eeeaf6" }
};

const campaignPlatforms: CampaignPlatform[] = ["Meta Ads", "Google Ads", "TikTok Ads", "Pinterest Ads", "Outra"];

const views: ViewItem[] = [
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "pipeline", label: "Fluxo", icon: LayoutDashboard },
  { id: "feed", label: "Prévia", icon: Grid3X3 },
  { id: "contents", label: "Conteúdos", icon: FileText },
  { id: "campaigns", label: "Campanhas", icon: Megaphone },
  { id: "goals", label: "Objetivos", icon: Target },
  { id: "metrics", label: "Métricas", icon: BarChart3 },
  { id: "clients", label: "Clientes", icon: Users, agencyOnly: true },
  { id: "team", label: "Equipe", icon: UserPlus, agencyOnly: true }
];

const seedClients: Client[] = [
  {
    id: "client-a",
    agency_id: "agency-local",
    name: "Casa Aurora",
    instagram_handle: "casaaurora",
    phone: "+55 11 90000-0000",
    email: "aurora@exemplo.com",
    avatar: null,
    brand_color: "#170b43",
    invite_code: "CAS-DEMO01"
  },
  {
    id: "client-b",
    agency_id: "agency-local",
    name: "Lume Clinic",
    instagram_handle: "lumeclinic",
    phone: "+55 11 98888-0000",
    email: "lume@exemplo.com",
    avatar: null,
    brand_color: "#4CAF85",
    invite_code: "LUM-DEMO02"
  }
];

const seedPosts: Post[] = [
  {
    id: "post-1",
    client_id: "client-a",
    title: "Carrossel manifesto da marca",
    caption: "Design que acolhe, ilumina e transforma a rotina em presença.",
    instructions: "Usar paleta neutra, textura de papel e última lâmina com CTA para salvar.",
    status: "awaiting_approval",
    pipeline_stage: "waiting_client",
    scheduled_date: "2026-05-18",
    scheduled_time: "10:30",
    feed_order: 1,
    created_by: "local-agency",
    created_at: new Date().toISOString(),
    media: [
      {
        id: "media-1",
        post_id: "post-1",
        media_url: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
        media_type: "image",
        order_index: 0
      },
      {
        id: "media-1b",
        post_id: "post-1",
        media_url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
        media_type: "image",
        order_index: 1
      }
    ]
  },
  {
    id: "post-2",
    client_id: "client-a",
    title: "Reels bastidores showroom",
    caption: "Um olhar rápido para os detalhes que fazem a experiência acontecer.",
    instructions: "Vídeo curto, cortes suaves e legenda com tom editorial.",
    status: "creating",
    pipeline_stage: "needs_caption",
    scheduled_date: "2026-05-21",
    scheduled_time: "18:00",
    feed_order: 2,
    created_by: "local-agency",
    created_at: new Date().toISOString(),
    media: [
      {
        id: "media-2",
        post_id: "post-2",
        media_url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
        media_type: "image",
        order_index: 0
      }
    ]
  },
  {
    id: "post-3",
    client_id: "client-a",
    title: "Post estático coleção inverno",
    caption: "A nova coleção chegou com camadas, textura e conforto visual.",
    instructions: "Priorizar produto em primeiro plano e evitar textos longos na arte.",
    status: "approved",
    pipeline_stage: "approved",
    scheduled_date: "2026-05-24",
    scheduled_time: "12:00",
    feed_order: 0,
    created_by: "local-agency",
    created_at: new Date().toISOString(),
    media: [
      {
        id: "media-3",
        post_id: "post-3",
        media_url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80",
        media_type: "image",
        order_index: 0
      }
    ]
  }
];

const seedCampaigns: Campaign[] = [
  {
    id: "campaign-local-1",
    agency_id: "agency-local",
    client_id: "client-a",
    title: "Captação showroom maio",
    objective: "Gerar conversas qualificadas para visita ao showroom.",
    platform: "Meta Ads",
    audience: "Mulheres de 28 a 48 anos, interessadas em decoração autoral e arquitetura.",
    daily_budget: 80,
    total_budget: 1200,
    start_date: "2026-05-14",
    end_date: "2026-05-30",
    status: "awaiting_approval",
    responsible_user_id: null,
    responsible_name: "Dani",
    copy: "Sua casa pode ter uma presença mais autoral sem perder acolhimento. Conheça a curadoria Casa Aurora.",
    internal_notes: "Validar criativo principal antes de ativar.",
    client_feedback: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [
      {
        id: "campaign-media-local-1",
        campaign_id: "campaign-local-1",
        url: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
        type: "image",
        order_index: 0,
        created_at: new Date().toISOString()
      }
    ]
  }
];

const seedMonthlyGoals: MonthlyGoal[] = [
  {
    id: "goal-local-1",
    agency_id: "agency-local",
    client_id: "client-a",
    month: 5,
    year: 2026,
    title: "Fortalecer percepção premium",
    description: "Construir presença mais autoral e sofisticada para o lançamento da nova coleção.",
    planned_actions: "Sequência de reels de bastidores\nCarrossel manifesto\nCampanha de captação para showroom",
    responsible_user_id: null,
    responsible_name: "Dani",
    status: "in_progress",
    client_feedback: null,
    result_notes: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const seedMonthlyMetrics: MonthlyMetric[] = [
  {
    id: "metric-local-1",
    agency_id: "agency-local",
    client_id: "client-a",
    month: 5,
    year: 2026,
    instagram_followers: 12450,
    instagram_reach: 48200,
    instagram_impressions: 89300,
    instagram_link_clicks: 860,
    instagram_engagement: 3920,
    instagram_likes: 2140,
    instagram_comments: 280,
    instagram_saves: 740,
    instagram_shares: 510,
    instagram_reposts: 35,
    paid_investment: 1800,
    paid_reach: 64500,
    paid_impressions: 118000,
    paid_clicks: 1720,
    paid_leads: 84,
    status: "filling",
    client_feedback: null,
    created_by: "local-user",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const seedActivityHistory: ActivityHistory[] = [
  {
    id: "history-local-1",
    agency_id: "agency-local",
    client_id: "client-a",
    item_type: "campaign",
    item_id: "campaign-local-1",
    action: "created",
    user_id: "local-user",
    description: "Campanha criada pela agência.",
    created_at: new Date().toISOString()
  }
];

const seedTeamMembers: TeamMember[] = [
  {
    id: "member-local-1",
    agency_id: "agency-local",
    user_id: null,
    name: "Dani",
    email: "dani@revee.app",
    role_title: "Designer",
    avatar: null,
    access_code: "DAN-DEMO01",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "member-local-2",
    agency_id: "agency-local",
    user_id: null,
    name: "Gustavo",
    email: "gustavo@revee.app",
    role_title: "Copywriter",
    avatar: null,
    access_code: "GUS-DEMO02",
    status: "invited",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const standardRoleTitles = [
  "Gestor de tráfego",
  "Designer",
  "Copywriter",
  "Editor de vídeos"
];

function normalizeRoleTitle(roleTitle?: string | null) {
  if (!roleTitle) return "";
  if (roleTitle === "Design") return "Designer";
  return standardRoleTitles.includes(roleTitle) ? roleTitle : "";
}

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const defaultWorkspace: AgencyWorkspace = {
  name: "Revee Studio",
  description: "Central criativa para aprovar, organizar e apresentar conteúdos com clareza.",
  address: "",
  phone: "",
  instagram: "revee.studio",
  site: "",
  portfolio: "",
  avatar: "",
  avatarZoom: 1,
  avatarPositionX: 50,
  avatarPositionY: 50,
  banner: "/default-agency-cover.png",
  bannerPosition: 50,
  brandColor: "#170b43",
  toneOfVoice: "Elegante, direto e acolhedor.",
  palette: ["#170b43", "#b688d6", "#4CAF85", "#E8975A"],
  fonts: "Montserrat / Inter",
  notes: "Use este espaço para registrar combinados internos e diretrizes da marca.",
  links: "",
  references: ""
};

function workspaceFromSettings(settings: unknown, agencyName: string): AgencyWorkspace {
  const saved = settings && typeof settings === "object" ? settings as Partial<AgencyWorkspace> : {};
  const savedName = typeof saved.name === "string" ? saved.name.trim() : "";
  const resolvedName = savedName || agencyName || defaultWorkspace.name;
  const savedBanner = typeof saved.banner === "string" && !saved.banner.startsWith("blob:") ? saved.banner : "";
  const savedAvatar = typeof saved.avatar === "string" && !saved.avatar.startsWith("blob:") ? saved.avatar : "";
  return {
    ...defaultWorkspace,
    ...saved,
    name: resolvedName,
    banner: savedBanner || defaultWorkspace.banner,
    avatar: savedAvatar
  };
}

type LoadedAgency = {
  name?: string | null;
  billing_document?: string | null;
  workspace_settings?: unknown;
};

async function loadAgencyProfile(agencyId: string, token?: string | null): Promise<LoadedAgency | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("agencies")
    .select("name,billing_document,workspace_settings")
    .eq("id", agencyId)
    .maybeSingle();

  if (!error && data) return data as LoadedAgency;

  try {
    const response = await fetch("/api/agency/current", {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.agency ?? null;
  } catch {
    return null;
  }
}

// ─── Gera código de convite no formato ABC-XXXXXXXXXXXX ──────────────────────
function generateInviteCode(name: string) {
  const prefix = name.replace(/\s+/g, "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "CLT";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${prefix}-${suffix}`;
}

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeEmail(value: string) {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

function formatPhone(value: string) {
  const hasPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (!digits) return hasPlus ? "+" : "";
  if (!hasPlus && (digits.length === 10 || digits.length === 11)) {
    const area = digits.slice(0, 2);
    const first = digits.length > 10 ? digits.slice(2, 7) : digits.slice(2, 6);
    const last = digits.length > 10 ? digits.slice(7, 11) : digits.slice(6, 10);
    return `${area ? `(${area}` : ""}${area.length === 2 ? ")" : ""}${first ? ` ${first}` : ""}${last ? `-${last}` : ""}`;
  }
  return `${hasPlus ? "+" : ""}${digits.replace(/(\d{1,4})(?=\d)/g, "$1 ").trim()}`;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpfCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function isCpfOrCnpj(value: string) {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14;
}

const contentFormatLabels: Record<ContentFormat, string> = {
  static: "Post estático",
  carousel: "Carrossel",
  video: "Vídeo"
};

function getPostType(post: Post): ContentFormat {
  if (post.content_format) return post.content_format;
  if (post.media.some((item) => item.media_type === "video")) return "video";
  if (post.media.length > 1) return "carousel";
  return "static";
}

function getPostTypeLabel(post: Post) {
  const type = getPostType(post);
  if (type === "carousel") return post.media.length > 1 ? `${post.media.length} slides` : "Carrossel";
  return contentFormatLabels[type];
}

function getPostFormatBadge(post: Post) {
  const type = getPostType(post);
  if (type === "carousel") return "Carrossel";
  if (type === "video") return "Reels";
  return "Estático";
}

function campaignStage(status: CampaignStatus): PipelineColumnStage {
  if (status === "creating") return "needs_design";
  if (status === "awaiting_approval") return "waiting_client";
  if (status === "revision_requested") return "revision";
  if (status === "approved" || status === "paused") return "approved";
  if (status === "active") return "campaign_active";
  return "published";
}

function campaignMonthMatches(campaign: Campaign, month: string) {
  if (month === "all") return true;
  const starts = campaign.start_date?.startsWith(month);
  const ends = campaign.end_date?.startsWith(month);
  if (starts || ends) return true;
  if (!campaign.start_date || !campaign.end_date) return false;
  const monthStart = new Date(`${month}-01T00:00:00`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
  const start = new Date(`${campaign.start_date}T00:00:00`);
  const end = new Date(`${campaign.end_date}T23:59:59`);
  return start <= monthEnd && end >= monthStart;
}

function goalMonthKey(goal: MonthlyGoal) {
  return `${goal.year}-${String(goal.month).padStart(2, "0")}`;
}

function metricMonthKey(metric: MonthlyMetric) {
  return `${metric.year}-${String(metric.month).padStart(2, "0")}`;
}

function getCampaignPeriod(campaign: Campaign) {
  const start = formatDate(campaign.start_date);
  if (!campaign.end_date) return `${start} · sem data definida`;
  return `${start} ate ${formatDate(campaign.end_date)}`;
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrencyInput(value: string) {
  const amount = parseCurrencyInput(value);
  return amount ? formatCurrency(amount) : "";
}

function parseMetricNumber(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function metricValue(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function metricCurrency(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return formatCurrency(value);
}

function metricComparison(current?: number | null, previous?: number | null) {
  if (!current || !previous) return null;
  const change = ((current - previous) / previous) * 100;
  if (!Number.isFinite(change)) return null;
  return `${change > 0 ? "+" : ""}${change.toFixed(1).replace(".", ",")}%`;
}

function calculateCampaignTotal(startDate: string, endDate: string, dailyBudget: string) {
  const daily = parseCurrencyInput(dailyBudget);
  if (!startDate || !endDate || !daily) return "";
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (!Number.isFinite(diff) || diff <= 0) return "";
  return formatCurrency(diff * daily);
}

function defaultStageForStatus(status: ContentStatus): PipelineStage {
  if (status === "awaiting_approval") return "waiting_client";
  if (status === "revision_requested") return "revision";
  if (status === "approved") return "approved";
  if (status === "scheduled") return "scheduled";
  if (status === "published") return "published";
  return "needs_design";
}

function stageForPost(post: Post): PipelineStage {
  if (["awaiting_approval", "revision_requested", "approved", "scheduled", "published"].includes(post.status)) {
    return defaultStageForStatus(post.status);
  }
  return post.pipeline_stage;
}

function getMediaPreviewUrl(media?: PostMedia | null) {
  if (!media) return "";
  return media.media_type === "video" ? media.thumbnail_url || media.media_url : media.media_url;
}

function getUploadContentType(file: File) {
  const name = file.name.toLowerCase();
  if (file.type) return file.type;
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function isVideoUpload(file: File) {
  return file.type.startsWith("video") || /\.(mp4|m4v|mov|webm)$/i.test(file.name);
}

async function canPreviewVideoFile(file: File) {
  if (!isVideoUpload(file)) return true;
  if (typeof document === "undefined") return true;
  if (/\.(mov)$/i.test(file.name)) return false;

  const type = getUploadContentType(file);
  const video = document.createElement("video");
  if (!video.canPlayType(type) && !/\.(mp4|m4v|webm)$/i.test(file.name)) return false;

  const url = URL.createObjectURL(file);
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Tempo esgotado ao validar vídeo.")), 5000);
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Vídeo incompatível."));
      };
      video.load();
    });

    const targetTime = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.2, video.duration / 10) : 0;
    if (targetTime > 0) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Não foi possível ler o quadro do vídeo.")), 5000);
        video.onseeked = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        video.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error("Vídeo incompatível."));
        };
        video.currentTime = targetTime;
      });
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, video.videoWidth || 1);
    canvas.height = Math.max(1, video.videoHeight || 1);
    const context = canvas.getContext("2d");
    if (!context || !video.videoWidth || !video.videoHeight) return false;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function warnUnsupportedVideos(files: File[]) {
  const videos = files.filter(isVideoUpload);
  if (!videos.length) return false;
  const checks = await Promise.all(videos.map(async (file) => ({ file, supported: await canPreviewVideoFile(file) })));
  const unsupported = checks.filter((item) => !item.supported).map((item) => item.file);
  if (!unsupported.length) return false;
  window.alert(
    `Este vídeo pode não tocar na prévia do computador: ${unsupported.map((file) => file.name).join(", ")}.\n\n` +
    "Converta/exporte novamente como MP4 compatível: vídeo H.264, áudio AAC, sem HEVC/H.265 e sem HDR. No CapCut, procure exportar em MP4 compatível antes de enviar."
  );
  return true;
}

async function createVideoThumbnailFile(file: File) {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Tempo esgotado ao gerar capa.")), 7000);
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Não foi possível ler o vídeo."));
      };
    });

    video.currentTime = Math.min(0.2, Math.max(0, (video.duration || 1) / 10));
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1200);
      video.onseeked = () => {
        window.clearTimeout(timeout);
        resolve();
      };
    });

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1350;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "-capa.jpg"), { type: "image/jpeg" }) : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function composePostDateTime(date: string, time?: string | null) {
  const cleanDate = date || new Date().toISOString().slice(0, 10);
  const cleanTime = (time || "00:00").trim();
  const normalizedTime = cleanTime.split(":").slice(0, 3).join(":");
  const withSeconds = normalizedTime.split(":").length === 2 ? `${normalizedTime}:00` : normalizedTime || "00:00:00";
  return `${cleanDate}T${withSeconds}`;
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCompactTime(time?: string | null) {
  if (!time) return "--";
  const [hour, minute] = time.split(":");
  if (!hour) return "--";
  const cleanHour = String(Number(hour)).padStart(2, "0");
  if (!minute || minute === "00") return `${cleanHour}h`;
  return `${cleanHour}h${minute}`;
}

function getDueSignal(post: Post) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(composePostDateTime(post.scheduled_date, "00:00"));
  if (Number.isNaN(due.getTime())) return null;
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (["approved", "published"].includes(post.status)) return null;
  if (diff < 0) return { label: "Atrasado", tone: "danger" as const };
  if (diff <= 2) return { label: diff === 0 ? "Hoje" : "Prazo prox.", tone: "near" as const };
  return null;
}

function relativeTimeFrom(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  return `há ${days}d`;
}

async function cropAvatarFile(file: File, zoom: number) {
  const imageUrl = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });
  const canvas = document.createElement("canvas");
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return file;
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  URL.revokeObjectURL(imageUrl);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file;
}

function createLocalSubscription(agencyId: string, seed: string): Subscription {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 7);
  return {
    id: `local-subscription-${agencyId}`,
    agency_id: agencyId,
    plan: "studio",
    billing_cycle: "monthly",
    status: "trial",
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    trial_ends_at: periodEnd.toISOString(),
    payment_method: "Não informado",
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

function hasActivatedBilling(subscription?: Subscription | null) {
  if (!subscription) return false;
  if (subscription.status === "exempt") return true;
  if (subscription.status === "trial" && subscription.trial_ends_at) {
    const trialEndsAt = new Date(subscription.trial_ends_at).getTime();
    return !Number.isNaN(trialEndsAt) && trialEndsAt > Date.now();
  }
  return Boolean(subscription.asaas_subscription_id);
}

export function ReveeApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [monthlyMetrics, setMonthlyMetrics] = useState<MonthlyMetric[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityHistory[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [activeClientId, setActiveClientId] = useState(seedClients[0]?.id ?? "");
  const [view, setView] = useState<View>("calendar");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [toast, setToast] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<MonthlyGoal | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [postFormOpen, setPostFormOpen] = useState(false);
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [metricsFormOpen, setMetricsFormOpen] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<Campaign | null>(null);
  const [goalToEdit, setGoalToEdit] = useState<MonthlyGoal | null>(null);
  const [newPostDate, setNewPostDate] = useState(new Date().toISOString().slice(0, 10));
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [pendingDeletePostId, setPendingDeletePostId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState("Revee Studio");
  const [agencyBillingDocument, setAgencyBillingDocument] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState<AgencyWorkspace>(defaultWorkspace);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [agencyProfileOpen, setAgencyProfileOpen] = useState(false);
  const [memberProfileOpen, setMemberProfileOpen] = useState(false);
  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void loadWorkspace(data.session.user.id, { showLoader: true });
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        const nextUserId = nextSession.user.id;
        if (loadedUserIdRef.current !== nextUserId) {
          void loadWorkspace(nextUserId, { showLoader: true });
        } else {
          setLoading(false);
        }
      }
      else {
        loadedUserIdRef.current = null;
        setProfile(null);
        setAgencyBillingDocument("");
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("revee-theme");
      const savedDismissedNotifications = window.localStorage.getItem("revee-dismissed-notifications");
      if (savedTheme === "dark") setDarkMode(true);
      if (savedDismissedNotifications) setDismissedNotificationIds(JSON.parse(savedDismissedNotifications));
    } catch {
      // Local preferences are optional; ignore invalid stored values.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("revee-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem("revee-dismissed-notifications", JSON.stringify(dismissedNotificationIds));
  }, [dismissedNotificationIds]);

  async function loadWorkspace(userId: string, options: { showLoader?: boolean } = {}) {
    if (!supabase) return;
    if (options.showLoader || loadedUserIdRef.current !== userId) setLoading(true);
    const { data: userRow } = await supabase.from("users").select("*").eq("id", userId).single();
    let user = userRow as Profile | null;

    if (!user) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const fallback: Profile = {
          id: authData.user.id,
          name: authData.user.user_metadata?.name ?? authData.user.email ?? "Usuário",
          email: authData.user.email ?? "",
          role: authData.user.user_metadata?.role ?? "agency",
          avatar: null,
          profile_banner: null,
          profile_description: null,
          profile_banner_position: 50,
          agency_id: authData.user.user_metadata?.agency_id ?? null,
          client_id: authData.user.user_metadata?.client_id ?? null
        };
        await supabase.from("users").upsert({
          id: fallback.id,
          name: fallback.name,
          email: fallback.email,
          role: fallback.role,
          avatar: null,
          agency_id: fallback.agency_id,
          client_id: fallback.client_id
        });
        user = fallback;
      } else {
        setLoading(false);
        return;
      }
    }

    if (user.role === "agency" && !user.agency_id) {
      const { data: ownedAgency } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("owner_id", user.id)
        .maybeSingle();
      let agencyId = ownedAgency?.id ?? null;

      if (!agencyId) {
        const { data: createdAgency } = await supabase
          .from("agencies")
          .insert({
            name: user.name || "Minha agência",
            owner_id: user.id
          })
          .select("id, name")
          .single();
        agencyId = createdAgency?.id ?? null;
      }

      if (agencyId) {
        await supabase.from("users").update({ agency_id: agencyId }).eq("id", user.id);
        user = { ...user, agency_id: agencyId };
      }
    }

    if (user.role === "client") {
      const { data: clientAuthSession } = await supabase.auth.getSession();
      try {
        const response = await fetch("/api/client/sync-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(clientAuthSession.session?.access_token ? { Authorization: `Bearer ${clientAuthSession.session.access_token}` } : {})
          }
        });
        if (response.ok) {
          const payload = await response.json();
          if (payload?.profile) user = payload.profile as Profile;
        }
      } catch {
        // If the repair endpoint is unavailable, keep the current client link.
      }
    }

    const nextProfile: Profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      profile_banner: user.profile_banner,
      profile_description: user.profile_description,
      profile_banner_position: user.profile_banner_position,
      agency_id: user.agency_id,
      client_id: user.client_id
    };
    setProfile(nextProfile);

    const { data: currentAuthSession } = await supabase.auth.getSession();
    const currentAccessToken = currentAuthSession.session?.access_token ?? null;
    let agencyDisplayName = nextProfile.name;
    if (nextProfile.agency_id) {
      const agency = await loadAgencyProfile(nextProfile.agency_id, currentAccessToken);
      agencyDisplayName = agency?.name ?? nextProfile.name;
      setAgencyBillingDocument(agency?.billing_document ? formatCpfCnpj(agency.billing_document) : "");
      let nextWorkspace = workspaceFromSettings(agency?.workspace_settings, agencyDisplayName);
      if (!agency?.workspace_settings) {
        try {
          const localWorkspace = window.localStorage.getItem(`revee-workspace-${nextProfile.agency_id}`);
          if (nextProfile.role === "agency" && localWorkspace) nextWorkspace = workspaceFromSettings(JSON.parse(localWorkspace), agencyDisplayName);
        } catch {
          nextWorkspace = workspaceFromSettings(null, agencyDisplayName);
        }
      }
      setWorkspace(nextWorkspace);
      agencyDisplayName = nextWorkspace.name;
      if (nextProfile.role === "agency" && !agency?.workspace_settings && nextWorkspace !== defaultWorkspace) {
        void supabase.from("agencies").update({ workspace_settings: nextWorkspace }).eq("id", nextProfile.agency_id);
      }
    }
    setAgencyName(agencyDisplayName);

    const clientQuery = nextProfile.role !== "client"
      ? supabase.from("clients").select("*").eq("agency_id", nextProfile.agency_id!)
      : supabase.from("clients").select("*").eq("id", nextProfile.client_id!);

    const { data: clientRows } = await clientQuery.order("created_at", { ascending: true });
    const loadedClients = (clientRows ?? []) as Client[];
    setClients(loadedClients);
    setActiveClientId((current) =>
      loadedClients.some((client) => client.id === current) ? current : loadedClients[0]?.id || ""
    );

    const clientIds = loadedClients.map((client) => client.id);
    if (clientIds.length) {
      const { data: postRows } = await supabase
        .from("posts")
        .select("*, post_media(*)")
        .in("client_id", clientIds)
        .order("scheduled_date", { ascending: true });
      const loadedPosts = (postRows ?? []).map((post: any) => ({
        ...post,
        media: (post.post_media ?? []).sort((a: PostMedia, b: PostMedia) => a.order_index - b.order_index)
      })) as Post[];
      setPosts(loadedPosts);

      const { data: commentRows } = await supabase.from("comments").select("*, users(name)").in("post_id", loadedPosts.map((post) => post.id));
      setComments(
        (commentRows ?? []).map((comment: any) => ({
          id: comment.id,
          post_id: comment.post_id,
          user_id: comment.user_id,
          user_name: comment.users?.name ?? "Usuário",
          content: comment.content,
          created_at: comment.created_at
        }))
      );

      const { data: campaignRows } = await supabase
        .from("campaigns")
        .select("*, campaign_media(*)")
        .in("client_id", clientIds)
        .order("start_date", { ascending: true });
      setCampaigns(
        (campaignRows ?? []).map((campaign: any) => ({
          ...campaign,
          media: (campaign.campaign_media ?? []).sort((a: CampaignMedia, b: CampaignMedia) => a.order_index - b.order_index)
        })) as Campaign[]
      );

      const { data: goalRows } = await supabase
        .from("monthly_goals")
        .select("*")
        .in("client_id", clientIds)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      setMonthlyGoals((goalRows ?? []) as MonthlyGoal[]);

      const { data: metricRows } = await supabase
        .from("monthly_metrics")
        .select("*")
        .in("client_id", clientIds)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      setMonthlyMetrics((metricRows ?? []) as MonthlyMetric[]);

      const { data: historyRows } = await supabase
        .from("activity_history")
        .select("*")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false })
        .limit(120);
      setActivityHistory((historyRows ?? []) as ActivityHistory[]);
    } else {
      setPosts([]);
      setComments([]);
      setCampaigns([]);
      setMonthlyGoals([]);
      setMonthlyMetrics([]);
      setActivityHistory([]);
    }

    if (nextProfile.role !== "client" && nextProfile.agency_id) {
      const { data: memberRows } = await supabase
        .from("team_members")
        .select("*")
        .eq("agency_id", nextProfile.agency_id)
        .order("created_at", { ascending: true });
      setTeamMembers((memberRows ?? []) as TeamMember[]);

      const { data: subscriptionRow } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("agency_id", nextProfile.agency_id)
        .maybeSingle();
      let activeSubscription = subscriptionRow as Subscription | null;
      if (nextProfile.role === "agency") {
        try {
          const { data: authSession } = await supabase.auth.getSession();
          const response = await fetch("/api/billing/sync-exemption", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(authSession.session?.access_token ? { Authorization: `Bearer ${authSession.session.access_token}` } : {})
            },
            body: JSON.stringify({ agencyId: nextProfile.agency_id, email: nextProfile.email })
          });
          if (response.ok) {
            const exemptionSync = await response.json();
            if (exemptionSync?.subscription) activeSubscription = exemptionSync.subscription as Subscription;
          }
        } catch {
          // Exempt accounts are a convenience check; keep the normal subscription if the sync is unavailable.
        }
      }
      setSubscription(activeSubscription ?? createLocalSubscription(nextProfile.agency_id, agencyDisplayName));

      const { data: billingRows } = await supabase
        .from("billing_history")
        .select("*")
        .eq("agency_id", nextProfile.agency_id)
        .order("created_at", { ascending: false });
      setBillingHistory((billingRows ?? []) as BillingHistory[]);

      const { data: referralRows } = await supabase
        .from("referrals")
        .select("*")
        .eq("agency_id", nextProfile.agency_id)
        .order("created_at", { ascending: false });
      setReferrals((referralRows ?? []) as Referral[]);
    } else {
      setTeamMembers([]);
      setSubscription(null);
      setBillingHistory([]);
      setReferrals([]);
    }
    loadedUserIdRef.current = userId;
    setLoading(false);
  }

  const activeClient = clients.find((client) => client.id === activeClientId) ?? clients[0] ?? null;
  const isClientUser = profile?.role === "client";
  const isAgencyUser = profile?.role === "agency";
  const isMemberUser = profile?.role === "member";
  const canCreateContent = isAgencyUser || isMemberUser;
  const availableViews = useMemo(
    () => views.filter((item) => {
      if (isClientUser) return !item.agencyOnly;
      if (isMemberUser) return item.id !== "clients" && item.id !== "team";
      return true;
    }),
    [isClientUser, isMemberUser]
  );
  const primaryViews = useMemo(
    () => availableViews.filter((item) => item.id !== "clients" && item.id !== "team"),
    [availableViews]
  );
  const responsibleOptions = useMemo<ResponsibleOption[]>(() => {
    const options: ResponsibleOption[] = [];
    if (profile && profile.role !== "client") {
      options.push({
        key: profile.id,
        userId: profile.id,
        name: profile.name || agencyName,
        role: profile.role === "agency" ? "Proprietária" : "Você"
      });
    }
    teamMembers
      .filter((member) => member.status !== "inactive")
      .forEach((member) => {
        const key = member.user_id || `member:${member.id}`;
        if (options.some((option) => option.key === key || (member.user_id && option.userId === member.user_id))) return;
        options.push({
          key,
          userId: member.user_id ?? null,
          name: member.name,
          role: member.role_title || "Colaborador"
        });
      });
    return options;
  }, [agencyName, profile, teamMembers]);
  const canAccessView = useCallback(
    (nextView: View) => {
      if (nextView === "billing") return isAgencyUser;
      if (nextView === "workspace") return isAgencyUser;
      return availableViews.some((item) => item.id === nextView);
    },
    [availableViews, isAgencyUser]
  );

  useEffect(() => {
    if (!canAccessView(view)) setView("calendar");
  }, [canAccessView, view]);

  function changeView(nextView: View) {
    setView(canAccessView(nextView) ? nextView : "calendar");
  }

  function openNewPost(date?: string) {
    setNewPostDate(date || new Date().toISOString().slice(0, 10));
    setPostFormOpen(true);
  }

  function openNotification(item: NotificationItem) {
    if (item.metricId || item.monthKey) {
      if (item.clientId) setActiveClientId(item.clientId);
      if (item.monthKey) setMonthFilter(item.monthKey);
      setView("metrics");
      return;
    }
    if (item.campaignId) {
      const target = campaigns.find((campaign) => campaign.id === item.campaignId);
      if (!target) return;
      setActiveClientId(target.client_id);
      setSelectedCampaign(target);
      return;
    }
    if (item.goalId) {
      const target = monthlyGoals.find((goal) => goal.id === item.goalId);
      if (!target) return;
      setActiveClientId(target.client_id);
      setSelectedGoal(target);
      return;
    }
    if (!item.postId) return;
    const target = posts.find((post) => post.id === item.postId);
    if (!target) return;
    setActiveClientId(target.client_id);
    setSelectedPost(target);
  }

  const scopedPosts = useMemo(() => {
    const commentsByPost = new Map<string, string>();
    const clientById = new Map(clients.map((client) => [client.id, client.name]));
    comments.forEach((comment) => {
      commentsByPost.set(comment.post_id, `${commentsByPost.get(comment.post_id) ?? ""} ${comment.content}`);
    });
    const base = posts
      .filter((post) => post.client_id === activeClient?.id)
      .sort((a, b) => a.feed_order - b.feed_order || a.scheduled_date.localeCompare(b.scheduled_date));
    const filtered = base.filter((post) => {
      const mediaTypes = post.media.map((item) => item.media_type).join(" ");
      const postType = getPostType(post);
      const hashtags = `${post.caption ?? ""} ${post.instructions ?? ""}`.match(/#[\p{L}\p{N}_]+/gu)?.join(" ") ?? "";
      const haystack = `${post.title} ${post.caption ?? ""} ${post.instructions ?? ""} ${clientById.get(post.client_id) ?? ""} ${hashtags} ${statusMeta[post.status].label} ${post.status} ${pipelineMeta[post.pipeline_stage].label} ${post.scheduled_date} ${commentsByPost.get(post.id) ?? ""} ${mediaTypes} ${postType}`.toLowerCase();
      const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || post.status === statusFilter;
      const matchesType = typeFilter === "all" || postType === typeFilter;
      const matchesMonth = monthFilter === "all" || post.scheduled_date.startsWith(monthFilter);
      return matchesQuery && matchesStatus && matchesType && matchesMonth;
    });
    if (!query.trim() && statusFilter === "all" && typeFilter === "all" && monthFilter === "all") return base;
    return filtered;
  }, [activeClient?.id, clients, comments, monthFilter, posts, query, statusFilter, typeFilter]);

  const scopedCampaigns = useMemo(() => {
    const clientById = new Map(clients.map((client) => [client.id, client.name]));
    return campaigns
      .filter((campaign) => campaign.client_id === activeClient?.id)
      .filter((campaign) => {
        const haystack = `${campaign.title} ${campaign.objective ?? ""} ${campaign.platform} ${campaign.audience ?? ""} ${campaign.copy ?? ""} ${campaignStatusMeta[campaign.status]?.label ?? campaign.status} ${clientById.get(campaign.client_id) ?? ""}`.toLowerCase();
        const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase());
        return matchesQuery && campaignMonthMatches(campaign, monthFilter);
      })
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [activeClient?.id, campaigns, clients, monthFilter, query]);

  const scopedGoals = useMemo(() => {
    return monthlyGoals
      .filter((goal) => goal.client_id === activeClient?.id)
      .filter((goal) => {
        const haystack = `${goal.title} ${goal.description ?? ""} ${goal.planned_actions ?? ""} ${monthlyGoalStatusMeta[goal.status].label}`.toLowerCase();
        const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase());
        const matchesMonth = monthFilter === "all" || goalMonthKey(goal) === monthFilter;
        return matchesQuery && matchesMonth;
      })
      .sort((a, b) => goalMonthKey(b).localeCompare(goalMonthKey(a)));
  }, [activeClient?.id, monthFilter, monthlyGoals, query]);

  const scopedMetrics = useMemo(() => {
    return monthlyMetrics
      .filter((metric) => metric.client_id === activeClient?.id)
      .filter((metric) => monthFilter === "all" || metricMonthKey(metric) === monthFilter)
      .sort((a, b) => metricMonthKey(b).localeCompare(metricMonthKey(a)));
  }, [activeClient?.id, monthFilter, monthlyMetrics]);

  const currentMetric = scopedMetrics[0] ?? null;
  const previousMetric = useMemo(() => {
    if (!activeClient?.id || monthFilter === "all") return null;
    const [year, month] = monthFilter.split("-").map(Number);
    const previousDate = new Date(year, month - 2, 1);
    const previousKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    return monthlyMetrics.find((metric) => metric.client_id === activeClient.id && metricMonthKey(metric) === previousKey) ?? null;
  }, [activeClient?.id, monthFilter, monthlyMetrics]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    posts.filter((post) => post.client_id === activeClient?.id).forEach((post) => months.add(post.scheduled_date.slice(0, 7)));
    campaigns.filter((campaign) => campaign.client_id === activeClient?.id).forEach((campaign) => {
      if (campaign.start_date) months.add(campaign.start_date.slice(0, 7));
      if (campaign.end_date) months.add(campaign.end_date.slice(0, 7));
    });
    monthlyGoals.filter((goal) => goal.client_id === activeClient?.id).forEach((goal) => months.add(goalMonthKey(goal)));
    monthlyMetrics.filter((metric) => metric.client_id === activeClient?.id).forEach((metric) => months.add(metricMonthKey(metric)));
    months.add(new Date().toISOString().slice(0, 7));
    return Array.from(months).sort();
  }, [activeClient?.id, campaigns, monthlyGoals, monthlyMetrics, posts]);

  const stats = useMemo(() => {
    const totalPosts = scopedPosts.length;
    const totalCampaigns = scopedCampaigns.length;
    const contentAwaiting = scopedPosts.filter((post) => post.status === "awaiting_approval").length;
    const contentRevision = scopedPosts.filter((post) => post.status === "revision_requested").length;
    const activeCampaigns = scopedCampaigns.filter((campaign) => campaign.status === "active").length;
    const campaignAwaiting = scopedCampaigns.filter((campaign) => campaign.status === "awaiting_approval").length;
    const campaignRevision = scopedCampaigns.filter((campaign) => campaign.status === "revision_requested").length;
    return { totalPosts, totalCampaigns, contentAwaiting, contentRevision, activeCampaigns, campaignAwaiting, campaignRevision };
  }, [scopedCampaigns, scopedPosts]);

  const allNotifications = useMemo<NotificationItem[]>(() => {
    const byClient = new Map(clients.map((client) => [client.id, client.name]));
    const byPost = new Map(posts.map((post) => [post.id, post]));
    const latestRevisionCommentByPost = new Map<string, Comment>();
    posts.forEach((post) => {
      if (post.status !== "revision_requested") return;
      const revisionComment = comments
        .filter((comment) => comment.post_id === post.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (revisionComment) latestRevisionCommentByPost.set(post.id, revisionComment);
    });
    const postNotices = posts.flatMap((post) => {
      const clientName = byClient.get(post.client_id) ?? "Cliente";
      const notices: NotificationItem[] = [];
      const scheduledAt = composePostDateTime(post.scheduled_date, post.scheduled_time);
      const approvedAt = post.approved_at ?? post.updated_at ?? post.created_at;
      const revisionAt = post.revision_requested_at ?? comments.filter((comment) => comment.post_id === post.id).at(-1)?.created_at ?? post.updated_at ?? post.created_at;
      const submittedAt = post.submitted_at ?? post.created_at;
      const programmedAt = post.scheduled_at ?? scheduledAt;
      if (post.status === "approved") {
        notices.push({
          id: `approved-${post.id}`,
          title: isClientUser ? `${agencyName} recebeu aprovação` : `${clientName} aprovou o post`,
          detail: post.title,
          time: formatTimelineDate(approvedAt),
          postId: post.id,
          createdAt: approvedAt
        });
      }
      if (post.status === "revision_requested") {
        const revisionComment = latestRevisionCommentByPost.get(post.id);
        notices.push({
          id: `revision-${post.id}`,
          title: isClientUser ? `${agencyName} recebeu pedido de revisão` : `${clientName} solicitou revisão`,
          detail: revisionComment ? `${post.title}: ${revisionComment.content}` : post.title,
          time: formatTimelineDate(revisionAt),
          postId: post.id,
          createdAt: revisionAt
        });
      }
      if (post.status === "scheduled") {
        notices.push({
          id: `scheduled-${post.id}`,
          title: `${agencyName} programou um post`,
          detail: post.title,
          time: formatTimelineDate(programmedAt),
          postId: post.id,
          createdAt: programmedAt
        });
      }
      if (isClientUser && post.status === "awaiting_approval") {
        notices.push({
          id: `awaiting-${post.id}`,
          title: `${agencyName} adicionou um post para aprovação`,
          detail: post.title,
          time: formatTimelineDate(submittedAt),
          postId: post.id,
          createdAt: submittedAt
        });
      }
      return notices;
    });
    const commentNotices: NotificationItem[] = [];
    comments.forEach((item) => {
      const post = byPost.get(item.post_id);
      const clientName = post ? byClient.get(post.client_id) ?? item.user_name : item.user_name;
      const revisionComment = post ? latestRevisionCommentByPost.get(post.id) : null;
      if (revisionComment?.id === item.id) return;
      commentNotices.push({
        id: `comment-${item.id}`,
        title: isClientUser ? `${agencyName} atualizou um conteúdo` : `${clientName} deixou feedback`,
        detail: post ? `${post.title}: ${item.content}` : item.content,
        time: formatTimelineDate(item.created_at),
        postId: post?.id,
        createdAt: item.created_at
      });
    });
    const billingNotices: NotificationItem[] = [];
    if (isAgencyUser && subscription?.status === "past_due") {
      const daysLeft = getPastDueDaysLeft(subscription) ?? 5;
      billingNotices.push({
        id: `billing-past-due-${subscription.id}-${subscription.past_due_since ?? ""}`,
        title: "Pagamento atrasado",
        detail: `Regularize sua assinatura. Seu acesso será suspenso em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}.`,
        time: formatTimelineDate(subscription.past_due_since ?? new Date().toISOString()),
        createdAt: subscription.past_due_since ?? new Date().toISOString()
      });
    }
    if (isAgencyUser && subscription?.status === "suspended") {
      billingNotices.push({
        id: `billing-suspended-${subscription.id}-${subscription.suspended_at ?? ""}`,
        title: "Assinatura suspensa",
        detail: "Regularize o pagamento para liberar o acesso automaticamente.",
        time: formatTimelineDate(subscription.suspended_at ?? new Date().toISOString()),
        createdAt: subscription.suspended_at ?? new Date().toISOString()
      });
    }
    billingHistory.filter((item) => item.status === "confirmed" || item.status === "received").slice(0, 3).forEach((item) => {
      billingNotices.push({
        id: `billing-paid-${item.id}`,
        title: "Pagamento confirmado",
        detail: `${formatCurrency(item.amount)} confirmado para sua assinatura.`,
        time: formatTimelineDate(item.paid_at ?? item.created_at),
        createdAt: item.paid_at ?? item.created_at
      });
    });
    referrals.slice(0, 4).forEach((item) => {
      if (item.status === "pending" || item.status === "active") {
        billingNotices.push({
          id: `referral-${item.id}-${item.status}`,
          title: item.status === "active" ? "Indicação ativa" : "Nova indicação cadastrada",
          detail: item.status === "active" ? "Seu desconto por indicação já pode entrar na próxima cobrança." : "Uma agência entrou pelo seu link de indicação.",
          time: formatTimelineDate(item.converted_at ?? item.created_at),
          createdAt: item.converted_at ?? item.created_at
        });
      }
    });

    const campaignNotices: NotificationItem[] = campaigns.flatMap((campaign) => {
      const clientName = byClient.get(campaign.client_id) ?? "Cliente";
      const updatedAt = campaign.updated_at ?? campaign.created_at;
      const notices: NotificationItem[] = [];
      if (!isClientUser && campaign.responsible_user_id && campaign.responsible_user_id === profile?.id) {
        notices.push({
          id: `campaign-assigned-${campaign.id}-${campaign.responsible_user_id}`,
          title: "Você foi definido como responsável",
          detail: `Campanha: ${campaign.title}`,
          time: formatTimelineDate(updatedAt),
          campaignId: campaign.id,
          createdAt: updatedAt
        });
      }
      if (campaign.status === "awaiting_approval" && isClientUser) {
        return [...notices, {
          id: `campaign-awaiting-${campaign.id}`,
          title: `${agencyName} enviou uma campanha para aprovação`,
          detail: campaign.title,
          time: formatTimelineDate(updatedAt),
          campaignId: campaign.id,
          createdAt: updatedAt
        }];
      }
      if (campaign.status === "approved" && !isClientUser) {
        return [...notices, {
          id: `campaign-approved-${campaign.id}`,
          title: `${clientName} aprovou a campanha`,
          detail: campaign.title,
          time: formatTimelineDate(updatedAt),
          campaignId: campaign.id,
          createdAt: updatedAt
        }];
      }
      if (campaign.status === "revision_requested" && !isClientUser) {
        return [...notices, {
          id: `campaign-revision-${campaign.id}`,
          title: `${clientName} solicitou revisão na campanha`,
          detail: campaign.client_feedback || campaign.title,
          time: formatTimelineDate(updatedAt),
          campaignId: campaign.id,
          createdAt: updatedAt
        }];
      }
      if (campaign.status === "active") {
        return [...notices, {
          id: `campaign-active-${campaign.id}`,
          title: "Campanha marcada como ativa",
          detail: campaign.title,
          time: formatTimelineDate(updatedAt),
          campaignId: campaign.id,
          createdAt: updatedAt
        }];
      }
      return notices;
    });

    const goalNotices: NotificationItem[] = monthlyGoals.flatMap((goal) => {
      const clientName = byClient.get(goal.client_id) ?? "Cliente";
      const updatedAt = goal.updated_at ?? goal.created_at;
      const notices: NotificationItem[] = [];
      if (!isClientUser && goal.responsible_user_id && goal.responsible_user_id === profile?.id) {
        notices.push({
          id: `goal-assigned-${goal.id}-${goal.responsible_user_id}`,
          title: "Você foi definido como responsável",
          detail: `Objetivo do mês: ${goal.title}`,
          time: formatTimelineDate(updatedAt),
          goalId: goal.id,
          createdAt: updatedAt
        });
      }
      if (isClientUser && goal.status === "planned") {
        return [...notices, {
          id: `goal-planned-${goal.id}`,
          title: `${agencyName} adicionou objetivos para o mês`,
          detail: goal.title,
          time: formatTimelineDate(updatedAt),
          goalId: goal.id,
          createdAt: updatedAt
        }];
      }
      if (!isClientUser && goal.client_feedback) {
        return [...notices, {
          id: `goal-feedback-${goal.id}`,
          title: `${clientName} deixou feedback nos objetivos do mês`,
          detail: goal.client_feedback,
          time: formatTimelineDate(updatedAt),
          goalId: goal.id,
          createdAt: updatedAt
        }];
      }
      return notices;
    });

    const metricNotices: NotificationItem[] = monthlyMetrics.flatMap((metric) => {
      const clientName = byClient.get(metric.client_id) ?? "Cliente";
      const updatedAt = metric.updated_at ?? metric.created_at;
      const metricMonth = `${months[metric.month - 1]} ${metric.year}`;
      const notices: NotificationItem[] = [];
      if (isClientUser && metric.status === "sent_to_client") {
        notices.push({
          id: `metric-sent-${metric.id}`,
          title: `${agencyName} enviou as métricas de ${metricMonth}`,
          detail: "Relatório mensal disponível para visualizar.",
          time: formatTimelineDate(updatedAt),
          metricId: metric.id,
          clientId: metric.client_id,
          monthKey: metricMonthKey(metric),
          createdAt: updatedAt
        });
      } else if (isClientUser && metric.updated_at && metric.updated_at !== metric.created_at) {
        notices.push({
          id: `metric-updated-${metric.id}-${metric.updated_at}`,
          title: `${agencyName} atualizou o relatório de métricas`,
          detail: metricMonth,
          time: formatTimelineDate(updatedAt),
          metricId: metric.id,
          clientId: metric.client_id,
          monthKey: metricMonthKey(metric),
          createdAt: updatedAt
        });
      }
      if (!isClientUser && metric.client_feedback) {
        notices.push({
          id: `metric-feedback-${metric.id}-${metric.updated_at ?? ""}`,
          title: `${clientName} deixou feedback no relatório de métricas`,
          detail: metric.client_feedback,
          time: formatTimelineDate(updatedAt),
          metricId: metric.id,
          clientId: metric.client_id,
          monthKey: metricMonthKey(metric),
          createdAt: updatedAt
        });
      }
      if (!isClientUser && metric.status === "reviewed") {
        notices.push({
          id: `metric-reviewed-${metric.id}`,
          title: `${clientName} revisou as métricas`,
          detail: metricMonth,
          time: formatTimelineDate(updatedAt),
          metricId: metric.id,
          clientId: metric.client_id,
          monthKey: metricMonthKey(metric),
          createdAt: updatedAt
        });
      }
      return notices;
    });

    return [...billingNotices, ...metricNotices, ...goalNotices, ...campaignNotices, ...commentNotices, ...postNotices]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 16);
  }, [agencyName, billingHistory, campaigns, clients, comments, isAgencyUser, isClientUser, monthlyGoals, monthlyMetrics, posts, profile?.id, profile?.name, referrals, subscription]);

  const notifications = useMemo(
    () => allNotifications.filter((item) => !dismissedNotificationIds.includes(item.id)),
    [allNotifications, dismissedNotificationIds]
  );

  function clearNotifications() {
    setDismissedNotificationIds((current) => Array.from(new Set([...current, ...allNotifications.map((item) => item.id)])));
    notify("Notificações limpas");
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  const saveWorkspace = useCallback((nextWorkspace: AgencyWorkspace) => {
    const agencyScopedWorkspace = { ...nextWorkspace, name: nextWorkspace.name.trim() || agencyName };
    setWorkspace(agencyScopedWorkspace);
    if (agencyScopedWorkspace.name !== agencyName) setAgencyName(agencyScopedWorkspace.name);
    if (profile?.agency_id) {
      window.localStorage.setItem(`revee-workspace-${profile.agency_id}`, JSON.stringify(agencyScopedWorkspace));
      supabase?.from("agencies").update({
        name: agencyScopedWorkspace.name,
        workspace_settings: agencyScopedWorkspace
      }).eq("id", profile.agency_id).then(({ error }) => {
        if (!error) return;
        fetch("/api/agency/workspace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify({
            agencyId: profile.agency_id,
            workspace: agencyScopedWorkspace
          })
        }).then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            notify(data?.error ?? error.message);
          }
        }).catch(() => notify(error.message));
      });
    }
  }, [agencyName, profile?.agency_id, session?.access_token]);

  async function saveOwnProfile(input: { name: string; avatar_file?: File | null; banner_file?: File | null; profile_description?: string; profile_banner_position?: number | null }) {
    if (!profile) return;
    const avatar = input.avatar_file ? await uploadProfileImage(input.avatar_file, "profiles") : undefined;
    const banner = input.banner_file ? await uploadProfileImage(input.banner_file, "profiles") : undefined;
    const patch: Partial<Profile> = {
      name: input.name,
      ...(avatar ? { avatar } : {}),
      ...(banner ? { profile_banner: banner } : {}),
      ...(input.profile_description !== undefined ? { profile_description: input.profile_description } : {}),
      ...(input.profile_banner_position !== undefined ? { profile_banner_position: input.profile_banner_position } : {})
    };

    if (supabase) {
      const { error } = await supabase.from("users").update(patch).eq("id", profile.id);
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }

      if (profile.role === "member") {
        await supabase
          .from("team_members")
          .update({
            name: input.name,
            ...(avatar ? { avatar } : {}),
            updated_at: new Date().toISOString()
          })
          .eq("user_id", profile.id);
      }
    }

    setProfile((current) => current ? { ...current, ...patch } : current);
    if (profile.role === "member") {
      setTeamMembers((current) => current.map((member) => member.user_id === profile.id ? {
        ...member,
        name: input.name,
        ...(avatar ? { avatar } : {})
      } : member));
    }
    notify("Perfil atualizado");
  }

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setClients([]);
    setPosts([]);
    setComments([]);
    setCampaigns([]);
    setMonthlyGoals([]);
    setActivityHistory([]);
    setTeamMembers([]);
    setAgencyName("Revee Studio");
    setWorkspace(defaultWorkspace);
    setAgencyBillingDocument("");
  }

  if (loading) return <FullScreenLoader />;
  if (session && !profile) return <FullScreenLoader />;

  if (!profile && !session) {
    return (
      <AuthPanel
        mode={authMode}
        setMode={setAuthMode}
        onLocalAccess={() => {
          setProfile({
            id: "local-user",
            name: "Agência",
            email: "local@revee.app",
            role: "agency",
            avatar: null,
            agency_id: "agency-local",
            client_id: null
          });
          setClients(seedClients);
          setPosts(seedPosts);
          setCampaigns(seedCampaigns);
          setMonthlyGoals(seedMonthlyGoals);
          setMonthlyMetrics(seedMonthlyMetrics);
          setActivityHistory(seedActivityHistory);
          setTeamMembers(seedTeamMembers);
          setSubscription(createLocalSubscription("agency-local", "Revee Studio"));
          setBillingHistory([
            {
              id: "billing-local-1",
              agency_id: "agency-local",
              subscription_id: "local-subscription-agency-local",
              amount: 49.9,
              status: "pending",
              due_date: "2026-05-25",
              invoice_url: "#",
              payment_method: "Boleto/Pix",
              created_at: new Date().toISOString()
            }
          ]);
          setReferrals([
            {
              id: "referral-local",
              agency_id: "agency-local",
              referral_code: generateReferralCode("Revee Studio"),
              discount_percent: 10,
              status: "pending",
              created_at: new Date().toISOString()
            }
          ]);
          setActiveClientId(seedClients[0].id);
          setAgencyName("Revee Studio");
        }}
      />
    );
  }

  if (isAgencyUser && !hasActivatedBilling(subscription)) {
    return (
      <TrialActivationGate
        agencyName={agencyName}
        subscription={subscription}
        onActivate={(plan, billingCycle) => billingAction("activate_trial", { plan, billingCycle })}
        onLogout={handleLogout}
      />
    );
  }

  const heroWorkspace: AgencyWorkspace = profile?.role === "member" ? {
    ...workspace,
    name: profile.name || agencyName,
    description: profile.profile_description || workspace.description,
    avatar: profile.avatar || workspace.avatar,
    banner: profile.profile_banner || workspace.banner,
    bannerPosition: profile.profile_banner_position ?? workspace.bannerPosition
  } : {
    ...workspace,
    name: agencyName
  };

  return (
    <div
      className="min-h-screen bg-canvas text-ink transition-colors duration-300"
      data-theme={darkMode ? "dark" : "light"}
      style={{ "--workspace-color": workspace.brandColor } as CSSProperties}
    >
      <div className="flex min-h-[100svh]">

        <Sidebar
          profile={profile}
          agencyName={agencyName}
          workspace={{ ...workspace, name: agencyName }}
          activeClient={activeClient}
          clients={clients}
          activeClientId={activeClientId}
          setActiveClientId={setActiveClientId}
          view={view}
          setView={changeView}
          views={primaryViews}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          darkMode={darkMode}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onNewClient={() => isAgencyUser && setClientFormOpen(true)}
          onEditWorkspace={() => setAgencyProfileOpen(true)}
          onToggleDarkMode={() => setDarkMode((current) => !current)}
          onProfileAction={(action) => {
            if (action === "logout") void handleLogout();
            if (action === "settings") notify("Notificações no topo da tela.");
            if (action === "clients" && isAgencyUser) changeView("clients");
            if (action === "team" && isAgencyUser) changeView("team");
            if (action === "billing" && isAgencyUser) changeView("billing");
            if (action === "workspace" && isAgencyUser) setAgencyProfileOpen(true);
            if (action === "profile") {
              if (isAgencyUser) setAgencyProfileOpen(true);
              else setMemberProfileOpen(true);
            }
          }}
        />

        <main className={cn("flex min-w-0 flex-1 flex-col pb-16 transition-[margin] duration-300 lg:pb-0", sidebarCollapsed ? "lg:ml-[84px]" : "lg:ml-[286px]")}>
          {view === "calendar" && (
            <AgencyHero
              workspace={heroWorkspace}
              isClient={isClientUser}
              profileRole={profile!.role}
              notifications={notifications}
              onClearNotifications={clearNotifications}
              onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
              onOpenNotification={openNotification}
              onViewProfile={() => {
                if (isClientUser || isAgencyUser) setAgencyProfileOpen(true);
                else setMemberProfileOpen(true);
              }}
            />
          )}
          <Topbar
            view={view}
            views={availableViews}
            query={query}
            setQuery={setQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            monthFilter={monthFilter}
            setMonthFilter={setMonthFilter}
            availableMonths={availableMonths}
            isClient={isClientUser}
            clients={clients}
            activeClientId={activeClientId}
            setActiveClientId={setActiveClientId}
            onNewPost={() => canCreateContent && openNewPost()}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            notifications={notifications}
            onClearNotifications={clearNotifications}
            onOpenNotification={openNotification}
          />
          <div className="glass-scroll flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6">
            {isAgencyUser && <BillingNotice subscription={subscription} onRegularize={() => void billingPaymentAction("payment_link")} />}
            {isAgencyUser && shouldSuspendAccess(subscription) ? (
              <SubscriptionBlocked
                subscription={subscription}
                onRegularize={() => void billingPaymentAction("payment_link")}
                onUpdatePayment={() => void billingPaymentAction("update_payment")}
              />
            ) : !activeClient && view !== "team" && view !== "billing" ? (
              <EmptyState
                title="Cadastre o primeiro cliente"
                description="Crie um cliente para começar a organizar calendário, feed e aprovações."
                action={isAgencyUser ? { label: "Novo cliente", onClick: () => setClientFormOpen(true) } : undefined}
              />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {view === "calendar" && (
                    <CalendarView
                      posts={scopedPosts}
                      campaigns={scopedCampaigns}
                      stats={stats}
                      monthFilter={monthFilter}
                      isClient={isClientUser}
                      onOpenPost={setSelectedPost}
                      onOpenCampaign={setSelectedCampaign}
                      onNewPost={(date) => canCreateContent && openNewPost(date)}
                      onMovePost={async (postId, date) => updatePost(postId, { scheduled_date: date })}
                      onStatusFilter={setStatusFilter}
                    />
                  )}
                  {view === "pipeline" && (
                    <PipelineView posts={scopedPosts} campaigns={scopedCampaigns} isClient={isClientUser} onOpenPost={setSelectedPost} onOpenCampaign={setSelectedCampaign} onMove={movePipeline} />
                  )}
                  {view === "feed" && (
                    <FeedView
                      client={activeClient}
                      posts={scopedPosts}
                      isClient={isClientUser}
                      statusMeta={statusMeta}
                      onOpenPost={setSelectedPost}
                      onReorder={reorderFeed}
                      generalRequests={comments
                        .filter((comment) => scopedPosts.some((post) => post.id === comment.post_id) && comment.content.toLowerCase().includes("observação geral do preview do feed"))
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())}
                      currentUserId={profile?.id}
                      onDeleteComment={deleteComment}
                      onComment={(content) => {
                        const targetPost = scopedPosts.slice().sort((a, b) => a.feed_order - b.feed_order)[0];
                        if (targetPost) void addComment(targetPost.id, `Observação geral do preview do feed: ${content}`);
                      }}
                    />
                  )}
                  {view === "contents" && (
                    <ContentsView posts={scopedPosts} onOpenPost={setSelectedPost} onDelete={confirmDeletePost} canDelete={isAgencyUser} />
                  )}
                  {view === "campaigns" && (
                    <CampaignsView
                      campaigns={scopedCampaigns}
                      clients={clients}
                      canEdit={canCreateContent}
                      onOpen={setSelectedCampaign}
                      onNew={() => {
                        setCampaignToEdit(null);
                        setCampaignFormOpen(true);
                      }}
                      onEdit={(campaign) => {
                        setCampaignToEdit(campaign);
                        setCampaignFormOpen(true);
                      }}
                    />
                  )}
                  {view === "goals" && (
                    <MonthlyGoalsView
                      goals={scopedGoals}
                      clients={clients}
                      monthFilter={monthFilter}
                      canEdit={canCreateContent}
                      onOpen={setSelectedGoal}
                      onNew={() => {
                        setGoalToEdit(null);
                        setGoalFormOpen(true);
                      }}
                      onEdit={(goal) => {
                        setGoalToEdit(goal);
                        setGoalFormOpen(true);
                      }}
                    />
                  )}
                  {view === "metrics" && (
                    <MetricsView
                      metric={currentMetric}
                      previousMetric={previousMetric}
                      metrics={monthlyMetrics.filter((metricItem) => metricItem.client_id === activeClient?.id)}
                      activityHistory={activityHistory.filter((item) => item.item_type === "monthly_metric" && item.client_id === activeClient?.id)}
                      clients={clients}
                      activeClient={activeClient}
                      activeClientId={activeClientId}
                      setActiveClientId={setActiveClientId}
                      monthFilter={monthFilter}
                      setMonthFilter={setMonthFilter}
                      availableMonths={availableMonths}
                      agencyName={agencyName}
                      canEdit={canCreateContent}
                      isClient={isClientUser}
                      onEdit={() => setMetricsFormOpen(true)}
                      onFeedback={saveMetricFeedback}
                    />
                  )}
                  {view === "clients" && isAgencyUser && (
                    <ClientsView
                      clients={clients}
                      posts={posts}
                      activeClientId={activeClientId}
                      onSelect={(client) => {
                        setActiveClientId(client.id);
                        setSelectedClient(client);
                      }}
                      onNewClient={() => setClientFormOpen(true)}
                      onDelete={deleteClient}
                    />
                  )}
                  {view === "team" && isAgencyUser && (
                    <TeamView
                      members={teamMembers}
                      posts={posts}
                      onNewMember={() => {
                        setSelectedMember(null);
                        setMemberFormOpen(true);
                      }}
                      onEditMember={(member) => {
                        setSelectedMember(member);
                        setMemberFormOpen(true);
                      }}
                      onDeleteMember={deleteTeamMember}
                    />
                  )}
                  {view === "billing" && isAgencyUser && (
                    <BillingView
                      agencyName={agencyName}
                      billingDocument={agencyBillingDocument}
                      subscription={subscription}
                      history={billingHistory}
                      referrals={referrals}
                      usage={{ clients: clients.length, members: teamMembers.filter((member) => member.status !== "inactive").length, contentsThisMonth: posts.filter((post) => post.created_at?.startsWith(new Date().toISOString().slice(0, 7))).length }}
                      onChangePlan={changePlan}
                      onCancel={cancelSubscription}
                      onReactivate={reactivateSubscription}
                      onPaymentLink={() => void billingPaymentAction("payment_link")}
                      onUpdatePayment={() => void billingPaymentAction("update_payment")}
                    />
                  )}
                  {view === "workspace" && isAgencyUser && (
                    <WorkspaceView workspace={{ ...workspace, name: agencyName }} onEdit={() => setWorkspaceModalOpen(true)} />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      <MobileNav view={view} setView={changeView} isClient={isClientUser} views={primaryViews} canCreateContent={canCreateContent} onNewPost={() => openNewPost()} />

      {profile && (
        <PostModal
          post={selectedPost}
          client={activeClient}
          comments={comments.filter((comment) => comment.post_id === selectedPost?.id)}
          profile={profile}
          onClose={() => setSelectedPost(null)}
          onApprove={() =>
            selectedPost ? updatePost(selectedPost.id, { status: "approved", pipeline_stage: "approved" }) : Promise.resolve()
          }
          onRevision={(feedback) =>
            selectedPost ? requestRevision(selectedPost.id, feedback) : Promise.resolve()
          }
          onUpdate={(patch) =>
            selectedPost ? updatePost(selectedPost.id, patch) : Promise.resolve()
          }
          onSaveEdit={(patch, mediaItems) =>
            selectedPost ? savePostEdit(selectedPost.id, patch, mediaItems) : Promise.resolve()
          }
          onDeleteComment={deleteComment}
          onDelete={() =>
            selectedPost && confirmDeletePost(selectedPost.id)
          }
        />
      )}

      <PostFormModal
        open={postFormOpen && canCreateContent}
        clients={clients}
        activeClientId={activeClientId}
        initialDate={newPostDate}
        onClose={() => setPostFormOpen(false)}
        onSave={createPost}
      />

      <CampaignFormModal
        open={campaignFormOpen && canCreateContent}
        clients={clients}
        responsibleOptions={responsibleOptions}
        activeClientId={activeClientId}
        campaign={campaignToEdit}
        onClose={() => {
          setCampaignFormOpen(false);
          setCampaignToEdit(null);
        }}
        onSave={saveCampaign}
        onDelete={deleteCampaign}
      />

      <MonthlyGoalFormModal
        open={goalFormOpen && canCreateContent}
        clients={clients}
        responsibleOptions={responsibleOptions}
        activeClientId={activeClientId}
        goal={goalToEdit}
        monthFilter={monthFilter}
        onClose={() => {
          setGoalFormOpen(false);
          setGoalToEdit(null);
        }}
        onSave={saveMonthlyGoal}
        onDelete={deleteMonthlyGoal}
      />

      <MetricsFormModal
        open={metricsFormOpen && canCreateContent}
        clients={clients}
        activeClientId={activeClientId}
        metric={currentMetric}
        monthFilter={monthFilter}
        onClose={() => setMetricsFormOpen(false)}
        onSave={saveMonthlyMetrics}
      />

      <CampaignModal
        campaign={selectedCampaign}
        client={clients.find((client) => client.id === selectedCampaign?.client_id) ?? null}
        history={activityHistory.filter((item) => item.item_type === "campaign" && item.item_id === selectedCampaign?.id)}
        isClient={isClientUser}
        canEdit={canCreateContent}
        onClose={() => setSelectedCampaign(null)}
        onEdit={(campaign) => {
          setSelectedCampaign(null);
          setCampaignToEdit(campaign);
          setCampaignFormOpen(true);
        }}
        onApprove={(campaign) => updateCampaignStatus(campaign, "approved")}
        onRevision={(campaign, feedback) => updateCampaignStatus(campaign, "revision_requested", feedback)}
      />

      <MonthlyGoalModal
        goal={selectedGoal}
        client={clients.find((client) => client.id === selectedGoal?.client_id) ?? null}
        history={activityHistory.filter((item) => item.item_type === "monthly_goal" && item.item_id === selectedGoal?.id)}
        isClient={isClientUser}
        canEdit={canCreateContent}
        onClose={() => setSelectedGoal(null)}
        onEdit={(goal) => {
          setSelectedGoal(null);
          setGoalToEdit(goal);
          setGoalFormOpen(true);
        }}
        onFeedback={saveGoalFeedback}
      />

      <ClientFormModal
        open={clientFormOpen && isAgencyUser}
        onClose={() => setClientFormOpen(false)}
        onSave={createClient}
      />

      <MemberFormModal
        open={memberFormOpen && isAgencyUser}
        member={selectedMember}
        onClose={() => {
          setMemberFormOpen(false);
          setSelectedMember(null);
        }}
        onSave={selectedMember ? updateTeamMember : createTeamMember}
      />

      <ClientDetailsModal
        client={isAgencyUser && selectedClient ? clients.find((client) => client.id === selectedClient.id) ?? selectedClient : null}
        onClose={() => setSelectedClient(null)}
        onSave={updateClient}
        onDelete={async (clientId) => {
          await deleteClient(clientId);
          setSelectedClient(null);
        }}
      />

      <WorkspaceModal
        open={workspaceModalOpen && isAgencyUser}
        workspace={{ ...workspace, name: agencyName }}
        onClose={() => setWorkspaceModalOpen(false)}
        onAutoSave={saveWorkspace}
        onUploadImage={uploadProfileImage}
      />

      <AgencyProfileModal
        open={agencyProfileOpen}
        workspace={{ ...workspace, name: agencyName }}
        email={profile?.email ?? ""}
        onClose={() => setAgencyProfileOpen(false)}
        canEdit={isAgencyUser}
        onEdit={() => {
          setAgencyProfileOpen(false);
          if (isAgencyUser) setWorkspaceModalOpen(true);
        }}
      />

      <MemberProfileModal
        open={memberProfileOpen && !isAgencyUser}
        profile={profile}
        onClose={() => setMemberProfileOpen(false)}
        onSave={saveOwnProfile}
      />

      <ConfirmDialog
        open={Boolean(pendingDeletePostId)}
        title="Excluir conteúdo"
        description="Tem certeza que deseja excluir este conteúdo? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        onCancel={() => setPendingDeletePostId(null)}
        onConfirm={async () => {
          if (pendingDeletePostId) await deletePost(pendingDeletePostId);
          setPendingDeletePostId(null);
        }}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white shadow-lift lg:bottom-6"
          >
            <Check className="h-4 w-4" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ─── Client CRUD ────────────────────────────────────────────────────────────

  async function recordActivity(input: Omit<ActivityHistory, "id" | "created_at" | "agency_id" | "user_id">) {
    const now = new Date().toISOString();
    const item: ActivityHistory = {
      id: crypto.randomUUID(),
      agency_id: profile?.agency_id ?? "agency-local",
      user_id: profile?.id ?? null,
      created_at: now,
      ...input
    };
    setActivityHistory((current) => [item, ...current]);
    if (supabase && profile?.agency_id) {
      await supabase.from("activity_history").insert({
        agency_id: profile.agency_id,
        client_id: input.client_id,
        item_type: input.item_type,
        item_id: input.item_id,
        action: input.action,
        user_id: profile.id,
        description: input.description,
        created_at: now
      });
    }
  }

  async function uploadCampaignMedia(campaignId: string, files: File[]): Promise<CampaignMedia[]> {
    const uploads = await Promise.all(files.map(async (file, index): Promise<CampaignMedia | null> => {
      if (file.size > 250 * 1024 * 1024) {
        notify(`${file.name} passa de 250MB`);
        return null;
      }
      const url = await uploadMediaFile(`campaigns/${campaignId}`, file);
      return {
        id: crypto.randomUUID(),
        campaign_id: campaignId,
        url,
        type: file.type.startsWith("video") ? "video" : "image",
        order_index: index,
        created_at: new Date().toISOString()
      };
    }));
    return uploads.filter((item): item is CampaignMedia => Boolean(item));
  }

  async function saveCampaign(input: CampaignFormInput) {
    const now = new Date().toISOString();
    const values = {
      agency_id: profile?.agency_id ?? "agency-local",
      client_id: input.client_id,
      title: input.title,
      objective: input.objective,
      platform: input.platform,
      audience: input.audience,
      daily_budget: input.daily_budget ? parseCurrencyInput(input.daily_budget) : null,
      total_budget: input.total_budget ? parseCurrencyInput(input.total_budget) : null,
      start_date: input.start_date,
      end_date: input.end_date || null,
      status: input.status,
      responsible_user_id: input.responsible_user_id || null,
      responsible_name: input.responsible_name,
      copy: input.copy,
      internal_notes: input.internal_notes,
      client_feedback: input.client_feedback,
      updated_at: now
    };

    if (campaignToEdit) {
      if (supabase) {
        const { error } = await supabase.from("campaigns").update(values).eq("id", campaignToEdit.id);
        if (error) {
          notify(error.message);
          throw new Error(error.message);
        }
      }
      const uploaded = input.files.length ? await uploadCampaignMedia(campaignToEdit.id, input.files) : [];
      if (uploaded.length && supabase) {
        await supabase.from("campaign_media").insert(uploaded.map((item, index) => ({
          campaign_id: campaignToEdit.id,
          url: item.url,
          type: item.type,
          order_index: campaignToEdit.media.length + index
        })));
      }
      const nextCampaign = { ...campaignToEdit, ...values, media: [...campaignToEdit.media, ...uploaded] };
      setCampaigns((current) => current.map((campaign) => campaign.id === campaignToEdit.id ? nextCampaign : campaign));
      setSelectedCampaign(nextCampaign);
      await recordActivity({ client_id: input.client_id, item_type: "campaign", item_id: campaignToEdit.id, action: "updated", description: "Campanha atualizada." });
    } else {
      const localId = crypto.randomUUID();
      let campaignId = localId;
      let inserted: Omit<Campaign, "media"> | null = null;
      if (supabase) {
        const { data, error } = await supabase.from("campaigns").insert({ ...values, created_at: now }).select().single();
        if (error || !data) {
          notify(error?.message ?? "Nao foi possivel salvar a campanha.");
          throw new Error(error?.message ?? "Nao foi possivel salvar a campanha.");
        }
        inserted = data as Omit<Campaign, "media">;
        campaignId = data.id;
      }
      const media = await uploadCampaignMedia(campaignId, input.files);
      if (media.length && supabase) {
        await supabase.from("campaign_media").insert(media.map((item, index) => ({
          campaign_id: campaignId,
          url: item.url,
          type: item.type,
          order_index: index
        })));
      }
      const nextCampaign: Campaign = inserted ? { ...inserted, media } : { id: campaignId, created_at: now, ...values, media };
      setCampaigns((current) => [...current, nextCampaign]);
      await recordActivity({ client_id: input.client_id, item_type: "campaign", item_id: campaignId, action: "created", description: "Campanha criada." });
    }
    setCampaignFormOpen(false);
    setCampaignToEdit(null);
    notify("Campanha salva");
  }

  async function updateCampaignStatus(campaign: Campaign, status: CampaignStatus, feedback?: string) {
    const now = new Date().toISOString();
    const patch: Partial<Campaign> = { status, updated_at: now, ...(feedback ? { client_feedback: feedback } : {}) };
    if (supabase) {
      const { error } = await supabase.from("campaigns").update(patch).eq("id", campaign.id);
      if (error) throw new Error(error.message);
    }
    const nextCampaign = { ...campaign, ...patch };
    setCampaigns((current) => current.map((item) => item.id === campaign.id ? nextCampaign : item));
    setSelectedCampaign(nextCampaign);
    await recordActivity({
      client_id: campaign.client_id,
      item_type: "campaign",
      item_id: campaign.id,
      action: status,
      description: status === "revision_requested" ? `Revisao solicitada: ${feedback}` : `Status alterado para ${campaignStatusMeta[status].label}.`
    });
    notify(status === "revision_requested" ? "Revisao enviada" : "Campanha atualizada");
  }

  async function deleteCampaign(campaign: Campaign) {
    if (supabase) {
      const { error } = await supabase.from("campaigns").delete().eq("id", campaign.id);
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
    }
    setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
    setSelectedCampaign((current) => (current?.id === campaign.id ? null : current));
    setCampaignFormOpen(false);
    setCampaignToEdit(null);
    notify("Campanha removida");
  }

  async function saveMonthlyMetrics(input: MonthlyMetricFormInput) {
    const now = new Date().toISOString();
    const existing = monthlyMetrics.find((metric) => metric.client_id === input.client_id && metric.month === input.month && metric.year === input.year);
    const values = {
      agency_id: profile?.agency_id ?? "agency-local",
      client_id: input.client_id,
      month: input.month,
      year: input.year,
      instagram_followers: parseMetricNumber(input.instagram_followers) || null,
      instagram_reach: parseMetricNumber(input.instagram_reach) || null,
      instagram_impressions: parseMetricNumber(input.instagram_impressions) || null,
      instagram_link_clicks: parseMetricNumber(input.instagram_link_clicks) || null,
      instagram_engagement: parseMetricNumber(input.instagram_engagement) || null,
      instagram_likes: parseMetricNumber(input.instagram_likes) || null,
      instagram_comments: parseMetricNumber(input.instagram_comments) || null,
      instagram_saves: parseMetricNumber(input.instagram_saves) || null,
      instagram_shares: parseMetricNumber(input.instagram_shares) || null,
      instagram_reposts: parseMetricNumber(input.instagram_reposts) || null,
      paid_investment: parseCurrencyInput(input.paid_investment) || null,
      paid_reach: parseMetricNumber(input.paid_reach) || null,
      paid_impressions: parseMetricNumber(input.paid_impressions) || null,
      paid_clicks: parseMetricNumber(input.paid_clicks) || null,
      paid_leads: parseMetricNumber(input.paid_leads) || null,
      status: input.status,
      created_by: existing?.created_by ?? profile?.id ?? null,
      updated_at: now
    };
    let saved: MonthlyMetric;

    if (supabase) {
      const query = existing
        ? supabase.from("monthly_metrics").update(values).eq("id", existing.id).select().single()
        : supabase.from("monthly_metrics").insert({ ...values, created_at: now }).select().single();
      const { data, error } = await query;
      if (error || !data) {
        notify(error?.message ?? "Nao foi possivel salvar as metricas.");
        throw new Error(error?.message ?? "Nao foi possivel salvar as metricas.");
      }
      saved = data as MonthlyMetric;
    } else {
      saved = {
        id: existing?.id ?? crypto.randomUUID(),
        created_at: existing?.created_at ?? now,
        ...values
      };
    }

    setMonthlyMetrics((current) => {
      const withoutCurrent = current.filter((metric) => metric.id !== saved.id && !(metric.client_id === saved.client_id && metric.month === saved.month && metric.year === saved.year));
      return [...withoutCurrent, saved].sort((a, b) => metricMonthKey(b).localeCompare(metricMonthKey(a)));
    });
    await recordActivity({
      client_id: saved.client_id,
      item_type: "monthly_metric",
      item_id: saved.id,
      action: existing ? (input.status === "sent_to_client" ? "sent_to_client" : "updated") : "created",
      description: existing
        ? input.status === "sent_to_client" ? "Relatório de métricas enviado para o cliente." : "Relatório de métricas atualizado."
        : "Relatório de métricas criado."
    });
    setMetricsFormOpen(false);
    notify("Métricas salvas");
  }

  async function saveMetricFeedback(metric: MonthlyMetric, feedback: string) {
    const patch: Partial<MonthlyMetric> = {
      client_feedback: feedback,
      updated_at: new Date().toISOString()
    };
    if (supabase) {
      const { error } = await (supabase as any).rpc("save_monthly_metric_feedback", {
        metric_id_input: metric.id,
        feedback_input: feedback
      });
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
    }
    setMonthlyMetrics((current) => current.map((item) => item.id === metric.id ? { ...item, ...patch } : item));
    await recordActivity({
      client_id: metric.client_id,
      item_type: "monthly_metric",
      item_id: metric.id,
      action: "feedback",
      description: "Cliente deixou feedback no relatório de métricas."
    });
    notify("Feedback salvo");
  }

  async function saveMonthlyGoal(input: MonthlyGoalFormInput) {
    const now = new Date().toISOString();
    const rpcValues = {
      goal_id_input: goalToEdit?.id ?? null,
      agency_id_input: profile?.agency_id ?? null,
      client_id_input: input.client_id,
      month_input: input.month,
      year_input: input.year,
      title_input: input.title,
      description_input: input.description,
      planned_actions_input: input.planned_actions,
      responsible_user_id_input: input.responsible_user_id || null,
      responsible_name_input: input.responsible_name,
      status_input: input.status,
      client_feedback_input: input.client_feedback,
      result_notes_input: input.result_notes
    };
    const values = {
      agency_id: profile?.agency_id ?? "agency-local",
      client_id: input.client_id,
      month: input.month,
      year: input.year,
      title: input.title,
      description: input.description,
      planned_actions: input.planned_actions,
      responsible_user_id: input.responsible_user_id || null,
      responsible_name: input.responsible_name,
      status: input.status,
      client_feedback: input.client_feedback,
      result_notes: input.result_notes,
      updated_at: now
    };

    if (goalToEdit) {
      if (supabase) {
        const { data, error } = await (supabase as any).rpc("save_monthly_goal", rpcValues);
        if (error) {
          const message = error.message.includes("save_monthly_goal")
            ? "Rode o SQL 17 no Supabase para liberar o salvamento de objetivos."
            : error.message;
          notify(message);
          throw new Error(message);
        }
        if (data) {
          const nextGoal = data as MonthlyGoal;
          setMonthlyGoals((current) => current.map((goal) => goal.id === goalToEdit.id ? nextGoal : goal));
          setSelectedGoal(nextGoal);
          await recordActivity({ client_id: input.client_id, item_type: "monthly_goal", item_id: goalToEdit.id, action: "updated", description: "Objetivo do mes atualizado." });
          setGoalFormOpen(false);
          setGoalToEdit(null);
          notify("Objetivo salvo");
          return;
        }
      }
      const nextGoal = { ...goalToEdit, ...values };
      setMonthlyGoals((current) => current.map((goal) => goal.id === goalToEdit.id ? nextGoal : goal));
      setSelectedGoal(nextGoal);
      await recordActivity({ client_id: input.client_id, item_type: "monthly_goal", item_id: goalToEdit.id, action: "updated", description: "Objetivo do mes atualizado." });
    } else {
      const localId = crypto.randomUUID();
      let savedGoal: MonthlyGoal = { id: localId, created_at: now, ...values };
      if (supabase) {
        const { data, error } = await (supabase as any).rpc("save_monthly_goal", rpcValues);
        if (error || !data) {
          const message = error?.message.includes("save_monthly_goal")
            ? "Rode o SQL 17 no Supabase para liberar o salvamento de objetivos."
            : error?.message ?? "Nao foi possivel salvar o objetivo.";
          notify(message);
          throw new Error(message);
        }
        savedGoal = data as MonthlyGoal;
      }
      setMonthlyGoals((current) => [...current, savedGoal]);
      await recordActivity({ client_id: input.client_id, item_type: "monthly_goal", item_id: savedGoal.id, action: "created", description: "Objetivo do mes criado." });
    }
    setGoalFormOpen(false);
    setGoalToEdit(null);
    notify("Objetivo salvo");
  }

  async function saveGoalFeedback(goal: MonthlyGoal, feedback: string) {
    const now = new Date().toISOString();
    const patch = { client_feedback: feedback, updated_at: now };
    if (supabase) {
      const { error } = await supabase.from("monthly_goals").update(patch).eq("id", goal.id);
      if (error) throw new Error(error.message);
    }
    const nextGoal = { ...goal, ...patch };
    setMonthlyGoals((current) => current.map((item) => item.id === goal.id ? nextGoal : item));
    setSelectedGoal(nextGoal);
    await recordActivity({ client_id: goal.client_id, item_type: "monthly_goal", item_id: goal.id, action: "feedback", description: "Cliente deixou feedback nos objetivos do mes." });
    notify("Feedback enviado");
  }

  async function deleteMonthlyGoal(goal: MonthlyGoal) {
    if (supabase) {
      const { error } = await (supabase as any).rpc("delete_monthly_goal", { goal_id_input: goal.id });
      if (error) {
        const message = error.message.includes("delete_monthly_goal")
          ? "Rode o SQL 17 atualizado no Supabase para liberar a exclusão de objetivos."
          : error.message;
        notify(message);
        throw new Error(message);
      }
    }
    setMonthlyGoals((current) => current.filter((item) => item.id !== goal.id));
    setSelectedGoal((current) => (current?.id === goal.id ? null : current));
    setGoalFormOpen(false);
    setGoalToEdit(null);
    notify("Objetivo removido");
  }

  async function createClient(input: Pick<Client, "name" | "instagram_handle" | "phone" | "brand_color" | "email" | "invite_code"> & {
    avatar_file?: File | null;
  }) {
    const clientLimit = getLimit(subscription, "clients");
    if (clientLimit !== null && clients.length >= clientLimit) {
      notify(`Você utilizou ${clients.length} de ${clientLimit} clientes disponíveis no ${getPlanLabel(subscription?.plan)}. Faça upgrade para adicionar mais.`);
      throw new Error("Limite de clientes atingido.");
    }

    const avatar = input.avatar_file ? await uploadProfileImage(input.avatar_file, "clients") : null;
    const inviteCode = input.invite_code?.trim().toUpperCase() || generateInviteCode(input.name);

    const nextClient: Client = {
      id: crypto.randomUUID(),
      agency_id: profile?.agency_id ?? "agency-local",
      avatar,
      name: input.name,
      email: input.email,
      instagram_handle: input.instagram_handle,
      phone: input.phone,
      brand_color: input.brand_color,
      invite_code: inviteCode
    };

    if (supabase && profile?.agency_id) {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          agency_id: profile.agency_id,
          name: input.name,
          email: input.email,
          instagram_handle: input.instagram_handle,
          phone: input.phone,
          brand_color: input.brand_color,
          avatar,
          invite_code: inviteCode
        })
        .select()
        .single();

      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }

      if (data) {
        const savedClient = data as Client;
        setClients((current) => [...current, savedClient]);
        setActiveClientId(savedClient.id);
        const normalizedEmail = (input.email ?? "").trim().toLowerCase();
        if (normalizedEmail) {
          void supabase
            .from("users")
            .update({ agency_id: profile.agency_id, client_id: savedClient.id })
            .eq("role", "client")
            .ilike("email", normalizedEmail);
        }
      }
    } else {
      setClients((current) => [...current, nextClient]);
      setActiveClientId(nextClient.id);
    }

    notify("Cliente cadastrado");
  }

  async function uploadProfileImage(file: File, folder: string) {
    if (supabase) {
      const safeName = file.name.replace(/[^a-z0-9.]+/gi, "-").toLowerCase();
      const path = `profiles/${folder}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("post-media").upload(path, file, {
        cacheControl: "3600",
        upsert: true
      });
      if (error) {
        notify("Não consegui salvar a imagem no Supabase. Tente enviar novamente.");
        throw new Error(error.message);
      }
      const { data } = supabase.storage.from("post-media").getPublicUrl(path);
      return data.publicUrl;
    }
    return URL.createObjectURL(file);
  }

  async function createPost(input: {
    client_id: string;
    title: string;
    caption: string;
    instructions: string;
    status: ContentStatus;
    pipeline_stage: PipelineStage;
    content_format: ContentFormat;
    scheduled_date: string;
    scheduled_time: string;
    files: File[];
    cover_file?: File | null;
  }) {
    const contentLimit = getContentLimit(subscription);
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthUsage = posts.filter((post) => post.created_at?.startsWith(monthKey)).length;
    if (contentLimit !== null && monthUsage >= contentLimit) {
      notify(`Você utilizou ${monthUsage} de ${contentLimit} conteúdos disponíveis no ${getPlanLabel(subscription?.plan)} este mês. Faça upgrade para continuar.`);
      throw new Error("Limite de conteúdos atingido.");
    }

    const clientFeedPosts = posts.filter((post) => post.client_id === input.client_id);
    const feedOrder = 0;
    const now = new Date().toISOString();
    if (supabase) {
      const client = supabase;
      await Promise.all(
        clientFeedPosts.map((post) =>
          client.from("posts").update({ feed_order: post.feed_order + 1, updated_at: now }).eq("id", post.id)
        )
      );
      const { data, error } = await client.from("posts").insert({
        client_id: input.client_id,
        title: input.title,
        caption: input.caption,
        instructions: input.instructions,
        status: input.status,
        pipeline_stage: input.pipeline_stage,
        content_format: input.content_format,
        scheduled_date: input.scheduled_date,
        scheduled_time: input.scheduled_time,
        feed_order: feedOrder,
        created_by: profile?.id,
        submitted_at: input.status === "awaiting_approval" ? now : null,
        scheduled_at: input.status === "scheduled" ? now : null,
        updated_at: now
      }).select().single();

      if (error || !data) {
        notify(error?.message ?? "Não foi possível salvar o conteúdo.");
        throw new Error(error?.message ?? "Não foi possível salvar o conteúdo.");
      }

      const media = await uploadMedia(data.id, input.files, input.cover_file ?? null);
      let savedMedia = media;
      if (media.length) {
        const { data: mediaRows, error: mediaError } = await supabase.from("post_media").insert(
          media.map((item, index) => ({
            post_id: data.id,
            media_url: item.media_url,
            media_type: item.media_type,
            thumbnail_url: item.thumbnail_url ?? null,
            order_index: index
          }))
        ).select();

        if (mediaError) {
          notify(mediaError.message);
          throw new Error(mediaError.message);
        }
        savedMedia = (mediaRows ?? media) as PostMedia[];
      }

      const nextPost = { ...(data as Omit<Post, "media">), media: savedMedia };
      setPosts((current) => [
        ...current.map((post) => post.client_id === input.client_id ? { ...post, feed_order: post.feed_order + 1 } : post),
        nextPost
      ]);
    } else {
      const postId = crypto.randomUUID();
      const media = await uploadMedia(postId, input.files, input.cover_file ?? null);
      const nextPost: Post = {
        id: postId,
        client_id: input.client_id,
        title: input.title,
        caption: input.caption,
        instructions: input.instructions,
        status: input.status,
        pipeline_stage: input.pipeline_stage,
        content_format: input.content_format,
        scheduled_date: input.scheduled_date,
        scheduled_time: input.scheduled_time,
        feed_order: feedOrder,
        created_by: profile?.id,
        created_at: now,
        submitted_at: input.status === "awaiting_approval" ? now : null,
        scheduled_at: input.status === "scheduled" ? now : null,
        updated_at: now,
        media
      };
      setPosts((current) => [
        ...current.map((post) => post.client_id === input.client_id ? { ...post, feed_order: post.feed_order + 1 } : post),
        nextPost
      ]);
    }

    notify("Conteúdo criado");
  }

  async function uploadMedia(postId: string, files: File[], coverFile?: File | null): Promise<PostMedia[]> {
    const firstVideo = files.find((file) => file.type.startsWith("video"));
    const generatedCover = !coverFile && firstVideo ? await createVideoThumbnailFile(firstVideo) : null;
    const videoCover = coverFile ?? generatedCover;
    const videoCoverUrl = videoCover ? await uploadMediaFile(postId, videoCover) : null;
    const uploads = await Promise.all(files.map(async (file, index): Promise<PostMedia | null> => {
      const mediaType = file.type.startsWith("video") ? "video" : "image";
      if (file.size > 250 * 1024 * 1024) {
        notify(`${file.name} passa de 250MB`);
        return null;
      }

      const url = await uploadMediaFile(postId, file);

      return {
        id: crypto.randomUUID(),
        post_id: postId,
        media_url: url,
        media_type: mediaType,
        thumbnail_url: mediaType === "video" ? videoCoverUrl : null,
        order_index: index
      };
    }));
    return uploads.filter((item): item is PostMedia => Boolean(item));
  }

  async function uploadMediaFile(postId: string, file: File) {
    let url = URL.createObjectURL(file);
    if (supabase) {
      const safeName = file.name.replace(/[^a-z0-9.]+/gi, "-").toLowerCase();
      const path = `${postId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("post-media").upload(path, file, {
        cacheControl: "3600",
        contentType: getUploadContentType(file),
        upsert: true
      });
      if (!error) {
        const { data } = supabase.storage.from("post-media").getPublicUrl(path);
        url = data.publicUrl;
      }
    }
    return url;
  }

  async function updatePost(postId: string, patch: Partial<Post>) {
    const now = new Date().toISOString();
    const enrichedPatch: Partial<Post> = {
      ...patch,
      updated_at: now,
      ...(patch.status === "awaiting_approval" ? { submitted_at: now } : {}),
      ...(patch.status === "approved" ? { approved_at: now } : {}),
      ...(patch.status === "revision_requested" ? { revision_requested_at: now } : {}),
      ...(patch.status === "scheduled" ? { scheduled_at: now } : {})
    };
    const { media: _media, ...postPatch } = enrichedPatch;
    if (supabase) {
      const { error } = await supabase.from("posts").update(postPatch).eq("id", postId);
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
    }
    setPosts((current) => current.map((post) => (post.id === postId ? { ...post, ...enrichedPatch } : post)));
    setSelectedPost((current) => (current?.id === postId ? { ...current, ...enrichedPatch } : current));
    notify("Conteúdo atualizado");
  }

  async function savePostEdit(postId: string, patch: Partial<Post>, mediaItems: Array<PostMedia | File>) {
    const nextMedia: PostMedia[] = [];
    for (const item of mediaItems) {
      if (item instanceof File) {
        const [uploaded] = await uploadMedia(postId, [item]);
        if (uploaded) nextMedia.push(uploaded);
      } else {
        nextMedia.push(item);
      }
    }
    const orderedMedia = nextMedia.map((item, index) => ({ ...item, order_index: index }));

    if (supabase) {
      const { error: deleteError } = await supabase.from("post_media").delete().eq("post_id", postId);
      if (deleteError) {
        notify(deleteError.message);
        throw new Error(deleteError.message);
      }

      if (orderedMedia.length) {
        const { data: mediaRows, error: mediaError } = await supabase.from("post_media").insert(
          orderedMedia.map((item, index) => ({
            post_id: postId,
            media_url: item.media_url,
            media_type: item.media_type,
            thumbnail_url: item.thumbnail_url ?? null,
            order_index: index
          }))
        ).select();
        if (mediaError) {
          notify(mediaError.message);
          throw new Error(mediaError.message);
        }
        await updatePost(postId, { ...patch, media: (mediaRows ?? orderedMedia) as PostMedia[] });
        return;
      }
    }

    await updatePost(postId, { ...patch, media: orderedMedia });
  }

  async function requestRevision(postId: string, feedback: string) {
    const cleanFeedback = feedback.trim();
    if (!cleanFeedback) {
      notify("Escreva o ajuste solicitado antes de pedir revisão.");
      throw new Error("Feedback obrigatório para solicitar revisão.");
    }
    await addComment(postId, cleanFeedback);
    await updatePost(postId, { status: "revision_requested", pipeline_stage: "revision" });
    notify("Pedido de revisão enviado para a agência");
  }

  async function addComment(postId: string, content: string) {
    let nextComment: Comment = {
      id: crypto.randomUUID(),
      post_id: postId,
      user_id: profile?.id ?? "local-user",
      user_name: profile?.name ?? "Usuário",
      content,
      created_at: new Date().toISOString()
    };
    if (supabase && profile) {
      const { data, error } = await supabase.from("comments").insert({
        post_id: postId,
        user_id: profile.id,
        content
      }).select().single();
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
      if (data) nextComment = { ...nextComment, id: data.id, created_at: data.created_at };
    }
    setComments((current) => [...current, nextComment]);
  }

  async function deleteComment(commentId: string) {
    const target = comments.find((comment) => comment.id === commentId);
    if (!target) return;
    if (supabase) {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
    }
    setComments((current) => current.filter((comment) => comment.id !== commentId));
    notify("Solicitação excluída");
  }

  async function billingAction(action: string, payload: Record<string, unknown> = {}) {
    if (!profile?.agency_id) return null;
    try {
      const response = await fetch("/api/asaas/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, agencyId: profile.agency_id, ...payload })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir a ação.");
      if (data.subscription) setSubscription(data.subscription);
      if (data.billingHistory) setBillingHistory(data.billingHistory);
      if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      notify(data.message ?? "Assinatura atualizada");
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro na assinatura";
      const friendlyMessage = errorMessage.includes("ASAAS_API_KEY")
        ? "A configuração de pagamento ainda não está ativa neste ambiente."
        : errorMessage;
      notify(friendlyMessage);
      return { error: true, message: friendlyMessage };
    }
  }

  function billingDocumentPayload() {
    if (isCpfOrCnpj(agencyBillingDocument)) return {};
    const input = window.prompt("Informe o CPF ou CNPJ para o faturamento:") ?? "";
    if (!isCpfOrCnpj(input)) {
      notify("Informe um CPF ou CNPJ válido para continuar.");
      return null;
    }
    const formattedDocument = formatCpfCnpj(input);
    setAgencyBillingDocument(formattedDocument);
    return { billingDocument: onlyDigits(input) };
  }

  async function billingPaymentAction(action: "payment_link" | "update_payment") {
    const billingPayload = billingDocumentPayload();
    if (!billingPayload) return;
    await billingAction(action, billingPayload);
  }

  async function changePlan(plan: SubscriptionPlan, billingCycle: BillingCycle) {
    const billingPayload = billingDocumentPayload();
    if (!billingPayload) return;
    const planRank: Record<SubscriptionPlan, number> = { start: 0, studio: 1, premium: 2 };
    const downgrade = subscription ? planRank[plan] < planRank[subscription.plan] : false;
    setSubscription((current) => current ? { ...current, plan, billing_cycle: billingCycle, updated_at: new Date().toISOString() } : current);
    await billingAction("change_plan", { plan, billingCycle, applyNextCycle: downgrade, ...billingPayload });
  }

  async function cancelSubscription(reason: string) {
    setSubscription((current) => current ? { ...current, status: "cancelled", cancel_reason: reason, cancelled_at: new Date().toISOString() } : current);
    await billingAction("cancel", { reason });
  }

  async function reactivateSubscription() {
    setSubscription((current) => current ? { ...current, status: "active", cancelled_at: null, suspended_at: null, past_due_since: null } : current);
    await billingAction("reactivate");
  }

  async function movePipeline(postId: string, stage: PipelineStage) {
    const status: Partial<Record<PipelineStage, ContentStatus>> = {
      waiting_client: "awaiting_approval",
      revision: "revision_requested",
      approved: "approved",
      scheduled: "scheduled",
      published: "published"
    };
    await updatePost(postId, { pipeline_stage: stage, ...(status[stage] ? { status: status[stage] } : {}) });
  }

  async function reorderFeed(nextPosts: Post[]) {
    const ordered = nextPosts.map((post, index) => ({ ...post, feed_order: index }));
    setPosts((current) => current.map((post) => ordered.find((item) => item.id === post.id) ?? post));
    if (supabase) {
      const client = supabase;
      const { error } = await (client as any).rpc("reorder_feed_posts", {
        post_ids_input: ordered.map((post) => post.id)
      });
      if (error) {
        const message = error.message.includes("reorder_feed_posts")
          ? "Rode o SQL 20 no Supabase para salvar a ordem do preview."
          : error.message;
        notify(message);
        throw new Error(message);
      }
    }
    notify("Ordem do preview salva");
  }

  async function deletePost(postId: string) {
    if (supabase) {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
    }
    setPosts((current) => current.filter((post) => post.id !== postId));
    setSelectedPost((current) => (current?.id === postId ? null : current));
    notify("Conteúdo removido");
  }

  async function confirmDeletePost(postId: string) {
    setPendingDeletePostId(postId);
  }

  async function updateClient(clientId: string, input: Pick<Client, "name" | "instagram_handle" | "phone" | "brand_color" | "email"> & {
    avatar_file?: File | null;
  }) {
    const avatar = input.avatar_file ? await uploadProfileImage(input.avatar_file, "clients") : undefined;
    const patch: Partial<Client> = {
      name: input.name,
      instagram_handle: input.instagram_handle,
      phone: input.phone,
      email: input.email,
      brand_color: input.brand_color,
      ...(avatar ? { avatar } : {})
    };

    if (supabase) {
      const { error } = await supabase.from("clients").update(patch).eq("id", clientId);
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
    }

    setClients((current) => current.map((client) => (client.id === clientId ? { ...client, ...patch } : client)));
    notify("Cliente atualizado");
  }

  async function deleteClient(clientId: string) {
    if (supabase) {
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
    }
    setClients((current) => current.filter((client) => client.id !== clientId));
    setPosts((current) => current.filter((post) => post.client_id !== clientId));
    if (activeClientId === clientId) setActiveClientId(clients.find((client) => client.id !== clientId)?.id ?? "");
    notify("Cliente removido");
  }

  async function createTeamMember(input: Pick<TeamMember, "name" | "email" | "role_title"> & {
    avatar_file?: File | null;
  }) {
    const memberLimit = getLimit(subscription, "members");
    const activeMembers = teamMembers.filter((member) => member.status !== "inactive").length;
    if (memberLimit !== null && activeMembers >= memberLimit) {
      notify(`Você utilizou ${activeMembers} de ${memberLimit} membros disponíveis no ${getPlanLabel(subscription?.plan)}. Faça upgrade para adicionar mais.`);
      throw new Error("Limite de membros atingido.");
    }

    if (supabase && !profile?.agency_id) {
      notify("Recarregue a página para concluir o vínculo da agência antes de cadastrar equipe.");
      throw new Error("Perfil da agência sem vínculo ativo.");
    }

    const avatar = input.avatar_file ? await uploadProfileImage(input.avatar_file, "team") : null;
    const accessCode = generateInviteCode(input.name);
    const memberEmail = normalizeEmail(input.email);
    const now = new Date().toISOString();
    const nextMember: TeamMember = {
      id: crypto.randomUUID(),
      agency_id: profile?.agency_id ?? "agency-local",
      user_id: null,
      name: input.name,
      email: memberEmail,
      role_title: input.role_title,
      avatar,
      access_code: accessCode,
      status: "invited",
      created_at: now,
      updated_at: now
    };

    if (supabase && profile?.agency_id) {
      const { data, error } = await supabase.from("team_members").insert({
        agency_id: profile.agency_id,
        name: input.name,
        email: memberEmail,
        role_title: input.role_title,
        avatar,
        access_code: accessCode,
        status: "invited"
      }).select().single();
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
      setTeamMembers((current) => [...current, data as TeamMember]);
    } else {
      setTeamMembers((current) => [...current, nextMember]);
    }
    notify("Membro adicionado");
  }

  async function updateTeamMember(input: Pick<TeamMember, "name" | "email" | "role_title"> & {
    id?: string;
    avatar_file?: File | null;
  }) {
    if (!selectedMember) return;
    const avatar = input.avatar_file ? await uploadProfileImage(input.avatar_file, "team") : undefined;
    const patch: Partial<TeamMember> = {
      name: input.name,
      email: normalizeEmail(input.email),
      role_title: input.role_title,
      ...(avatar ? { avatar } : {}),
      updated_at: new Date().toISOString()
    };
    if (supabase) {
      const { error } = await supabase.from("team_members").update(patch).eq("id", selectedMember.id);
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
    }
    setTeamMembers((current) => current.map((member) => member.id === selectedMember.id ? { ...member, ...patch } : member));
    notify("Membro atualizado");
  }

  async function deleteTeamMember(memberId: string) {
    if (supabase) {
      const { error } = await supabase.from("team_members").delete().eq("id", memberId);
      if (error) {
        notify(error.message);
        throw new Error(error.message);
      }
    }
    setTeamMembers((current) => current.filter((member) => member.id !== memberId));
    notify("Membro removido");
  }
}

// ─── FullScreenLoader ────────────────────────────────────────────────────────

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary text-white">
      <div className="flex flex-col items-center gap-4">
        <ReveeLogo tone="light" className="h-7" />
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    </div>
  );
}

function TrialActivationGate({
  agencyName,
  subscription,
  onActivate,
  onLogout
}: {
  agencyName: string;
  subscription: Subscription | null;
  onActivate: (plan: SubscriptionPlan, cycle: BillingCycle) => Promise<any>;
  onLogout: () => Promise<void>;
}) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(subscription?.plan ?? "studio");
  const [cycle, setCycle] = useState<BillingCycle>(subscription?.billing_cycle ?? "monthly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function activate() {
    setBusy(true);
    setMessage("");
    const data = await onActivate(selectedPlan, cycle);
    if (data?.message) {
      setMessage(data.message);
    }
    setBusy(false);
  }

  function annualSaving(plan: SubscriptionPlan) {
    return PLANS[plan].monthlyPrice * 12 - PLANS[plan].annualPrice;
  }

  return (
    <div className="min-h-screen bg-primary px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="text-2xl font-semibold tracking-[-0.04em] text-white">
            Revee<span className="font-bold">Aprove</span>
          </div>
          <button className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/40 hover:text-white" onClick={() => void onLogout()}>
            Sair
          </button>
        </header>

        <main className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[0.92fr_1.08fr]">
          <section>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
              <ShieldCheck className="h-4 w-4" />
              7 dias grátis
            </div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              Ative seu teste para entrar no ReveeAprove.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/70">
              Olá, {agencyName}. Escolha um plano, ative seu teste gratuito e comece a organizar aprovações, clientes e conteúdos em um só lugar.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-white/78 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Ativação segura</div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Cobrança só após 7 dias</div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Cancele quando quiser</div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white p-4 text-primary shadow-modal sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">Escolha seu plano</h2>
                <p className="mt-1 text-sm text-muted">Você pode trocar depois em Minha assinatura.</p>
              </div>
              <div className="inline-flex rounded-full border border-line bg-canvas p-1">
                {(["monthly", "annual"] as BillingCycle[]).map((item) => (
                  <button
                    key={item}
                    className={cn("rounded-full px-4 py-2 text-xs font-semibold transition", cycle === item ? "bg-white text-primary shadow-soft" : "text-muted")}
                    onClick={() => setCycle(item)}
                  >
                    {item === "monthly" ? "Mensal" : "Anual"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {(Object.keys(PLANS) as SubscriptionPlan[]).map((plan) => {
                const config = PLANS[plan];
                const selected = selectedPlan === plan;
                return (
                  <button
                    key={plan}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition hover:border-accent",
                      selected ? "border-accent bg-accent-light/40 shadow-soft" : "border-line bg-white"
                    )}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          {config.name}
                          {plan === "premium" && <Crown className="h-4 w-4 text-accent-dark" />}
                          {cycle === "annual" && (
                            <span className="rounded-full bg-[#e9f7f0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#2f7a5c]">
                              Economize {formatCurrency(annualSaving(plan))}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted">
                          {config.clientLimit === null ? "Clientes ilimitados" : `Até ${config.clientLimit} clientes`} · {config.memberLimit ? `até ${config.memberLimit} membros` : "sem membros"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">{formatCurrency(getPlanPrice(plan, cycle))}</div>
                        <div className="text-xs text-muted">
                          {cycle === "annual" ? `${formatCurrency(getPlanPrice(plan, cycle) / 12)}/mês no anual` : "por mês"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {message && <div className="mt-4 rounded-xl bg-accent-light px-4 py-3 text-sm font-medium text-accent-dark">{message}</div>}

            <button
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#2d1870] disabled:cursor-not-allowed disabled:opacity-70"
              onClick={() => void activate()}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Começar teste grátis
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-muted">
              Seus 7 dias grátis começam agora. A primeira cobrança fica programada para depois do teste.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

// ─── AuthPanel ───────────────────────────────────────────────────────────────
// Fluxo de cliente: coloca e-mail + código de convite + senha nova

function AuthPanel({ mode, setMode, onLocalAccess }: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  onLocalAccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [agencyNameInput, setAgencyNameInput] = useState("");
  const [billingDocument, setBillingDocument] = useState("");
  const [role, setRole] = useState<"agency" | "member" | "client">("agency");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const confirmed = params.get("confirmed");
    const authError = params.get("auth_error");
    if (ref) {
      setMode("signup");
      setRole("agency");
      setInviteCode(ref);
    }
    if (confirmed) {
      setMode("login");
      setMessage("E-mail confirmado. Agora é só entrar com sua senha.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (authError) {
      setMode("login");
      setMessage("Não conseguimos confirmar esse link. Peça um novo e tente outra vez.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setMode]);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      if (!supabase) {
        onLocalAccess();
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMessage(error.message);
        return;
      }

      if (mode === "signup") {
        if (role === "client" || role === "member") {
          // ── Fluxo cliente: validar código + e-mail antes de criar conta ──
          if (!inviteCode.trim()) {
            setMessage("Insira o código que sua agência enviou.");
            return;
          }

          if (role === "member") {
            const { data: memberInvite, error: memberErr } = await supabase
              .rpc("get_member_invite", {
                access_code_input: normalizeInviteCode(inviteCode),
                email_input: normalizeEmail(email)
              })
              .single();
            const memberRow = memberInvite as MemberInvite | null;

            if (memberErr || !memberRow) {
              setMessage("Código de equipe inválido ou e-mail diferente do convite.");
              return;
            }

            const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
              email: normalizeEmail(email),
              password,
              options: {
                data: {
                  name: name || memberRow.name,
                  role: "member",
                  agency_id: memberRow.agency_id,
                  team_member_id: memberRow.id
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`
              }
            });

            if (signUpErr) {
              setMessage(signUpErr.message);
              return;
            }

            if (signUpData.user) {
              await supabase.from("users").upsert({
                id: signUpData.user.id,
                name: name || memberRow.name,
                email: normalizeEmail(email),
                role: "member",
                avatar: memberRow.avatar ?? null,
                agency_id: memberRow.agency_id,
                client_id: null
              });
              await supabase.from("team_members").update({ user_id: signUpData.user.id, status: "active" }).eq("id", memberRow.id);
            }

            setMessage("Conta criada! Verifique seu e-mail para confirmar o acesso.");
            return;
          }

          const { data: clientInvite, error: clientErr } = await supabase
            .rpc("get_client_invite", {
              invite_code_input: normalizeInviteCode(inviteCode),
              email_input: normalizeEmail(email)
            })
            .single();
          const clientRow = clientInvite as ClientInvite | null;

          if (clientErr || !clientRow) {
            setMessage("Código de convite inválido. Confira se copiou o código completo enviado pela agência.");
            return;
          }

          // Cria a conta no Auth
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: normalizeEmail(email),
            password,
            options: {
              data: {
                name: name || clientRow.name,
                role: "client",
                client_id: clientRow.id,
                agency_id: clientRow.agency_id
              },
              emailRedirectTo: `${window.location.origin}/auth/callback`
            }
          });

          if (signUpErr) {
            setMessage(signUpErr.message);
            return;
          }

          if (signUpData.user) {
            await supabase.from("users").upsert({
              id: signUpData.user.id,
              name: name || clientRow.name,
              email: normalizeEmail(email),
              role: "client",
              avatar: null,
              agency_id: clientRow.agency_id,
              client_id: clientRow.id
            });
          }

          setMessage("Conta criada! Verifique seu e-mail para confirmar o acesso.");
          return;
        }

        // ── Fluxo agência ──
        if (!isCpfOrCnpj(billingDocument)) {
          setMessage("Informe um CPF ou CNPJ válido para o faturamento.");
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: normalizeEmail(email),
          password,
          options: {
            data: {
              name,
              role: "agency",
              agency_name: agencyNameInput || name,
              billing_document: onlyDigits(billingDocument),
              referral_code: inviteCode.trim() || null
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
        setMessage(error ? error.message : "Enviamos a confirmação para o seu e-mail.");
        return;
      }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}?reset=true`
        });
        setMessage(error ? error.message : "Link de recuperação enviado.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[430px] rounded-[22px] bg-white p-7 shadow-modal sm:p-9"
      >
        <ReveeLogo className="mb-2 h-7 max-w-[210px] object-contain" />
        <p className="mb-6 text-xs font-medium tracking-[0.02em] text-muted">
          Plataforma de aprovação de conteúdo
        </p>

        {/* Tabs Entrar / Cadastro */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-line bg-canvas p-1">
          <button
            className={cn("rounded-md px-3 py-2 text-xs font-semibold", mode === "login" && "bg-white text-primary shadow-soft")}
            onClick={() => setMode("login")}
          >
            Entrar
          </button>
          <button
            className={cn("rounded-md px-3 py-2 text-xs font-semibold", mode === "signup" && "bg-white text-primary shadow-soft")}
            onClick={() => setMode("signup")}
          >
            Cadastro
          </button>
        </div>

        {/* Seletor agência / cliente / equipe */}
        {mode === "signup" && (
          <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg border border-line bg-canvas p-1">
            <button
              className={cn("rounded-md px-3 py-2 text-xs font-semibold", role === "agency" && "bg-white text-primary shadow-soft")}
              onClick={() => setRole("agency")}
            >
              Sou agência
            </button>
            <button
              className={cn("rounded-md px-3 py-2 text-xs font-semibold", role === "client" && "bg-white text-primary shadow-soft")}
              onClick={() => setRole("client")}
            >
              Sou cliente
            </button>
            <button
              className={cn("rounded-md px-3 py-2 text-xs font-semibold", role === "member" && "bg-white text-primary shadow-soft")}
              onClick={() => setRole("member")}
            >
              Sou equipe
            </button>
          </div>
        )}

        {/* Campos dinâmicos por fluxo */}
        {mode === "signup" && role === "agency" && (
          <>
            <Field label="Seu nome" value={name} onChange={setName} placeholder="Seu nome" />
            <Field label="Nome da agência" value={agencyNameInput} onChange={setAgencyNameInput} placeholder="Nome que aparecerá na plataforma" />
            <Field
              label="CPF ou CNPJ"
              value={billingDocument}
              onChange={(value) => setBillingDocument(formatCpfCnpj(value))}
              placeholder="Para emissão e pagamento"
              inputMode="numeric"
            />
            <Field label="Código de indicação ou convite" value={inviteCode} onChange={setInviteCode} placeholder="Opcional" />
          </>
        )}

        {mode === "signup" && (role === "client" || role === "member") && (
          <>
            <Field label="Seu nome" value={name} onChange={setName} placeholder="Como você quer ser chamado" />
            <Field label="Código de convite" value={inviteCode} onChange={setInviteCode} placeholder="Ex: CAS-AB12CD" />
            <div className="mb-3 rounded-lg bg-[#f0e4f9] px-3 py-2 text-xs leading-5 text-[#6a30a0]">
              Sua agência gerou este código ao cadastrar você. Cole aqui para vincular sua conta.
            </div>
          </>
        )}

        <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />

        {mode !== "forgot" && (
          <Field label="Senha" type="password" value={password} onChange={setPassword} placeholder="Mínimo 8 caracteres" />
        )}

        {mode === "login" && (
          <button
            className="mb-3 text-xs font-semibold text-accent-dark hover:text-primary"
            onClick={() => setMode("forgot")}
          >
            Esqueci minha senha
          </button>
        )}

        {message && (
          <div className="mb-3 rounded-lg bg-accent-light px-3 py-2 text-xs font-medium text-accent-dark">
            {message}
          </div>
        )}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d1870]"
          onClick={submit}
          disabled={busy}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signup" ? "Criar conta" : mode === "forgot" ? "Enviar recuperação" : "Entrar"}
        </button>

        {!isSupabaseConfigured && (
          <p className="mt-4 text-center text-[11px] leading-5 text-muted">
            Configure o ambiente para habilitar autenticação em produção.
          </p>
        )}
      </motion.div>
    </div>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  inputMode,
  readOnly
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "search" | "email" | "url";
  readOnly?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</span>
      <div className="relative">
        <input
          type={isPassword && showPassword ? "text" : type}
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          readOnly={readOnly}
          className={cn(
            "premium-input w-full rounded-xl border border-border-mid bg-white px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15",
            isPassword && "pr-11",
            readOnly && "bg-[#fbfbfb] text-muted"
          )}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-accent-light hover:text-primary"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>
    </label>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ label, value, hint, icon: Icon, onClick }: {
  label: string;
  value: string | number;
  hint: string;
  icon: ElementType;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="premium-card premium-card-hover w-full rounded-[16px] p-3 text-left transition hover:-translate-y-0.5 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] text-muted sm:text-xs">{label}</div>
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent-light text-accent-dark sm:h-8 sm:w-8">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-light tracking-[-0.03em] sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </Component>
  );
}

function AgencyHero({
  workspace,
  isClient,
  profileRole,
  notifications,
  onClearNotifications,
  onOpenMobileSidebar,
  onOpenNotification,
  onViewProfile
}: {
  workspace: AgencyWorkspace;
  isClient: boolean;
  profileRole: Profile["role"];
  notifications: NotificationItem[];
  onClearNotifications: () => void;
  onOpenMobileSidebar: () => void;
  onOpenNotification: (item: NotificationItem) => void;
  onViewProfile: () => void;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const avatarStyle = workspace.avatar ? {
    objectPosition: `${workspace.avatarPositionX ?? 50}% ${workspace.avatarPositionY ?? 50}%`,
    transform: `scale(${workspace.avatarZoom ?? 1})`
  } : undefined;
  return (
    <section className="overflow-hidden border-b border-line bg-white shadow-soft">
      <div className="relative min-h-[176px] sm:min-h-[230px] lg:min-h-[184px]">
        <img
          src={workspace.banner || "/default-agency-cover.png"}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `center ${workspace.bannerPosition ?? 50}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/76 via-primary/28 to-black/18" />
        <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between lg:hidden">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/18 text-white shadow-soft ring-1 ring-white/25 backdrop-blur"
            onClick={onOpenMobileSidebar}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative">
            <button
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-black/18 text-white shadow-soft ring-1 ring-white/25 backdrop-blur"
              onClick={() => setNotificationsOpen((current) => !current)}
              aria-label="Abrir notificações"
            >
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                  {Math.min(notifications.length, 9)}
                </span>
              )}
            </button>
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  className="fixed left-3 right-3 top-[72px] z-[90] max-h-[56vh] overflow-hidden rounded-2xl border border-line bg-white p-2 text-primary shadow-modal sm:left-auto sm:right-5 sm:top-20 sm:w-[360px]"
                >
                  <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-2">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Notificações</div>
                      {!!notifications.length && <div className="mt-0.5 text-[10px] font-semibold text-accent-dark">Recentes</div>}
                    </div>
                    {!!notifications.length && (
                      <button
                        className="rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-semibold text-accent-dark hover:bg-[#ead8f7]"
                        onClick={onClearNotifications}
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="max-h-[calc(56vh-62px)] overflow-y-auto">
                    {notifications.length ? notifications.map((item) => (
                      <button
                        key={item.id}
                        className="group relative block w-full rounded-xl px-3 py-3 text-left transition hover:bg-accent-light/50"
                        onClick={() => {
                          onOpenNotification(item);
                          setNotificationsOpen(false);
                        }}
                      >
                        <span className="absolute left-1 top-4 h-2 w-2 rounded-full bg-accent opacity-70" />
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="mt-1 text-xs leading-5 text-muted">{item.detail}</div>
                        <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-dark">{item.time}</div>
                      </button>
                    )) : (
                      <div className="soft-panel rounded-xl px-4 py-7 text-center text-sm font-semibold text-primary">Tudo em ordem</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="relative flex min-h-[176px] flex-col items-center justify-center px-4 pb-4 pt-16 text-center sm:min-h-[230px] sm:px-6 lg:min-h-[184px] lg:items-stretch lg:justify-end lg:px-8 lg:pb-5 lg:text-left">
          <button
            type="button"
            className="group flex max-w-full flex-col items-center gap-3 text-white lg:flex-row lg:items-end lg:text-left"
            onClick={onViewProfile}
          >
          <span
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white/18 text-sm font-semibold text-white shadow-soft ring-1 ring-white/35 backdrop-blur transition group-hover:scale-[1.02] sm:h-16 sm:w-16 lg:h-14 lg:w-14 lg:text-sm"
            style={{ background: workspace.avatar ? "rgba(255,255,255,0.16)" : workspace.brandColor }}
          >
            {workspace.avatar ? <img src={workspace.avatar} alt="" className="h-full w-full object-cover" style={avatarStyle} /> : initials(workspace.name)}
          </span>
          <span className="min-w-0 text-white">
            <span className="block truncate text-lg font-semibold tracking-[-0.02em] sm:text-2xl lg:text-xl">{workspace.name}</span>
            {workspace.description && <p className="mt-0.5 hidden max-w-3xl text-sm leading-6 text-white/82 sm:block">{workspace.description}</p>}
          </span>
          </button>
          <button
            className="absolute bottom-5 right-6 hidden rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-primary shadow-soft transition hover:-translate-y-0.5 lg:block"
            onClick={onViewProfile}
          >
            {isClient ? "Ver perfil da agência" : profileRole === "member" ? "Meu perfil" : "Meu perfil"}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── CalendarView ────────────────────────────────────────────────────────────

function CalendarView({
  posts,
  campaigns,
  stats,
  monthFilter,
  isClient,
  onOpenPost,
  onOpenCampaign,
  onNewPost,
  onMovePost,
  onStatusFilter
}: {
  posts: Post[];
  campaigns: Campaign[];
  stats: { totalPosts: number; totalCampaigns: number; contentAwaiting: number; contentRevision: number; activeCampaigns: number; campaignAwaiting: number; campaignRevision: number };
  monthFilter: string;
  isClient: boolean;
  onOpenPost: (post: Post) => void;
  onOpenCampaign: (campaign: Campaign) => void;
  onNewPost: (date?: string) => void;
  onMovePost: (postId: string, date: string) => void;
  onStatusFilter: (status: StatusFilter) => void;
}) {
  const [date, setDate] = useState(() => {
    const key = monthFilter === "all" ? new Date().toISOString().slice(0, 7) : monthFilter;
    return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
  });
  useEffect(() => {
    if (monthFilter === "all") return;
    setDate(new Date(Number(monthFilter.slice(0, 4)), Number(monthFilter.slice(5, 7)) - 1, 1));
  }, [monthFilter]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = [
    ...Array.from({ length: firstDay }, (_, index) => ({ day: index, muted: true, iso: "" })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return {
        day,
        muted: false,
        iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      };
    })
  ];

  function handleDragEnd(event: DragEndEvent) {
    if (isClient) return;
    const postId = String(event.active.id);
    const targetDate = event.over?.id ? String(event.over.id) : "";
    if (targetDate) onMovePost(postId, targetDate);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Posts ao todo" value={stats.totalPosts} hint="conteúdos no mês" icon={CalendarDays} onClick={() => onStatusFilter("all")} />
        <StatCard label="Conteúdos aguardando aprovação" value={stats.contentAwaiting} hint="pendentes do cliente" icon={Clock} onClick={() => onStatusFilter("awaiting_approval")} />
        <StatCard label="Conteúdos em revisão" value={stats.contentRevision} hint="precisam de ajuste" icon={RefreshCw} onClick={() => onStatusFilter("revision_requested")} />
        <StatCard label="Campanhas ao todo" value={stats.totalCampaigns} hint="tráfego no mês" icon={Megaphone} />
        <StatCard label="Campanhas aguardando aprovação" value={stats.campaignAwaiting} hint="pendentes do cliente" icon={ShieldCheck} />
        <StatCard label="Campanhas ativas" value={stats.activeCampaigns} hint="rodando agora" icon={Check} />
      </div>
      <div className="premium-card overflow-hidden rounded-[18px]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <button
            className="rounded-xl border border-line p-2 text-muted hover:bg-accent-light hover:text-primary"
            onClick={() => setDate(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold tracking-[-0.01em]">{months[month]} {year}</div>
          <button
            className="rounded-xl border border-line p-2 text-muted hover:bg-accent-light hover:text-primary"
            onClick={() => setDate(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="glass-scroll overflow-x-hidden lg:overflow-x-auto">
            <div className="min-w-0 lg:min-w-[980px] 2xl:min-w-0">
          <div className="grid grid-cols-7 bg-primary text-center text-[10px] font-bold uppercase tracking-0 text-white sm:text-[10px] sm:tracking-[0.12em] sm:text-white/75">
            {[
              ["D", "Dom"],
              ["S", "Seg"],
              ["T", "Ter"],
              ["Q", "Qua"],
              ["Q", "Qui"],
              ["S", "Sex"],
              ["S", "Sáb"]
            ].map(([shortDay, longDay]) => (
              <div className="flex h-9 items-center justify-center px-1" key={longDay}>
                <span className="sm:hidden">{shortDay}</span>
                <span className="hidden sm:inline">{longDay}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, index) => (
              <CalendarCell
                key={`${cell.iso || index}`}
                cell={cell}
                posts={posts.filter((post) => post.scheduled_date === cell.iso)}
                campaigns={campaigns.filter((campaign) => campaign.start_date === cell.iso)}
                isClient={isClient}
                onOpenPost={onOpenPost}
                onOpenCampaign={onOpenCampaign}
                onNewPost={() => onNewPost(cell.iso)}
              />
            ))}
          </div>
            </div>
          </div>
        </DndContext>
      </div>
    </div>
  );
}

function CalendarCell({
  cell,
  posts,
  campaigns,
  isClient,
  onOpenPost,
  onOpenCampaign,
  onNewPost
}: {
  cell: { day: number; muted: boolean; iso: string };
  posts: Post[];
  campaigns: Campaign[];
  isClient: boolean;
  onOpenPost: (post: Post) => void;
  onOpenCampaign: (campaign: Campaign) => void;
  onNewPost: () => void;
}) {
  const { setNodeRef } = useSortable({ id: cell.iso || `empty-${cell.day}`, disabled: !cell.iso });
  if (cell.muted) return <div className="min-h-[112px] border-b border-r border-line bg-[#f7f7f7]/70 sm:min-h-[150px] xl:min-h-[190px]" />;
  const hasAttention = posts.some((post) => getDueSignal(post)?.tone === "danger");
  const isToday = cell.iso === getLocalDateKey();
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative min-h-[112px] border-b border-r border-line bg-white p-1.5 transition hover:bg-[#fafafe] sm:min-h-[150px] sm:p-3 xl:min-h-[190px] xl:p-3.5",
        hasAttention && "calendar-cell-attention"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between sm:mb-2">
        <div className="flex items-center gap-1.5">
          {!isClient ? (
            <button
              onClick={onNewPost}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-primary hover:bg-accent-light sm:h-7 sm:w-7 sm:text-xs",
                isToday && "bg-primary text-white shadow-soft hover:bg-primary"
              )}
              title="Criar conteúdo nesta data"
            >
              {cell.day}
            </button>
          ) : (
            <span className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-primary sm:h-7 sm:w-7 sm:text-xs",
              isToday && "bg-primary text-white shadow-soft"
            )}>
              {cell.day}
            </span>
          )}
        </div>
        {!isClient && (
          <button
            onClick={onNewPost}
            className="hidden h-7 w-7 items-center justify-center rounded-full bg-accent text-white shadow-soft group-hover:flex"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-1.5 sm:space-y-2">
        {campaigns.map((campaign) => <CalendarCampaign key={campaign.id} campaign={campaign} onClick={() => onOpenCampaign(campaign)} />)}
        {posts.map((post) => <CalendarPost key={post.id} post={post} isClient={isClient} onClick={() => onOpenPost(post)} />)}
      </div>
    </div>
  );
}

function CalendarCampaign({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  const meta = campaignStatusMeta[campaign.status];
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-accent/25 bg-accent-light/70 px-1.5 py-2 text-left text-[9px] font-semibold text-accent-dark shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)] transition hover:-translate-y-0.5 hover:shadow-soft sm:rounded-xl sm:px-3 sm:py-3 sm:text-[11px]"
    >
      <span className="flex items-start gap-2">
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full sm:mt-1.5 sm:h-2 sm:w-2" style={{ background: meta.color }} />
        <span className="line-clamp-2 min-w-0 flex-1 leading-3 sm:leading-4">{campaign.title}</span>
      </span>
      <span className="mt-1.5 flex items-center text-[9px] font-semibold uppercase tracking-0 opacity-80 sm:mt-2 sm:text-[10px]">
        <span className="truncate rounded-full bg-white/55 px-1.5 py-0.5 text-[8px] sm:px-2 sm:text-[9px]">Campanha</span>
      </span>
    </button>
  );
}

function CalendarPost({ post, isClient, onClick }: { post: Post; isClient: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: post.id, disabled: isClient });
  const meta = statusMeta[post.status];
  const formatBadge = getPostFormatBadge(post);
  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, background: meta.bg, color: meta.color }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="calendar-post-pill group/post w-full rounded-lg px-1.5 py-2 text-left text-[9px] font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.44)] transition hover:-translate-y-0.5 hover:shadow-soft sm:rounded-xl sm:px-3 sm:py-3 sm:text-[11px]"
    >
      <span className="flex items-start gap-2">
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full sm:mt-1.5 sm:h-2 sm:w-2" style={{ background: meta.color }} />
        <span className="line-clamp-2 min-w-0 flex-1 leading-3 sm:leading-4">{post.title}</span>
      </span>
      <span className="mt-1.5 grid grid-cols-1 items-start gap-1 text-[8px] font-semibold uppercase tracking-0 opacity-80 sm:mt-2 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-1.5 sm:text-[10px]">
        <span>{formatCompactTime(post.scheduled_time)}</span>
        <span className="max-w-full justify-self-start truncate rounded-full bg-white/45 px-1.5 py-0.5 text-[7px] sm:max-w-[82px] sm:justify-self-end sm:px-2 sm:text-[9px]">{formatBadge}</span>
      </span>
    </button>
  );
}

// ─── PipelineView ────────────────────────────────────────────────────────────

function PipelineView({
  posts,
  campaigns,
  isClient,
  onOpenPost,
  onOpenCampaign,
  onMove
}: {
  posts: Post[];
  campaigns: Campaign[];
  isClient: boolean;
  onOpenPost: (post: Post) => void;
  onOpenCampaign: (campaign: Campaign) => void;
  onMove: (postId: string, stage: PipelineStage) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  function handleDragEnd(event: DragEndEvent) {
    const postId = String(event.active.id);
    const stage = event.over?.id as PipelineStage | undefined;
    if (!isClient && stage && pipelineMeta[stage]) onMove(postId, stage);
  }
  const stages = Object.keys(pipelineColumnMeta) as PipelineColumnStage[];
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {stages.map((stage) => (
          <PipelineColumn
            key={stage}
            stage={stage}
            posts={"campaign_active" === stage ? [] : posts.filter((post) => stageForPost(post) === stage)}
            campaigns={campaigns.filter((campaign) => campaignStage(campaign.status) === stage)}
            isClient={isClient}
            onOpenPost={onOpenPost}
            onOpenCampaign={onOpenCampaign}
          />
        ))}
      </div>
    </DndContext>
  );
}

function PipelineColumn({
  stage,
  posts,
  campaigns,
  isClient,
  onOpenPost,
  onOpenCampaign
}: {
  stage: PipelineColumnStage;
  posts: Post[];
  campaigns: Campaign[];
  isClient: boolean;
  onOpenPost: (post: Post) => void;
  onOpenCampaign: (campaign: Campaign) => void;
}) {
  const { setNodeRef } = useSortable({ id: stage });
  const style = pipelineColumnStyle[stage];
  return (
    <div ref={setNodeRef} className="premium-card min-h-[340px] rounded-[18px] p-3">
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: style.accent }} />
            <h3 className="truncate text-sm font-semibold">{pipelineColumnMeta[stage].label}</h3>
          </div>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: style.bg, color: style.accent }}>
            {posts.length + campaigns.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">{pipelineColumnMeta[stage].description}</p>
      </div>
      <SortableContext items={posts.map((post) => post.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5">
          {campaigns.map((campaign) => <CampaignPipelineCard key={campaign.id} campaign={campaign} onClick={() => onOpenCampaign(campaign)} />)}
          {posts.map((post) => <PipelineCard key={post.id} post={post} isClient={isClient} onClick={() => onOpenPost(post)} />)}
          {!posts.length && !campaigns.length && (
            <div className="soft-panel rounded-xl px-3 py-6 text-center text-xs leading-5 text-muted">
              Nenhum conteúdo nesta etapa.
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function CampaignPipelineCard({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  const meta = campaignStatusMeta[campaign.status];
  return (
    <button
      onClick={onClick}
      className="premium-card-hover w-full rounded-xl border border-accent/25 bg-accent-light/45 p-3 text-left"
    >
      <div className="mb-2 flex items-start gap-2">
        <Megaphone className="mt-0.5 h-3.5 w-3.5 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-accent-dark">Campanha</span>
          </div>
          <div className="mt-1 truncate text-sm font-semibold">{campaign.title}</div>
          <div className="mt-1 text-xs text-muted">{campaign.platform} · {getCampaignPeriod(campaign)}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
        {campaign.daily_budget ? <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-muted">{formatCurrency(campaign.daily_budget)}/dia</span> : null}
      </div>
      <div className="mt-3 grid gap-1.5 text-[11px] leading-4 text-muted">
        <span>{campaign.responsible_name || "Responsavel nao informado"}</span>
        {campaign.audience && <span className="line-clamp-2">{campaign.audience}</span>}
      </div>
    </button>
  );
}

function PipelineCard({ post, isClient, onClick }: { post: Post; isClient: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: post.id, disabled: isClient });
  const signal = getDueSignal(post);
  const revisions = post.status === "revision_requested" ? 1 : 0;
  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="premium-card-hover w-full rounded-xl border border-line bg-[#fbfbfb] p-3 text-left"
    >
      <div className="mb-2 flex items-start gap-2">
        <Move className="mt-0.5 h-3.5 w-3.5 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{post.title}</div>
          <div className="mt-1 text-xs text-muted">{formatDate(post.scheduled_date)} {post.scheduled_time}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={post.status} />
        <span className="rounded-full bg-accent-light px-2 py-1 text-[10px] font-semibold text-accent-dark">{getPostTypeLabel(post)}</span>
      </div>
      <div className="mt-3 grid gap-1.5 text-[11px] leading-4 text-muted">
        <span>Última alteração {relativeTimeFrom(post.created_at)}</span>
        <span>{post.status === "revision_requested" ? "Cliente pediu ajuste" : "Movimento mais recente da agência"}</span>
        {signal && <span className={cn("font-semibold", signal.tone === "danger" ? "text-danger" : "text-accent-dark")}>{signal.label}</span>}
        {revisions > 0 && <span>{revisions} revisão solicitada</span>}
      </div>
    </button>
  );
}

// ─── ContentsView ────────────────────────────────────────────────────────────

function ContentsView({
  posts,
  onOpenPost,
  onDelete,
  canDelete
}: {
  posts: Post[];
  onOpenPost: (post: Post) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}) {
  if (!posts.length) return (
    <EmptyState
      title="Nenhum conteúdo cadastrado"
      description="Crie o primeiro conteúdo para começar o fluxo de aprovação."
    />
  );
  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <div
          key={post.id}
          className="premium-card premium-card-hover flex flex-wrap items-center gap-3 rounded-[16px] p-3 sm:flex-nowrap"
        >
          <button onClick={() => onOpenPost(post)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <MediaThumb post={post} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{post.title}</div>
              <div className="mt-1 text-xs text-muted">
                {formatDate(post.scheduled_date)} · {post.scheduled_time || "--:--"}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-accent-dark">{getPostTypeLabel(post)} · {relativeTimeFrom(post.created_at)}</div>
            </div>
          </button>
          <div className="ml-[60px] flex w-[calc(100%-60px)] items-center justify-between gap-2 sm:ml-0 sm:w-auto">
            <StatusPill status={post.status} />
            {canDelete && (
              <button
                className="rounded-lg p-2 text-muted hover:bg-red-light hover:text-danger"
                onClick={() => onDelete(post.id)}
                title="Excluir conteúdo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ClientsView ─────────────────────────────────────────────────────────────

function ClientsView({
  clients,
  posts,
  activeClientId,
  onSelect,
  onNewClient,
  onDelete
}: {
  clients: Client[];
  posts: Post[];
  activeClientId: string;
  onSelect: (client: Client) => void;
  onNewClient: () => void;
  onDelete: (id: string) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyCode(code: string, clientId: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedId(clientId);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {clients.map((client) => {
        const clientPosts = posts.filter((post) => post.client_id === client.id);
        return (
          <div
            key={client.id}
            className={cn(
              "premium-card premium-card-hover rounded-[18px] p-4",
              activeClientId === client.id ? "border-accent" : "border-line"
            )}
          >
            <button className="mb-4 flex w-full items-center gap-3 text-left" onClick={() => onSelect(client)}>
              <div
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
                style={{ background: client.brand_color || "#170b43" }}
              >
                {client.avatar
                  ? <img src={client.avatar} alt="" className="h-full w-full object-cover" />
                  : initials(client.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{client.name}</div>
                <div className="text-xs text-muted">
                  @{toInstagramHandle(client.name, client.instagram_handle)}
                </div>
              </div>
              <ChevronsUpDown className="ml-auto h-4 w-4 text-muted" />
            </button>

            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniMetric label="Posts" value={clientPosts.length} />
              <MiniMetric label="Aprovados" value={clientPosts.filter((post) => post.status === "approved").length} />
              <MiniMetric label="Revisão" value={clientPosts.filter((post) => post.status === "revision_requested").length} />
            </div>

            {/* Código de convite */}
            {client.invite_code && (
              <div className="mt-4 rounded-lg border border-dashed border-accent/40 bg-accent-light/40 px-3 py-2.5">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  Código de acesso do cliente
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 break-all font-mono text-sm font-semibold text-primary">{client.invite_code}</span>
                  <button
                    className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-accent-dark shadow-soft transition hover:bg-accent-light"
                    onClick={() => copyCode(client.invite_code!, client.id)}
                  >
                    {copiedId === client.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedId === client.id ? "Copiado" : "Copiar"}
                  </button>
                </div>
                {client.email && (
                  <div className="mt-1 text-[11px] text-muted">
                    E-mail vinculado: {client.email}
                  </div>
                )}
              </div>
            )}

            <button
              className="mt-4 text-xs font-semibold text-danger hover:underline"
              onClick={() => onDelete(client.id)}
            >
              Excluir cliente
            </button>
          </div>
        );
      })}
      <button
        onClick={onNewClient}
        className="soft-panel premium-card-hover flex min-h-[205px] flex-col items-center justify-center gap-3 rounded-[18px] border-dashed p-4 text-sm font-semibold text-accent-dark"
      >
        <Plus className="h-5 w-5" />
        Adicionar cliente
      </button>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f7f7f7] px-2 py-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

function getTeamMemberStatus(member: TeamMember) {
  if (member.status === "active" || member.user_id) {
    return {
      label: "Ativo",
      hint: "Conta vinculada",
      className: "bg-success/10 text-success"
    };
  }

  if (member.status === "inactive") {
    return {
      label: "Inativo",
      hint: "Acesso pausado",
      className: "bg-danger/10 text-danger"
    };
  }

  return {
    label: "Convite enviado",
    hint: "Aguardando cadastro",
    className: "bg-accent-light text-accent-dark"
  };
}

function TeamView({
  members,
  posts,
  onNewMember,
  onEditMember,
  onDeleteMember
}: {
  members: TeamMember[];
  posts: Post[];
  onNewMember: () => void;
  onEditMember: (member: TeamMember) => void;
  onDeleteMember: (id: string) => void;
}) {
  const invitedCount = members.filter((member) => member.status === "invited" && !member.user_id).length;
  const activeCount = members.filter((member) => member.status === "active" || member.user_id).length;

  function copyInviteCode(member: TeamMember) {
    navigator.clipboard.writeText(member.access_code).catch(() => {});
  }

  return (
    <div className="space-y-4">
      <div className="premium-card flex flex-wrap items-center justify-between gap-3 rounded-[18px] p-4 sm:p-5">
        <div>
          <div className="text-lg font-semibold tracking-[-0.02em]">Equipe</div>
          <div className="mt-1 text-sm text-muted">
            {activeCount} ativo{activeCount === 1 ? "" : "s"} · {invitedCount} convite{invitedCount === 1 ? "" : "s"} aguardando cadastro
          </div>
        </div>
        <button className="premium-button inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white sm:w-auto" onClick={onNewMember}>
          <UserPlus className="h-4 w-4" />
          Adicionar membro
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => {
          const assignedCount = posts.filter((post) =>
            `${post.instructions ?? ""} ${post.caption ?? ""}`.toLowerCase().includes(member.name.toLowerCase())
          ).length;
          const status = getTeamMemberStatus(member);
          return (
            <div key={member.id} className="premium-card premium-card-hover rounded-[18px] p-4">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-white">
                  {member.avatar ? <img src={member.avatar} alt="" className="h-full w-full object-cover" /> : initials(member.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{member.name}</div>
                  <div className="truncate text-xs text-muted">{member.email}</div>
                  <div className="mt-1 text-[11px] font-semibold text-accent-dark">{member.role_title}</div>
                </div>
                <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", status.className)}>
                  {status.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <MiniMetric label="Conteúdos" value={assignedCount} />
                <div className="rounded-xl bg-[#f7f7f7] px-2 py-3">
                  <div className="truncate text-xs font-semibold text-primary">{status.hint}</div>
                  <div className="text-[10px] text-muted">Status</div>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-accent/40 bg-accent-light/40 px-3 py-2.5">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Convite de acesso</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 break-all font-mono text-sm font-semibold text-primary">{member.access_code}</span>
                  <button
                    className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-accent-dark shadow-soft transition hover:bg-accent-light"
                    onClick={() => copyInviteCode(member)}
                  >
                    <Copy className="h-3 w-3" />
                    Copiar código
                  </button>
                </div>
                {member.status === "invited" && !member.user_id && (
                  <div className="mt-2 text-[11px] leading-4 text-muted">
                    Envie este convite para o membro se cadastrar com o mesmo e-mail.
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button className="text-xs font-semibold text-accent-dark hover:underline" onClick={() => onEditMember(member)}>Editar</button>
                <button className="text-xs font-semibold text-danger hover:underline" onClick={() => onDeleteMember(member.id)}>Remover</button>
              </div>
            </div>
          );
        })}
        <button
          onClick={onNewMember}
          className="soft-panel premium-card-hover flex min-h-[245px] flex-col items-center justify-center gap-3 rounded-[18px] border-dashed p-4 text-sm font-semibold text-accent-dark"
        >
          <UserPlus className="h-5 w-5" />
          Adicionar membro
        </button>
      </div>
    </div>
  );
}

function AvatarPicker({
  name,
  currentAvatar,
  color,
  onFile,
  label = "Foto do cliente"
}: {
  name: string;
  currentAvatar?: string | null;
  color?: string | null;
  onFile: (file: File | null) => void;
  label?: string;
}) {
  const [preview, setPreview] = useState(currentAvatar ?? "");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!sourceFile) setPreview(currentAvatar ?? "");
  }, [currentAvatar, sourceFile]);

  async function updateCropped(file: File, nextZoom: number) {
    onFile(await cropAvatarFile(file, nextZoom));
  }

  return (
    <div className="mb-5 flex gap-4">
      <label
        className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white ring-1 ring-line"
        style={{ background: color || "#170b43" }}
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" style={{ transform: sourceFile ? `scale(${zoom})` : undefined }} />
        ) : initials(name || "Cliente")}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0] ?? null;
            setSourceFile(file);
            setZoom(1);
            onFile(file);
            setPreview(file ? URL.createObjectURL(file) : currentAvatar ?? "");
            if (file) await updateCropped(file, 1);
          }}
        />
      </label>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-1 text-xs leading-5 text-muted">Clique no círculo para escolher a imagem.</div>
        {sourceFile && (
          <label className="mt-3 block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Aproximar foto</span>
            <input
              type="range"
              min="1"
              max="2.5"
              step="0.05"
              value={zoom}
              onChange={async (event) => {
                const nextZoom = Number(event.target.value);
                setZoom(nextZoom);
                await updateCropped(sourceFile, nextZoom);
              }}
              className="w-full accent-[#b688d6]"
            />
          </label>
        )}
      </div>
    </div>
  );
}

function ClientDetailsModal({
  client,
  onClose,
  onSave,
  onDelete
}: {
  client: Client | null;
  onClose: () => void;
  onSave: (clientId: string, input: Pick<Client, "name" | "instagram_handle" | "phone" | "brand_color" | "email"> & {
    avatar_file?: File | null;
  }) => Promise<void>;
  onDelete: (clientId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("#170b43");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!client) return;
    setName(client.name);
    setHandle(client.instagram_handle ?? "");
    setPhone(client.phone ?? "");
    setEmail(client.email ?? "");
    setColor(client.brand_color ?? "#170b43");
    setAvatarFile(null);
    setCopied(false);
  }, [client]);

  if (!client) return null;

  return (
    <ModalFrame title="Central do cliente" onClose={onClose} compact>
      <AvatarPicker name={name} currentAvatar={client.avatar} color={color} onFile={setAvatarFile} />
      <Field label="Nome" value={name} onChange={setName} placeholder="Nome do cliente" />
      <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="cliente@empresa.com" />
      <Field label="Usuário do Instagram" value={handle} onChange={(value) => setHandle(value.replace("@", ""))} placeholder="@cliente" />
      <Field label="Telefone" value={phone} onChange={(value) => setPhone(formatPhone(value))} placeholder="(19) 99999-9999" />

      <div className="mb-4">
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Cor da marca</span>
        <div className="flex gap-2">
          {["#170b43", "#b688d6", "#4CAF85", "#E8975A", "#E05C5C"].map((swatch) => (
            <button
              key={swatch}
              className={cn("h-8 w-8 rounded-full border-2", color === swatch ? "border-primary" : "border-transparent")}
              style={{ background: swatch }}
              onClick={() => setColor(swatch)}
            />
          ))}
        </div>
      </div>

      {client.invite_code && (
        <div className="mb-4 rounded-lg border border-dashed border-accent/40 bg-accent-light/40 px-3 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Código de acesso</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="font-mono text-sm font-semibold text-primary">{client.invite_code}</span>
            <button
              className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-accent-dark shadow-soft"
              onClick={() => {
                navigator.clipboard.writeText(client.invite_code ?? "").catch(() => {});
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          className="rounded-lg border border-line px-4 py-3 text-sm font-semibold text-danger hover:bg-red-light"
          onClick={() => onDelete(client.id)}
        >
          Excluir cliente
        </button>
        <button
          disabled={saving || !name || !email}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(client.id, {
                name,
                instagram_handle: handle.replace("@", ""),
                phone,
                email,
                brand_color: color,
                avatar_file: avatarFile
              });
              onClose();
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar alterações
        </button>
      </div>
    </ModalFrame>
  );
}

// ─── Workspace ───────────────────────────────────────────────────────────────

function WorkspaceView({ workspace, onEdit }: { workspace: AgencyWorkspace; onEdit: () => void }) {
  const avatarStyle = workspace.avatar ? {
    objectPosition: `${workspace.avatarPositionX ?? 50}% ${workspace.avatarPositionY ?? 50}%`,
    transform: `scale(${workspace.avatarZoom ?? 1})`
  } : undefined;
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[16px] border border-line bg-white shadow-soft">
        <div className="relative min-h-[220px] p-5 sm:p-7">
          <img
            src={workspace.banner || "/default-agency-cover.png"}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: `center ${workspace.bannerPosition ?? 50}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/88 via-primary/50 to-primary/10" />
          <div className="relative max-w-2xl text-white">
            <div className="mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white/15 text-xl font-semibold backdrop-blur">
              {workspace.avatar ? <img src={workspace.avatar} alt="" className="h-full w-full object-cover" style={avatarStyle} /> : initials(workspace.name)}
            </div>
            <h2 className="text-3xl font-light tracking-[-0.03em]">{workspace.name}</h2>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-white/75">
              {workspace.instagram && <span className="rounded-full bg-white/12 px-3 py-1.5">@{workspace.instagram.replace("@", "")}</span>}
              {workspace.address && <span className="rounded-full bg-white/12 px-3 py-1.5">{workspace.address}</span>}
              {workspace.phone && <span className="rounded-full bg-white/12 px-3 py-1.5">{workspace.phone}</span>}
            </div>
          </div>
          <button
            className="absolute right-5 top-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary shadow-soft transition hover:-translate-y-0.5"
            onClick={onEdit}
          >
            Editar perfil
          </button>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-1 text-sm leading-6 text-[#4a4568]">{value}</div>
    </div>
  );
}

function normalizeLink(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function ProfileLink({ label, value }: { label: string; value: string }) {
  const href = normalizeLink(value);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-primary transition hover:border-accent hover:bg-accent-light"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function AgencyProfileModal({
  open,
  workspace,
  email,
  onClose,
  canEdit,
  onEdit
}: {
  open: boolean;
  workspace: AgencyWorkspace;
  email: string;
  onClose: () => void;
  canEdit?: boolean;
  onEdit: () => void;
}) {
  if (!open) return null;
  const avatarStyle = workspace.avatar ? {
    objectPosition: `${workspace.avatarPositionX ?? 50}% ${workspace.avatarPositionY ?? 50}%`,
    transform: `scale(${workspace.avatarZoom ?? 1})`
  } : undefined;
  return (
    <ModalFrame title="Perfil da agência" onClose={onClose}>
      <div className="overflow-hidden rounded-[18px] bg-white">
        <div className="relative h-40 sm:h-52">
          <img
            src={workspace.banner || "/default-agency-cover.png"}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: `center ${workspace.bannerPosition ?? 50}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/72 to-transparent" />
        </div>
        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          <div
            className="-mt-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-accent text-xl font-semibold text-white"
            style={{ background: workspace.brandColor || "#170b43" }}
          >
            {workspace.avatar ? <img src={workspace.avatar} alt="" className="h-full w-full object-cover" style={avatarStyle} /> : initials(workspace.name)}
          </div>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-2xl font-semibold tracking-[-0.02em]">{workspace.name}</h3>
              {workspace.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-7 text-[#4a4568]">{workspace.description}</p>}
            </div>
            {canEdit && (
              <button
                className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5"
                onClick={onEdit}
              >
                Editar perfil
              </button>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <ProfileLink label="Site" value={workspace.site} />
            <ProfileLink label="Instagram" value={workspace.instagram ? `https://instagram.com/${workspace.instagram.replace("@", "")}` : ""} />
          </div>
          <div className="mt-6 divide-y divide-line rounded-xl px-4">
            <InfoRow label="Endereço" value={workspace.address || "Não informado"} />
            <InfoRow label="Telefone" value={workspace.phone || "Não informado"} />
            <InfoRow label="E-mail" value={email || "Não informado"} />
          </div>
        </div>
      </div>
    </ModalFrame>
  );
}

function MemberProfileModal({
  open,
  profile,
  onClose,
  onSave
}: {
  open: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSave: (input: { name: string; avatar_file?: File | null; banner_file?: File | null; profile_description?: string; profile_banner_position?: number | null }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [description, setDescription] = useState("");
  const [bannerPosition, setBannerPosition] = useState(50);
  const [saving, setSaving] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setAvatarFile(null);
    setBannerFile(null);
    setBannerPreview("");
    setDescription(profile?.profile_description ?? "");
    setBannerPosition(profile?.profile_banner_position ?? 50);
  }, [open, profile]);

  useEffect(() => {
    if (!bannerFile) return;
    const url = URL.createObjectURL(bannerFile);
    setBannerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [bannerFile]);

  if (!open || !profile) return null;

  const roleLabel = profile.role === "member" ? "Membro da equipe" : "Cliente";
  const isMember = profile.role === "member";
  const bannerUrl = bannerPreview || profile.profile_banner || "/default-agency-cover.png";

  return (
    <ModalFrame title="Meu perfil" onClose={onClose} compact>
      {isMember && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-[#fbfbfb]">
          <div className="relative h-32">
            <img
              src={bannerUrl}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `center ${bannerPosition}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/70 via-primary/20 to-black/10" />
            <button
              type="button"
              className="absolute bottom-3 right-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-primary shadow-soft"
              onClick={() => bannerInputRef.current?.click()}
            >
              Alterar capa
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="px-3 py-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Reposicionar capa</label>
            <input
              type="range"
              min={0}
              max={100}
              value={bannerPosition}
              onChange={(event) => setBannerPosition(Number(event.target.value))}
              className="mt-2 w-full accent-accent"
            />
          </div>
        </div>
      )}
      <AvatarPicker name={name} currentAvatar={profile.avatar} color="#b688d6" onFile={setAvatarFile} label="Foto do perfil" />
      <div className="mb-4 rounded-xl border border-line bg-[#fbfbfb] px-3 py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Tipo de acesso</div>
        <div className="mt-1 text-sm font-semibold text-primary">{roleLabel}</div>
      </div>
      <Field label="Nome" value={name} onChange={setName} placeholder="Seu nome" />
      {isMember && (
        <div className="mb-4">
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Frase do topo</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-sm text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            placeholder="Ex.: Estratégia, criação e organização de conteúdo com clareza."
          />
        </div>
      )}
      <div className="mb-4 rounded-xl border border-line bg-white px-3 py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">E-mail</div>
        <div className="mt-1 break-all text-sm font-semibold text-primary">{profile.email}</div>
      </div>
      <button
        disabled={saving || !name.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({
              name: name.trim(),
              avatar_file: avatarFile,
              banner_file: bannerFile,
              profile_description: isMember ? description.trim() : undefined,
              profile_banner_position: isMember ? bannerPosition : undefined
            });
            onClose();
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar meu perfil
      </button>
    </ModalFrame>
  );
}

function WorkspaceModal({
  open,
  workspace,
  onClose,
  onAutoSave,
  onUploadImage
}: {
  open: boolean;
  workspace: AgencyWorkspace;
  onClose: () => void;
  onAutoSave: (workspace: AgencyWorkspace) => void;
  onUploadImage: (file: File, folder: string) => Promise<string>;
}) {
  const [draft, setDraft] = useState<AgencyWorkspace>(workspace);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) setDraft(workspace);
  }, [open, workspace]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      onAutoSave(draft);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, onAutoSave, open]);

  if (!open) return null;

  function update<K extends keyof AgencyWorkspace>(key: K, value: AgencyWorkspace[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <ModalFrame title="Editar perfil da agência" onClose={onClose}>
      <div className="mb-5 overflow-hidden rounded-[14px] border border-line">
        <div className="relative h-36 bg-accent-light">
          <img
            src={draft.banner || "/default-agency-cover.png"}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: `center ${draft.bannerPosition ?? 50}%` }}
          />
          <button
            className="absolute bottom-3 right-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-primary shadow-soft"
            onClick={() => bannerInputRef.current?.click()}
          >
            Alterar capa
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) update("banner", await onUploadImage(file, "agencies"));
            }}
          />
        </div>
        <div className="border-t border-line bg-white px-4 py-3">
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Reposicionar capa</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={draft.bannerPosition ?? 50}
              onChange={(event) => update("bannerPosition", Number(event.target.value))}
              className="w-full accent-[#b688d6]"
            />
          </label>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-4 rounded-[14px] border border-line bg-[#fbfbfb] p-4">
        <button
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-white"
          style={{ background: draft.brandColor || "#170b43" }}
          onClick={() => avatarInputRef.current?.click()}
        >
          {draft.avatar ? (
            <img
              src={draft.avatar}
              alt=""
              className="h-full w-full object-cover"
              style={{
                objectPosition: `${draft.avatarPositionX ?? 50}% ${draft.avatarPositionY ?? 50}%`,
                transform: `scale(${draft.avatarZoom ?? 1})`
              }}
            />
          ) : initials(draft.name)}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Foto da agência</div>
          <p className="mt-1 text-xs leading-5 text-muted">Clique na imagem para alterar. O salvamento é automático.</p>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) update("avatar", await onUploadImage(file, "agencies"));
          }}
        />
      </div>

      {draft.avatar && (
        <div className="mb-5 rounded-[14px] border border-line bg-white p-4">
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Aproximar foto</span>
            <input
              type="range"
              min="1"
              max="2.4"
              step="0.05"
              value={draft.avatarZoom ?? 1}
              onChange={(event) => update("avatarZoom", Number(event.target.value))}
              className="w-full accent-[#b688d6]"
            />
          </label>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Nome da agência" value={draft.name} onChange={(value) => update("name", value)} />
        <Field label="Site" value={draft.site} onChange={(value) => update("site", value)} placeholder="https://suaagencia.com" />
        <Field label="Instagram" value={draft.instagram} onChange={(value) => update("instagram", value.replace("@", ""))} placeholder="@suaagencia" />
        <Field label="Telefone" value={draft.phone} onChange={(value) => update("phone", formatPhone(value))} placeholder="(19) 99999-9999" />
        <Field label="Endereço" value={draft.address} onChange={(value) => update("address", value)} />
      </div>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Descrição</span>
        <textarea value={draft.description} onChange={(event) => update("description", event.target.value)} className="min-h-20 w-full rounded-lg border border-border-mid p-3 text-sm outline-none focus:border-accent" />
      </label>
      <div className="text-right text-xs font-semibold text-muted">{saved ? "Salvo automaticamente" : "Autosave ativo"}</div>
    </ModalFrame>
  );
}

// ─── PostModal ───────────────────────────────────────────────────────────────

function PostModal({
  post,
  client,
  comments,
  profile,
  onClose,
  onApprove,
  onRevision,
  onUpdate,
  onSaveEdit,
  onDeleteComment,
  onDelete
}: {
  post: Post | null;
  client: Client | null;
  comments: Comment[];
  profile: Profile;
  onClose: () => void;
  onApprove: () => Promise<void>;
  onRevision: (feedback: string) => Promise<void>;
  onUpdate: (patch: Partial<Post>) => Promise<void>;
  onSaveEdit: (patch: Partial<Post>, mediaItems: Array<PostMedia | File>) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [slide, setSlide] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editStatus, setEditStatus] = useState<ContentStatus>("draft");
  const [editStage, setEditStage] = useState<PipelineStage>("needs_design");
  const [editContentFormat, setEditContentFormat] = useState<ContentFormat>("static");
  const [editMedia, setEditMedia] = useState<Array<PostMedia | (PostMedia & { sourceFile: File })>>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [resolvingRevision, setResolvingRevision] = useState(false);
  const [savingAction, setSavingAction] = useState<"approve" | "revision" | null>(null);
  const [actionNotice, setActionNotice] = useState<"approved" | "revision" | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);
  useEffect(() => setSlide(0), [post?.id]);
  useEffect(() => {
    if (!post) return;
    setEditing(false);
    setFeedback("");
    setSavingAction(null);
    setResolvingRevision(false);
    setActionNotice(null);
    setCaptionCopied(false);
    setEditTitle(post.title);
    setEditCaption(post.caption ?? "");
    setEditInstructions(post.instructions ?? "");
    setEditDate(post.scheduled_date);
    setEditTime(post.scheduled_time ?? "");
    setEditStatus(post.status);
    setEditStage(post.pipeline_stage);
    setEditContentFormat(getPostType(post));
    setEditMedia(post.media.slice().sort((a, b) => a.order_index - b.order_index));
  }, [post]);
  useEffect(() => {
    const mediaItems = post?.media ?? [];
    if (!mediaItems.length) return;
    const preloadIndexes = Array.from(new Set([
      slide,
      (slide + 1) % mediaItems.length,
      (slide - 1 + mediaItems.length) % mediaItems.length
    ]));
    preloadIndexes.forEach((index) => {
      const item = mediaItems[index];
      if (!item) return;
      if (item.media_type === "image") {
        const image = new Image();
        image.src = item.media_url;
      } else if (item.thumbnail_url) {
        const image = new Image();
        image.src = item.thumbnail_url;
      }
    });
  }, [post?.media, slide]);
  if (!post) return null;
  const media = post.media.length ? post.media : [];
  const current = media[slide];
  const handle = client ? toInstagramHandle(client.name, client.instagram_handle) : "revee";
  const hasFeedback = feedback.trim().length > 0;
  const isClient = profile.role === "client";
  const canEditContent = profile.role === "agency" || profile.role === "member";
  const canDeleteContent = profile.role === "agency";
  const canResolveRevision = canEditContent && post.status === "revision_requested";
  const timeline = buildApprovalTimeline(post, comments);
  const latestRevisionRequest = post.status === "revision_requested"
    ? comments.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null
    : null;
  const visibleComments = latestRevisionRequest
    ? comments.filter((comment) => comment.id !== latestRevisionRequest.id)
    : comments;
  const currentPostId = post.id;
  const orderedEditMedia = editMedia.slice().sort((a, b) => a.order_index - b.order_index);
  function moveEditMedia(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedEditMedia.length) return;
    setEditMedia(arrayMove(orderedEditMedia, index, nextIndex).map((item, orderIndex) => ({ ...item, order_index: orderIndex })));
  }

  async function replaceEditMedia(index: number, file: File) {
    if (await warnUnsupportedVideos([file])) return;
    const replacement: PostMedia & { sourceFile: File } = {
      id: `local-replace-${crypto.randomUUID()}`,
      post_id: currentPostId,
      media_url: URL.createObjectURL(file),
      media_type: file.type.startsWith("video") ? "video" : "image",
      order_index: index,
      sourceFile: file
    };
    setEditMedia(orderedEditMedia.map((item, itemIndex) => itemIndex === index ? replacement : item));
  }

  async function addEditMedia(files: File[]) {
    if (!files.length) return;
    if (await warnUnsupportedVideos(files)) return;
    setEditMedia((current) => [
      ...current,
      ...files.map((file, index) => ({
        id: `local-new-${crypto.randomUUID()}`,
        post_id: currentPostId,
        media_url: URL.createObjectURL(file),
        media_type: file.type.startsWith("video") ? "video" as const : "image" as const,
        order_index: current.length + index,
        sourceFile: file
      }))
    ]);
  }

  function mediaItemsForSave() {
    return orderedEditMedia.map((item) => ("sourceFile" in item ? item.sourceFile : item));
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center bg-primary/55 p-0 backdrop-blur-md sm:items-center sm:p-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="premium-card glass-scroll relative grid max-h-[94dvh] w-full max-w-6xl overflow-y-auto rounded-t-[24px] shadow-modal sm:rounded-[24px] lg:grid-cols-[430px_1fr]"
        >
          <div className="p-4 pb-2 lg:hidden">
            <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-[-0.02em]">{post.title}</h2>
              <p className="mt-1 text-xs text-muted">
                {formatDate(post.scheduled_date)} · {post.scheduled_time || "--:--"}
              </p>
            </div>
            <button
              className="rounded-lg border border-line bg-white/90 p-2 text-muted shadow-soft backdrop-blur hover:bg-accent-light hover:text-primary"
              onClick={onClose}
              aria-label="Fechar conteúdo"
            >
              <X className="h-4 w-4" />
            </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill status={post.status} />
              {canEditContent && (
                <button
                  className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-primary hover:bg-accent-light"
                  onClick={() => setEditing((current) => !current)}
                >
                  {editing ? "Cancelar edição" : "Editar conteúdo"}
                </button>
              )}
            </div>
          </div>
          <div className="bg-[#f7f7f7]/90 p-3 sm:p-6">
            <div className="instagram-frame overflow-hidden rounded-[22px] bg-white">
              <div className="flex items-center gap-3 border-b border-line px-3 py-3">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary text-[10px] font-semibold text-white">
                  {client?.avatar
                    ? <img src={client.avatar} alt="" className="h-full w-full object-cover" />
                    : initials(client?.name)}
                </div>
                <div>
                  <div className="text-xs font-bold">{handle}</div>
                  <div className="text-[10px] text-muted">{client?.name}</div>
                </div>
                <MoreHorizontal className="ml-auto h-4 w-4 text-muted" />
              </div>
              <div className="relative aspect-[4/5] bg-accent-light">
                {current
                  ? current.media_type === "video"
                    ? <VideoPlayer key={current.id} media={current} title={post.title} />
                    : <img key={current.id} src={current.media_url} alt="" className="h-full w-full object-contain" decoding="async" loading="eager" fetchPriority="high" />
                  : <div className="flex h-full items-center justify-center text-muted"><ImagePlus className="h-10 w-10" /></div>}
                {media.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition duration-100 hover:scale-105 hover:bg-black/65"
                      onClick={() => setSlide((slide - 1 + media.length) % media.length)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition duration-100 hover:scale-105 hover:bg-black/65"
                      onClick={() => setSlide((slide + 1) % media.length)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
                      {slide + 1}/{media.length}
                    </div>
                  </>
                )}
              </div>
              <div className="p-3 text-xs leading-5">
                <div className="mb-2 flex gap-3 text-primary">
                  <MessageCircle className="h-5 w-5" />
                  <Send className="h-5 w-5" />
                </div>
                <p className="whitespace-pre-wrap"><strong>{handle}</strong> {post.caption || "Legenda em produção."}</p>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col p-4 sm:p-6">
            <div className="mb-4 hidden items-start gap-3 lg:flex">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold tracking-[-0.02em]">{post.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(post.scheduled_date)} · {post.scheduled_time || "--:--"}
                </p>
              </div>
              <button
                className="rounded-lg border border-line p-2 text-muted hover:bg-accent-light hover:text-primary"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              <StatusPill status={post.status} />
              {canEditContent && (
                <button
                  className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-primary hover:bg-accent-light"
                  onClick={() => setEditing((current) => !current)}
                >
                  {editing ? "Cancelar edição" : "Editar conteúdo"}
                </button>
              )}
            </div>
            {editing ? (
              <div className="mt-5 grid gap-3">
                <Field label="Título" value={editTitle} onChange={setEditTitle} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Data" type="date" value={editDate} onChange={setEditDate} />
                  <Field label="Horário" type="time" value={editTime} onChange={setEditTime} />
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Legenda</span>
                  <textarea value={editCaption} onChange={(event) => setEditCaption(event.target.value)} className="min-h-24 w-full rounded-lg border border-border-mid p-3 text-sm outline-none focus:border-accent" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Orientações</span>
                  <textarea value={editInstructions} onChange={(event) => setEditInstructions(event.target.value)} className="min-h-20 w-full rounded-lg border border-border-mid p-3 text-sm outline-none focus:border-accent" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as ContentStatus)} className="rounded-lg border border-line px-3 py-3 text-sm">
                    {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                  </select>
                  <select value={editContentFormat} onChange={(event) => setEditContentFormat(event.target.value as ContentFormat)} className="rounded-lg border border-line px-3 py-3 text-sm">
                    {Object.entries(contentFormatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="rounded-[14px] border border-line bg-white p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Imagens e slides</div>
                      <div className="mt-1 text-xs text-muted">Adicione, substitua, remova ou reorganize o carrossel.</div>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-primary hover:bg-accent-light">
                      <ImagePlus className="h-4 w-4" />
                      Adicionar
                      <input
                        type="file"
                        accept="image/*,video/mp4,video/webm"
                        multiple
                        className="hidden"
                        onChange={async (event) => {
                          const input = event.currentTarget;
                          await addEditMedia(Array.from(input.files ?? []));
                          input.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {orderedEditMedia.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-xl border border-line bg-[#fbfbfb] p-2">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-accent-light">
                          {item.media_type === "video"
                            ? item.thumbnail_url
                              ? <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                              : <div className="flex h-full w-full items-center justify-center text-accent-dark"><FileText className="h-5 w-5" /></div>
                            : <img src={item.media_url} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-primary">Slide {index + 1}</div>
                          <div className="text-[11px] text-muted">{item.media_type === "video" ? "Vídeo" : "Imagem"}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="rounded-md p-1.5 text-muted hover:bg-accent-light hover:text-primary" onClick={() => moveEditMedia(index, -1)} disabled={index === 0} title="Subir slide"><ChevronLeft className="h-3.5 w-3.5 rotate-90" /></button>
                          <button className="rounded-md p-1.5 text-muted hover:bg-accent-light hover:text-primary" onClick={() => moveEditMedia(index, 1)} disabled={index === orderedEditMedia.length - 1} title="Descer slide"><ChevronRight className="h-3.5 w-3.5 rotate-90" /></button>
                          <label className="cursor-pointer rounded-md p-1.5 text-muted hover:bg-accent-light hover:text-primary" title="Substituir slide">
                            <Upload className="h-3.5 w-3.5" />
                            <input type="file" accept="image/*,video/mp4,video/webm" className="hidden" onChange={async (event) => {
                              const input = event.currentTarget;
                              const file = input.files?.[0];
                              if (file) await replaceEditMedia(index, file);
                              input.value = "";
                            }} />
                          </label>
                          <button className="rounded-md p-1.5 text-muted hover:bg-red-light hover:text-danger" onClick={() => setEditMedia(orderedEditMedia.filter((_, itemIndex) => itemIndex !== index).map((media, orderIndex) => ({ ...media, order_index: orderIndex })))} title="Remover slide">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  disabled={savingEdit || !editTitle || !editDate}
                  className="premium-button rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={async () => {
                    setSavingEdit(true);
                    try {
                      await onSaveEdit({
                        title: editTitle,
                        caption: editCaption,
                        instructions: editInstructions,
                        scheduled_date: editDate,
                        scheduled_time: editTime,
                        status: editStatus,
                        pipeline_stage: defaultStageForStatus(editStatus),
                        content_format: editContentFormat
                      }, mediaItemsForSave());
                      setEditing(false);
                    } finally {
                      setSavingEdit(false);
                    }
                  }}
                >
                  {savingEdit ? "Salvando..." : "Salvar edição"}
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <InfoBlock
                  title="Legenda"
                  text={post.caption || "-"}
                  action={
                    post.caption ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-primary hover:bg-accent-light"
                        onClick={() => {
                          navigator.clipboard.writeText(post.caption ?? "").catch(() => {});
                          setCaptionCopied(true);
                          window.setTimeout(() => setCaptionCopied(false), 1600);
                        }}
                      >
                        {captionCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {captionCopied ? "Copiado" : "Copiar"}
                      </button>
                    ) : null
                  }
                />
                <InfoBlock title="Orientações da agência" text={post.instructions || "-"} />
              </div>
            )}
            <div className="premium-card mt-5 rounded-[16px] p-4">
              <div className="mb-3 text-sm font-semibold">
                {post.status === "revision_requested" ? "Pedido de revisão do cliente" : isClient ? "Feedback enviado" : "Feedback do cliente"}
              </div>
              {latestRevisionRequest && (
                <div className="mb-4 rounded-xl border border-[#efd3dc] bg-[#fff5f8] px-3 py-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a4a63]">Ajuste solicitado</div>
                    {canResolveRevision && (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#8a4a63] shadow-soft transition hover:bg-[#f6e7ee] disabled:opacity-60"
                        disabled={resolvingRevision}
                        onClick={async () => {
                          setResolvingRevision(true);
                          try {
                            await onUpdate({ status: "awaiting_approval", pipeline_stage: "waiting_client" });
                          } finally {
                            setResolvingRevision(false);
                          }
                        }}
                      >
                        {resolvingRevision ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Marcar ajuste feito
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-primary">{latestRevisionRequest.content}</p>
                  <div className="mt-2 text-[11px] text-muted">
                    Enviado por {latestRevisionRequest.user_name} em {formatTimelineDate(latestRevisionRequest.created_at)}
                  </div>
                  {latestRevisionRequest.user_id === profile.id && (
                    <button
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-danger shadow-soft transition hover:bg-red-light"
                      onClick={async () => {
                        await onDeleteComment(latestRevisionRequest.id);
                        await onUpdate({ status: "awaiting_approval", pipeline_stage: "waiting_client", revision_requested_at: null });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir solicitação
                    </button>
                  )}
                </div>
              )}
              <div className="max-h-44 space-y-3 overflow-y-auto">
                {visibleComments.length
                  ? visibleComments.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
                        {initials(item.user_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold">{item.user_name}</div>
                          {item.user_id === profile.id && (
                            <button
                              className="rounded-md p-1.5 text-muted hover:bg-red-light hover:text-danger"
                              onClick={() => void onDeleteComment(item.id)}
                              title="Excluir sugestão"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-[#4a4568]">{item.content}</div>
                      </div>
                    </div>
                  ))
                  : (
                    <p className="text-sm text-muted">
                      {latestRevisionRequest ? "Sem outros comentários neste conteúdo." : "Nenhum feedback registrado para este conteúdo."}
                    </p>
                  )}
              </div>
            </div>
            <div className="premium-card mt-4 rounded-[16px] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Histórico do conteúdo</div>
                  <div className="mt-1 text-xs text-muted">Movimentos recentes, feedbacks e aprovações</div>
                </div>
                <span className="rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-semibold text-accent-dark">{timeline.length} eventos</span>
              </div>
              <div className="relative space-y-3.5">
                <div className="timeline-line absolute bottom-3 left-[9px] top-3 w-px" />
                {timeline.map((item) => (
                  <div key={item.id} className="relative flex gap-3">
                    <div className="z-10 mt-1 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full shadow-soft ring-[3px] ring-white" style={{ background: item.bg, color: item.color }}>
                      <Check className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 rounded-xl px-1 pb-1">
                      <div className="text-[13px] font-semibold leading-5 text-primary">{item.title}</div>
                      <div className="text-[11px] font-medium text-muted">{item.user} · {item.time}</div>
                      {item.detail && <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#4a4568]">{item.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <AnimatePresence>
              {actionNotice && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className={cn(
                    "mt-4 rounded-[14px] border px-4 py-3 text-sm font-semibold",
                    actionNotice === "approved" ? "border-[#bfe8d6] bg-[#e4f5ee] text-[#2a7a58]" : "border-[#f4d0ae] bg-[#fdf0e6] text-[#a06020]"
                  )}
                >
                  {actionNotice === "approved" ? "Conteúdo aprovado com sucesso." : "Revisão solicitada e feedback enviado."}
                </motion.div>
              )}
            </AnimatePresence>
            {isClient && (
              <div className="mt-5 rounded-[16px] border border-line bg-white p-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-primary">Sua aprovação</div>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Se estiver tudo certo, aprove o conteúdo. Se precisar de qualquer mudança, escreva exatamente o que a agência deve ajustar e envie para revisão.
                  </p>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                    O que precisa ser ajustado?
                  </span>
                  <textarea
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="Ex: trocar a frase inicial, alterar a cor do fundo, mudar a ordem dos slides ou ajustar a legenda."
                    className="premium-input min-h-28 w-full rounded-xl border border-line p-3 text-sm leading-6 outline-none focus:border-accent"
                  />
                </label>
                <p className="mt-2 text-[11px] leading-4 text-muted">
                  O botão de revisão fica disponível depois que você escrever a solicitação.
                </p>
              </div>
            )}
            <div className={cn("mt-3 grid gap-2", isClient ? "sm:grid-cols-2" : "")}>
              {isClient && (
                <button
                  disabled={Boolean(savingAction)}
                  className="premium-button rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={async () => {
                    setSavingAction("approve");
                    try {
                      await onApprove();
                      setActionNotice("approved");
                    } finally {
                      setSavingAction(null);
                    }
                  }}
                >
                  {savingAction === "approve" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Check className="mr-2 inline h-4 w-4" />}
                  Aprovar
                </button>
              )}
              {isClient && (
                <button
                  disabled={!hasFeedback || Boolean(savingAction)}
                  className="premium-button rounded-xl bg-warning px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={async () => {
                    if (!hasFeedback) return;
                    setSavingAction("revision");
                    try {
                      await onRevision(feedback.trim());
                      setFeedback("");
                      setActionNotice("revision");
                    } finally {
                      setSavingAction(null);
                    }
                  }}
                >
                  {savingAction === "revision" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 inline h-4 w-4" />}
                  Enviar para revisão
                </button>
              )}
              {canDeleteContent && (
                <button
                  className="premium-button rounded-xl bg-danger px-4 py-3 text-sm font-semibold text-white"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 inline h-4 w-4" />Excluir
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function buildApprovalTimeline(post: Post, comments: Comment[]) {
  const scheduledAt = composePostDateTime(post.scheduled_date, post.scheduled_time);
  const sortedComments = comments.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const revisionComment = post.status === "revision_requested" ? sortedComments.at(-1) ?? null : null;
  const timelineComments = revisionComment
    ? sortedComments.filter((comment) => comment.id !== revisionComment.id)
    : sortedComments;
  const items = [
    {
      id: "created",
      title: post.submitted_at ? "Agência enviou para aprovação" : "Conteúdo criado",
      user: "Agência",
      time: formatTimelineDate(post.submitted_at ?? post.created_at),
      createdAt: post.submitted_at ?? post.created_at,
      detail: post.title,
      color: "#8a50b0",
      bg: "#f0e4f9"
    },
    {
      id: "scheduled-info",
      title: post.status === "published" ? "Post publicado" : post.status === "scheduled" ? "Post agendado" : "Prazo definido",
      user: "Agência",
      time: formatTimelineDate(post.scheduled_at ?? scheduledAt),
      createdAt: post.scheduled_at ?? scheduledAt,
      detail: `${formatDate(post.scheduled_date)} · ${post.scheduled_time || "--:--"}`,
      color: "#46658e",
      bg: "#e8eef7"
    },
    ...timelineComments.map((comment) => ({
      id: comment.id,
      title: comment.content.toLowerCase().includes("observação geral") ? "Cliente comentou o preview" : "Cliente deixou feedback",
      user: comment.user_name,
      time: formatTimelineDate(comment.created_at),
      createdAt: comment.created_at,
      detail: comment.content,
      color: "#7450a8",
      bg: "#efe8fb"
    }))
  ];

  if (post.status === "revision_requested") {
    const revisionDate = post.revision_requested_at ?? revisionComment?.created_at ?? post.updated_at ?? post.created_at;
    items.push({
      id: "revision",
      title: "Revisão solicitada",
      user: revisionComment?.user_name ?? "Cliente",
      time: formatTimelineDate(revisionDate),
      createdAt: revisionDate,
      detail: revisionComment?.content ?? "Conteúdo voltou para ajustes.",
      color: "#8a4a63",
      bg: "#f6e7ee"
    });
  }

  if (post.status === "approved") {
    const approvedAt = post.approved_at ?? post.updated_at ?? post.created_at;
    items.push({
      id: "approved",
      title: "Conteúdo aprovado",
      user: "Cliente",
      time: formatTimelineDate(approvedAt),
      createdAt: approvedAt,
      detail: "Pronto para agendamento ou publicação.",
      color: "#2f7a5c",
      bg: "#e5f4ee"
    });
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function formatTimelineDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Data não definida";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

function InfoBlock({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-[12px] border border-line bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{title}</div>
        {action}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-[#4a4568]">{text}</p>
    </div>
  );
}

// ─── PostFormModal ───────────────────────────────────────────────────────────

function PostFormModal({
  open,
  clients,
  activeClientId,
  initialDate,
  onClose,
  onSave
}: {
  open: boolean;
  clients: Client[];
  activeClientId: string;
  initialDate: string;
  onClose: () => void;
  onSave: (input: any) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(activeClientId);
  const [caption, setCaption] = useState("");
  const [instructions, setInstructions] = useState("");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("12:00");
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [contentFormat, setContentFormat] = useState<ContentFormat>("static");
  const [files, setFiles] = useState<File[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setClientId(activeClientId);
    setCaption("");
    setInstructions("");
    setDate(initialDate);
    setTime("12:00");
    setStatus("draft");
    setContentFormat("static");
    setFiles([]);
    setCoverFile(null);
    setSaving(false);
  }, [activeClientId, initialDate, open]);
  if (!open) return null;
  return (
    <ModalFrame title="Novo conteúdo" onClose={onClose}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Título" value={title} onChange={setTitle} placeholder="Nome do conteúdo" />
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Cliente</span>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="w-full rounded-lg border border-border-mid bg-white px-3.5 py-3 text-sm outline-none"
          >
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <Field label="Data" type="date" value={date} onChange={setDate} />
        <Field label="Horário" type="time" value={time} onChange={setTime} />
      </div>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Legenda</span>
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          className="min-h-24 w-full rounded-lg border border-border-mid p-3 text-sm outline-none focus:border-accent"
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Orientações</span>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          className="min-h-24 w-full rounded-lg border border-border-mid p-3 text-sm outline-none focus:border-accent"
        />
      </label>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as ContentStatus)}
          className="rounded-lg border border-line px-3 py-3 text-sm"
        >
          {Object.entries(statusMeta).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>
        <select
          value={contentFormat}
          onChange={(event) => setContentFormat(event.target.value as ContentFormat)}
          className="rounded-lg border border-line px-3 py-3 text-sm"
        >
          {Object.entries(contentFormatLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      {contentFormat === "video" && (
        <div className="mb-4 rounded-[14px] border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-primary">Capa do vídeo</div>
              <div className="mt-1 text-xs text-muted">Essa imagem aparece na prévia e no calendário.</div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-primary hover:bg-accent-light"
              onClick={() => coverInputRef.current?.click()}
            >
              {coverFile ? "Trocar capa" : "Subir capa"}
            </button>
          </div>
          {coverFile && <div className="mt-2 text-xs font-semibold text-accent-dark">{coverFile.name}</div>}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
          />
        </div>
      )}
      <button
        className="mb-3 flex w-full flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-accent/60 bg-accent-light/40 px-4 py-8 text-sm font-semibold text-accent-dark"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-5 w-5" />
        Enviar imagem, vídeo ou carrossel sem limite de slides
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={contentFormat === "video" ? "video/mp4,video/webm" : "image/*,video/mp4,video/webm"}
        multiple
        className="hidden"
        onChange={async (event) => {
          const input = event.currentTarget;
          const selectedFiles = Array.from(input.files ?? []);
          if (await warnUnsupportedVideos(selectedFiles)) {
            input.value = "";
            return;
          }
          setFiles(selectedFiles);
        }}
      />
      {!!files.length && (
        <div className="mb-4 flex flex-wrap gap-2">
          {files.map((file) => (
            <span key={file.name} className="rounded-full bg-[#f7f7f7] px-3 py-1 text-xs font-semibold text-muted">
              {file.name}
            </span>
          ))}
        </div>
      )}
      <button
        disabled={saving || !title || !clientId || !date}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({
              client_id: clientId,
              title,
              caption,
              instructions,
              status,
              pipeline_stage: defaultStageForStatus(status),
              content_format: contentFormat,
              scheduled_date: date,
              scheduled_time: time,
              files,
              cover_file: coverFile
            });
            onClose();
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar conteúdo
      </button>
    </ModalFrame>
  );
}

function MetricsView({
  metric,
  previousMetric,
  metrics,
  activityHistory,
  clients,
  activeClient,
  activeClientId,
  setActiveClientId,
  monthFilter,
  setMonthFilter,
  availableMonths,
  agencyName,
  canEdit,
  isClient,
  onEdit,
  onFeedback
}: {
  metric: MonthlyMetric | null;
  previousMetric: MonthlyMetric | null;
  metrics: MonthlyMetric[];
  activityHistory: ActivityHistory[];
  clients: Client[];
  activeClient: Client | null;
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  monthFilter: string;
  setMonthFilter: (value: string) => void;
  availableMonths: string[];
  agencyName: string;
  canEdit: boolean;
  isClient: boolean;
  onEdit: () => void;
  onFeedback: (metric: MonthlyMetric, feedback: string) => Promise<void>;
}) {
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  useEffect(() => {
    setFeedbackDraft(metric?.client_feedback ?? "");
  }, [metric?.id, metric?.client_feedback]);
  const monthKey = monthFilter === "all" ? new Date().toISOString().slice(0, 7) : monthFilter;
  const headline = `${months[Number(monthKey.slice(5, 7)) - 1]} ${monthKey.slice(0, 4)}`;
  const status = metric?.status ?? "filling";
  const statusMeta = monthlyMetricStatusMeta[status];
  const reachTotal = (metric?.instagram_reach ?? 0) + (metric?.paid_reach ?? 0);
  const previousReachTotal = (previousMetric?.instagram_reach ?? 0) + (previousMetric?.paid_reach ?? 0);
  const impressionsTotal = (metric?.instagram_impressions ?? 0) + (metric?.paid_impressions ?? 0);
  const previousImpressionsTotal = (previousMetric?.instagram_impressions ?? 0) + (previousMetric?.paid_impressions ?? 0);
  const costPerLead = metric?.paid_investment && metric?.paid_leads ? metric.paid_investment / metric.paid_leads : null;
  const previousCostPerLead = previousMetric?.paid_investment && previousMetric?.paid_leads ? previousMetric.paid_investment / previousMetric.paid_leads : null;
  const metricHistory = [...metrics].sort((a, b) => metricMonthKey(a).localeCompare(metricMonthKey(b))).slice(-6);
  const general = [
    { label: "Impressões", value: metric?.instagram_impressions, previous: previousMetric?.instagram_impressions },
    { label: "Interações", value: metric?.instagram_engagement, previous: previousMetric?.instagram_engagement },
    { label: "Seguidores", value: metric?.instagram_followers, previous: previousMetric?.instagram_followers }
  ];
  const engagements = [
    { label: "Curtidas", value: metric?.instagram_likes, previous: previousMetric?.instagram_likes },
    { label: "Comentários", value: metric?.instagram_comments, previous: previousMetric?.instagram_comments },
    { label: "Salvamentos", value: metric?.instagram_saves, previous: previousMetric?.instagram_saves },
    { label: "Compartilhamentos", value: metric?.instagram_shares, previous: previousMetric?.instagram_shares },
    { label: "Repost", value: metric?.instagram_reposts, previous: previousMetric?.instagram_reposts }
  ];
  const paid = [
    { label: "Investimento", value: metric?.paid_investment, previous: previousMetric?.paid_investment, money: true },
    { label: "Alcance pago", value: metric?.paid_reach, previous: previousMetric?.paid_reach },
    { label: "Impressões pagas", value: metric?.paid_impressions, previous: previousMetric?.paid_impressions },
    { label: "Cliques", value: metric?.paid_clicks, previous: previousMetric?.paid_clicks },
    { label: "Leads", value: metric?.paid_leads, previous: previousMetric?.paid_leads },
    { label: "Custo por lead", value: costPerLead, previous: previousCostPerLead, money: true, lowerIsBetter: true }
  ];
  const summary = [
    { label: "Alcance total", value: reachTotal || null, previous: previousReachTotal || null },
    { label: "Impressões totais", value: impressionsTotal || null, previous: previousImpressionsTotal || null },
    { label: "Seguidores", value: metric?.instagram_followers, previous: previousMetric?.instagram_followers },
    { label: "Investimento em tráfego", value: metric?.paid_investment, previous: previousMetric?.paid_investment, money: true }
  ];

  function exportReport() {
    if (!metric || !activeClient) return;
    exportMetricsReport({
      agencyName,
      clientName: activeClient.name,
      headline,
      metric,
      previousMetric,
      history: metricHistory
    });
  }

  return (
    <div className="space-y-5">
      <div className="premium-card rounded-[18px] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Relatório mensal</p>
            <h2 className="mt-1 text-xl font-semibold text-primary">Métricas</h2>
            <p className="mt-1 text-sm text-muted">Resultados cadastrados manualmente com comparação automática do mês anterior.</p>
          </div>
          {metric && <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>}
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto]">
          <SelectBox label="Cliente" value={activeClientId} onChange={setActiveClientId}>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </SelectBox>
          <SelectBox label="Mês" value={monthKey} onChange={setMonthFilter}>
            {availableMonths.map((month) => <option key={month} value={month}>{month.slice(5, 7)}/{month.slice(0, 4)}</option>)}
          </SelectBox>
          {canEdit && (
            <button className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft" onClick={onEdit}>
              <Plus className="h-4 w-4" /> {metric ? "Editar métricas" : "Adicionar métricas"}
            </button>
          )}
          <button
            disabled={!metric}
            className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-primary shadow-soft disabled:opacity-45"
            onClick={exportReport}
          >
            <ExternalLink className="h-4 w-4" /> Exportar relatório
          </button>
        </div>
      </div>

      {!metric ? (
        <EmptyState
          title="Nenhuma métrica cadastrada"
          description={canEdit ? "Adicione os principais números do mês para gerar a visão de resultados do cliente." : "A agência ainda não cadastrou as métricas deste mês."}
          action={canEdit ? { label: "Adicionar métricas", onClick: onEdit } : undefined}
        />
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summary.map((item) => <MetricCard key={item.label} {...item} compact />)}
          </section>
          <MetricSection title="Geral" items={general} />
          <MetricSection title="Engajamentos" items={engagements} />
          <MetricSection title="Tráfego pago" items={paid} />
          <section className="grid gap-4 xl:grid-cols-3">
            <MetricChart title="Evolução de alcance" history={metricHistory} getValue={(item) => (item.instagram_reach ?? 0) + (item.paid_reach ?? 0)} />
            <MetricChart title="Evolução de seguidores" history={metricHistory} getValue={(item) => item.instagram_followers ?? 0} />
            <InvestmentLeadChart history={metricHistory} />
          </section>
          <MetricHistoryTimeline history={activityHistory.filter((item) => item.item_id === metric.id)} />
          <section className="premium-card rounded-[18px] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-primary">Feedback do cliente sobre os resultados</h3>
                <p className="mt-1 text-sm text-muted">{isClient ? "Registre sua percepção do mês para a agência acompanhar." : "Esse comentário fica visível para a agência e para o cliente."}</p>
              </div>
            </div>
            {isClient ? (
              <>
                <textarea
                  value={feedbackDraft}
                  onChange={(event) => setFeedbackDraft(event.target.value)}
                  className="min-h-28 w-full rounded-xl border border-border-mid bg-white p-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                  placeholder="Escreva um feedback geral sobre os resultados..."
                />
                <button
                  disabled={savingFeedback}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={async () => {
                    setSavingFeedback(true);
                    try {
                      await onFeedback(metric, feedbackDraft.trim());
                    } finally {
                      setSavingFeedback(false);
                    }
                  }}
                >
                  {savingFeedback && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar feedback
                </button>
              </>
            ) : (
              <div className="rounded-[14px] border border-line bg-[#fbfbfb] p-4 text-sm leading-6 text-muted">
                {metric.client_feedback || "Nenhum feedback enviado pelo cliente ainda."}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MetricSection({
  title,
  items
}: {
  title: string;
  items: { label: string; value?: number | null; previous?: number | null; money?: boolean; lowerIsBetter?: boolean }[];
}) {
  return (
    <section className="premium-card rounded-[18px] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-primary">{title}</h3>
        <span className="rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent-dark">Mensal</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => <MetricCard key={item.label} {...item} />)}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  previous,
  money,
  lowerIsBetter,
  compact
}: {
  label: string;
  value?: number | null;
  previous?: number | null;
  money?: boolean;
  lowerIsBetter?: boolean;
  compact?: boolean;
}) {
  const comparison = metricComparison(value, previous);
  const currentValue = money ? metricCurrency(value) : metricValue(value);
  const previousValue = money ? metricCurrency(previous) : metricValue(previous);
  const positive = comparison ? comparison.startsWith("+") : false;
  const negative = comparison ? comparison.startsWith("-") : false;
  const improved = lowerIsBetter ? negative : positive;
  const declined = lowerIsBetter ? positive : negative;
  return (
    <div className="rounded-[16px] border border-line bg-white/80 p-4 shadow-soft">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className={cn("mt-2 font-light tracking-[-0.03em] text-primary", compact ? "text-xl" : "text-2xl")}>{currentValue}</div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted">
        <span>Mês anterior: {previousValue}</span>
        {comparison && (
          <span className={cn(
            "rounded-full px-2 py-0.5 font-semibold",
            improved && "bg-accent-light text-accent-dark",
            declined && "bg-[#f6e7ee] text-[#8a4a63]",
            !improved && !declined && "bg-[#f7f6fa] text-muted"
          )}>
            {comparison}
          </span>
        )}
      </div>
      {!compact && <MetricBars current={value} previous={previous} />}
    </div>
  );
}

function MetricBars({ current, previous }: { current?: number | null; previous?: number | null }) {
  const max = Math.max(current ?? 0, previous ?? 0, 1);
  return (
    <div className="mt-4 space-y-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-[#f0eef5]">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(6, ((current ?? 0) / max) * 100)}%` }} />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#f0eef5]">
        <div className="h-full rounded-full bg-accent/45" style={{ width: `${Math.max(6, ((previous ?? 0) / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function MetricChart({
  title,
  history,
  getValue
}: {
  title: string;
  history: MonthlyMetric[];
  getValue: (item: MonthlyMetric) => number;
}) {
  const values = history.map(getValue);
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = history.length <= 1 ? 50 : (index / (history.length - 1)) * 100;
    const y = 86 - (value / max) * 64;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="premium-card rounded-[18px] p-5">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <svg viewBox="0 0 100 96" className="mt-4 h-32 w-full overflow-visible">
        <polyline points="0,86 100,86" fill="none" stroke="#eeeaf6" strokeWidth="1" />
        <polyline points={points} fill="none" stroke="#7450a8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((value, index) => {
          const x = history.length <= 1 ? 50 : (index / (history.length - 1)) * 100;
          const y = 86 - (value / max) * 64;
          return <circle key={`${history[index]?.id}-${index}`} cx={x} cy={y} r="2.4" fill="#170b43" />;
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        {history.map((item) => <span key={item.id}>{String(item.month).padStart(2, "0")}/{String(item.year).slice(2)}</span>)}
      </div>
    </div>
  );
}

function InvestmentLeadChart({ history }: { history: MonthlyMetric[] }) {
  const maxInvestment = Math.max(...history.map((item) => item.paid_investment ?? 0), 1);
  const maxLeads = Math.max(...history.map((item) => item.paid_leads ?? 0), 1);
  return (
    <div className="premium-card rounded-[18px] p-5">
      <h3 className="text-sm font-semibold text-primary">Investimento x leads</h3>
      <div className="mt-5 flex h-32 items-end gap-3">
        {history.map((item) => (
          <div key={item.id} className="flex flex-1 items-end justify-center gap-1.5">
            <div className="w-3 rounded-t-full bg-primary/70" style={{ height: `${Math.max(8, ((item.paid_investment ?? 0) / maxInvestment) * 100)}%` }} />
            <div className="w-3 rounded-t-full bg-accent/50" style={{ height: `${Math.max(8, ((item.paid_leads ?? 0) / maxLeads) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary/70" /> Investimento</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent/50" /> Leads</span>
      </div>
    </div>
  );
}

function MetricHistoryTimeline({ history }: { history: ActivityHistory[] }) {
  return (
    <section className="premium-card rounded-[18px] p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-primary">Histórico do relatório</h3>
        <p className="mt-1 text-sm text-muted">Movimentos principais deste mês.</p>
      </div>
      {history.length ? (
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-[14px] border border-line bg-[#fbfbfb] p-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-primary">{item.description || item.action}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{formatTimelineDate(item.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-line bg-[#fbfbfb] p-4 text-sm text-muted">Nenhum movimento registrado ainda.</div>
      )}
    </section>
  );
}

function exportMetricsReport({
  agencyName,
  clientName,
  headline,
  metric,
  previousMetric,
  history
}: {
  agencyName: string;
  clientName: string;
  headline: string;
  metric: MonthlyMetric;
  previousMetric: MonthlyMetric | null;
  history: MonthlyMetric[];
}) {
  const costPerLead = metric.paid_investment && metric.paid_leads ? metric.paid_investment / metric.paid_leads : null;
  const previousCostPerLead = previousMetric?.paid_investment && previousMetric.paid_leads ? previousMetric.paid_investment / previousMetric.paid_leads : null;
  const reachTotal = (metric.instagram_reach ?? 0) + (metric.paid_reach ?? 0);
  const impressionsTotal = (metric.instagram_impressions ?? 0) + (metric.paid_impressions ?? 0);
  const rows = [
    ["Geral · Impressões", metricValue(metric.instagram_impressions), metricComparison(metric.instagram_impressions, previousMetric?.instagram_impressions) ?? "—"],
    ["Geral · Interações", metricValue(metric.instagram_engagement), metricComparison(metric.instagram_engagement, previousMetric?.instagram_engagement) ?? "—"],
    ["Geral · Seguidores", metricValue(metric.instagram_followers), metricComparison(metric.instagram_followers, previousMetric?.instagram_followers) ?? "—"],
    ["Engajamentos · Curtidas", metricValue(metric.instagram_likes), metricComparison(metric.instagram_likes, previousMetric?.instagram_likes) ?? "—"],
    ["Engajamentos · Comentários", metricValue(metric.instagram_comments), metricComparison(metric.instagram_comments, previousMetric?.instagram_comments) ?? "—"],
    ["Engajamentos · Salvamentos", metricValue(metric.instagram_saves), metricComparison(metric.instagram_saves, previousMetric?.instagram_saves) ?? "—"],
    ["Engajamentos · Compartilhamentos", metricValue(metric.instagram_shares), metricComparison(metric.instagram_shares, previousMetric?.instagram_shares) ?? "—"],
    ["Engajamentos · Repost", metricValue(metric.instagram_reposts), metricComparison(metric.instagram_reposts, previousMetric?.instagram_reposts) ?? "—"],
    ["Investimento", metricCurrency(metric.paid_investment), metricComparison(metric.paid_investment, previousMetric?.paid_investment) ?? "—"],
    ["Alcance pago", metricValue(metric.paid_reach), metricComparison(metric.paid_reach, previousMetric?.paid_reach) ?? "—"],
    ["Impressões pagas", metricValue(metric.paid_impressions), metricComparison(metric.paid_impressions, previousMetric?.paid_impressions) ?? "—"],
    ["Cliques pagos", metricValue(metric.paid_clicks), metricComparison(metric.paid_clicks, previousMetric?.paid_clicks) ?? "—"],
    ["Leads", metricValue(metric.paid_leads), metricComparison(metric.paid_leads, previousMetric?.paid_leads) ?? "—"],
    ["Custo por lead", metricCurrency(costPerLead), metricComparison(costPerLead, previousCostPerLead) ?? "—"]
  ];
  const chartLabels = history.map((item) => `${String(item.month).padStart(2, "0")}/${String(item.year).slice(2)}`).join(" · ");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relatório ${clientName} - ${headline}</title>
  <style>
    body { margin: 0; background: #f7f6fa; color: #170b43; font-family: Inter, Arial, sans-serif; }
    .page { max-width: 920px; margin: 0 auto; padding: 44px; }
    .hero { border-radius: 28px; background: linear-gradient(135deg, #170b43, #7450a8); color: white; padding: 34px; }
    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .16em; opacity: .72; font-weight: 800; }
    h1 { margin: 10px 0 6px; font-size: 34px; letter-spacing: -.03em; }
    .muted { color: #8f8aa6; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 22px 0; }
    .card { background: white; border: 1px solid #e6e2ef; border-radius: 18px; padding: 18px; box-shadow: 0 18px 50px rgba(23, 11, 67, .08); }
    .label { font-size: 11px; color: #8f8aa6; font-weight: 700; }
    .value { margin-top: 8px; font-size: 25px; font-weight: 300; letter-spacing: -.03em; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 18px; overflow: hidden; margin-top: 16px; }
    th, td { text-align: left; padding: 14px 16px; border-bottom: 1px solid #eeeaf6; font-size: 13px; }
    th { color: #8f8aa6; font-size: 10px; text-transform: uppercase; letter-spacing: .14em; }
    .section { margin-top: 26px; }
    .bar { height: 9px; background: #eeeaf6; border-radius: 99px; overflow: hidden; margin-top: 10px; }
    .bar span { display: block; height: 100%; background: #7450a8; border-radius: 99px; }
    @media print { body { background: white; } .page { padding: 24px; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="eyebrow">ReveeAprove · Relatório mensal</div>
      <h1>${clientName}</h1>
      <div>${agencyName} · ${headline}</div>
    </section>
    <section class="grid">
      <div class="card"><div class="label">Alcance total</div><div class="value">${metricValue(reachTotal)}</div></div>
      <div class="card"><div class="label">Impressões totais</div><div class="value">${metricValue(impressionsTotal)}</div></div>
      <div class="card"><div class="label">Seguidores</div><div class="value">${metricValue(metric.instagram_followers)}</div></div>
      <div class="card"><div class="label">Investimento</div><div class="value">${metricCurrency(metric.paid_investment)}</div></div>
    </section>
    <section class="section card">
      <div class="eyebrow muted">Comparativo com mês anterior</div>
      <table>
        <thead><tr><th>Métrica</th><th>Resultado</th><th>Variação</th></tr></thead>
        <tbody>${rows.map((row) => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`).join("")}</tbody>
      </table>
    </section>
    <section class="section card">
      <div class="eyebrow muted">Evolução recente</div>
      <p class="muted">${chartLabels || "Sem histórico suficiente."}</p>
      <div class="bar"><span style="width:${Math.min(100, Math.max(8, (reachTotal / Math.max(...history.map((item) => (item.instagram_reach ?? 0) + (item.paid_reach ?? 0)), reachTotal, 1)) * 100))}%"></span></div>
    </section>
    ${metric.client_feedback ? `<section class="section card"><div class="eyebrow muted">Feedback do cliente</div><p>${metric.client_feedback}</p></section>` : ""}
  </main>
  <script>window.print();</script>
</body>
</html>`;
  const popup = window.open("", "_blank", "width=980,height=760");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

function CampaignsView({
  campaigns,
  clients,
  canEdit,
  onOpen,
  onNew,
  onEdit
}: {
  campaigns: Campaign[];
  clients: Client[];
  canEdit: boolean;
  onOpen: (campaign: Campaign) => void;
  onNew: () => void;
  onEdit: (campaign: Campaign) => void;
}) {
  if (!campaigns.length) return (
    <EmptyState
      title="Nenhuma campanha no mês"
      description="Crie campanhas de tráfego pago para aprovar objetivo, criativos, copy e orçamento com o cliente."
      action={canEdit ? { label: "Nova campanha", onClick: onNew } : undefined}
    />
  );
  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft" onClick={onNew}>
            <Plus className="h-4 w-4" /> Nova campanha
          </button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {campaigns.map((campaign) => {
          const client = clients.find((item) => item.id === campaign.client_id);
          const meta = campaignStatusMeta[campaign.status];
          return (
            <button key={campaign.id} onClick={() => onOpen(campaign)} className="premium-card premium-card-hover rounded-[18px] border-accent/10 p-4 text-left">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="mb-2 inline-flex rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-dark">Campanha</span>
                  <h3 className="truncate text-base font-semibold text-primary">{campaign.title}</h3>
                  <p className="mt-1 text-sm text-muted">{client?.name ?? "Cliente"} · {campaign.platform}</p>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
              </div>
              <div className="grid gap-3 text-sm text-muted sm:grid-cols-2">
                <InfoMini label="Orçamento diário" value={campaign.daily_budget ? formatCurrency(campaign.daily_budget) : "Nao informado"} />
                <InfoMini label="Período" value={getCampaignPeriod(campaign)} />
                <InfoMini label="Responsável" value={campaign.responsible_name || "Nao informado"} />
                <InfoMini label="Total" value={campaign.total_budget ? formatCurrency(campaign.total_budget) : "Nao informado"} />
              </div>
              {campaign.objective && <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted">{campaign.objective}</p>}
              {canEdit && <button className="mt-4 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-primary hover:bg-accent-light" onClick={(event) => { event.stopPropagation(); onEdit(campaign); }}>Editar</button>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyGoalsView({
  goals,
  clients,
  monthFilter,
  canEdit,
  onOpen,
  onNew,
  onEdit
}: {
  goals: MonthlyGoal[];
  clients: Client[];
  monthFilter: string;
  canEdit: boolean;
  onOpen: (goal: MonthlyGoal) => void;
  onNew: () => void;
  onEdit: (goal: MonthlyGoal) => void;
}) {
  const headline = monthFilter === "all" ? "Estratégia mensal" : `${months[Number(monthFilter.slice(5, 7)) - 1]} ${monthFilter.slice(0, 4)}`;
  return (
    <div className="space-y-5">
      <div className="premium-card rounded-[18px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Objetivos do mês</p>
            <h2 className="mt-1 text-xl font-semibold text-primary">{headline}</h2>
          </div>
          {canEdit && <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft" onClick={onNew}><Plus className="h-4 w-4" /> Novo objetivo</button>}
        </div>
      </div>
      {!goals.length ? (
        <EmptyState title="Nenhum objetivo cadastrado" description="Registre metas, ações planejadas e resultados esperados para o cliente acompanhar." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {goals.map((goal) => {
            const client = clients.find((item) => item.id === goal.client_id);
            const meta = monthlyGoalStatusMeta[goal.status];
            return (
              <button key={goal.id} onClick={() => onOpen(goal)} className="premium-card premium-card-hover rounded-[18px] p-5 text-left">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-primary">{goal.title}</h3>
                    <p className="mt-1 text-sm text-muted">{client?.name ?? "Cliente"} · {months[goal.month - 1]} {goal.year}</p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
                {goal.description && <p className="line-clamp-3 text-sm leading-6 text-muted">{goal.description}</p>}
                {goal.planned_actions && <div className="mt-4 rounded-[14px] bg-[#fbfbfb] p-3 text-xs leading-5 text-muted whitespace-pre-line">{goal.planned_actions}</div>}
                {canEdit && <button className="mt-4 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-primary hover:bg-accent-light" onClick={(event) => { event.stopPropagation(); onEdit(goal); }}>Editar</button>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-[#fbfbfb] px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-primary">{value}</div>
    </div>
  );
}

function MetricsFormModal({
  open,
  clients,
  activeClientId,
  metric,
  monthFilter,
  onClose,
  onSave
}: {
  open: boolean;
  clients: Client[];
  activeClientId: string;
  metric: MonthlyMetric | null;
  monthFilter: string;
  onClose: () => void;
  onSave: (input: MonthlyMetricFormInput) => Promise<void>;
}) {
  const currentMonth = monthFilter === "all" ? new Date().toISOString().slice(0, 7) : monthFilter;
  const [form, setForm] = useState<MonthlyMetricFormInput>({
    client_id: activeClientId,
    month: Number(currentMonth.slice(5, 7)),
    year: Number(currentMonth.slice(0, 4)),
    instagram_followers: "",
    instagram_reach: "",
    instagram_impressions: "",
    instagram_link_clicks: "",
    instagram_engagement: "",
    instagram_likes: "",
    instagram_comments: "",
    instagram_saves: "",
    instagram_shares: "",
    instagram_reposts: "",
    paid_investment: "",
    paid_reach: "",
    paid_impressions: "",
    paid_clicks: "",
    paid_leads: "",
    status: "filling"
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const baseMonth = monthFilter === "all" ? new Date().toISOString().slice(0, 7) : monthFilter;
    setForm({
      client_id: metric?.client_id ?? activeClientId,
      month: metric?.month ?? Number(baseMonth.slice(5, 7)),
      year: metric?.year ?? Number(baseMonth.slice(0, 4)),
      instagram_followers: metric?.instagram_followers ? String(metric.instagram_followers) : "",
      instagram_reach: metric?.instagram_reach ? String(metric.instagram_reach) : "",
      instagram_impressions: metric?.instagram_impressions ? String(metric.instagram_impressions) : "",
      instagram_link_clicks: metric?.instagram_link_clicks ? String(metric.instagram_link_clicks) : "",
      instagram_engagement: metric?.instagram_engagement ? String(metric.instagram_engagement) : "",
      instagram_likes: metric?.instagram_likes ? String(metric.instagram_likes) : "",
      instagram_comments: metric?.instagram_comments ? String(metric.instagram_comments) : "",
      instagram_saves: metric?.instagram_saves ? String(metric.instagram_saves) : "",
      instagram_shares: metric?.instagram_shares ? String(metric.instagram_shares) : "",
      instagram_reposts: metric?.instagram_reposts ? String(metric.instagram_reposts) : "",
      paid_investment: metric?.paid_investment ? formatCurrency(metric.paid_investment) : "",
      paid_reach: metric?.paid_reach ? String(metric.paid_reach) : "",
      paid_impressions: metric?.paid_impressions ? String(metric.paid_impressions) : "",
      paid_clicks: metric?.paid_clicks ? String(metric.paid_clicks) : "",
      paid_leads: metric?.paid_leads ? String(metric.paid_leads) : "",
      status: metric?.status ?? "filling"
    });
  }, [activeClientId, metric, monthFilter, open]);
  if (!open) return null;
  const update = <K extends keyof MonthlyMetricFormInput>(key: K, value: MonthlyMetricFormInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const costPerLead = parseCurrencyInput(form.paid_investment) && parseMetricNumber(form.paid_leads)
    ? parseCurrencyInput(form.paid_investment) / parseMetricNumber(form.paid_leads)
    : null;
  return (
    <ModalFrame title={metric ? "Editar métricas" : "Adicionar métricas do mês"} onClose={onClose}>
      <div className="grid gap-4 lg:grid-cols-2">
        <SelectBox label="Cliente" value={form.client_id} onChange={(value) => update("client_id", value)}>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </SelectBox>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mês" type="number" value={String(form.month)} onChange={(value) => update("month", Number(value))} />
          <Field label="Ano" type="number" value={String(form.year)} onChange={(value) => update("year", Number(value))} />
        </div>
        <SelectBox label="Status do mês" value={form.status} onChange={(value) => update("status", value as MonthlyMetricStatus)}>
          {Object.entries(monthlyMetricStatusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </SelectBox>
      </div>

      <div className="mb-5 rounded-[16px] border border-line bg-[#fbfbfb] p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Geral</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Impressões" value={form.instagram_impressions} onChange={(value) => update("instagram_impressions", value)} inputMode="numeric" />
          <Field label="Interações" value={form.instagram_engagement} onChange={(value) => update("instagram_engagement", value)} inputMode="numeric" />
          <Field label="Seguidores" value={form.instagram_followers} onChange={(value) => update("instagram_followers", value)} inputMode="numeric" />
        </div>
      </div>

      <div className="mb-5 rounded-[16px] border border-line bg-[#fbfbfb] p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Engajamentos</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Curtidas" value={form.instagram_likes} onChange={(value) => update("instagram_likes", value)} inputMode="numeric" />
          <Field label="Comentários" value={form.instagram_comments} onChange={(value) => update("instagram_comments", value)} inputMode="numeric" />
          <Field label="Salvamentos" value={form.instagram_saves} onChange={(value) => update("instagram_saves", value)} inputMode="numeric" />
          <Field label="Compartilhamentos" value={form.instagram_shares} onChange={(value) => update("instagram_shares", value)} inputMode="numeric" />
          <Field label="Repost" value={form.instagram_reposts} onChange={(value) => update("instagram_reposts", value)} inputMode="numeric" />
        </div>
      </div>

      <div className="mb-5 rounded-[16px] border border-line bg-[#fbfbfb] p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Tráfego pago</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Investimento"
            value={form.paid_investment}
            onChange={(value) => update("paid_investment", value)}
            onBlur={() => update("paid_investment", formatCurrencyInput(form.paid_investment))}
            inputMode="decimal"
            placeholder="R$ 0,00"
          />
          <Field label="Alcance pago" value={form.paid_reach} onChange={(value) => update("paid_reach", value)} inputMode="numeric" />
          <Field label="Impressões pagas" value={form.paid_impressions} onChange={(value) => update("paid_impressions", value)} inputMode="numeric" />
          <Field label="Cliques" value={form.paid_clicks} onChange={(value) => update("paid_clicks", value)} inputMode="numeric" />
          <Field label="Leads" value={form.paid_leads} onChange={(value) => update("paid_leads", value)} inputMode="numeric" />
          <InfoMini label="Custo por lead" value={costPerLead ? formatCurrency(costPerLead) : "—"} />
        </div>
      </div>

      <button
        disabled={saving || !form.client_id || !form.month || !form.year}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(form);
          } catch (error) {
            window.alert(error instanceof Error ? error.message : "Nao foi possivel salvar as metricas.");
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar métricas
      </button>
    </ModalFrame>
  );
}

function CampaignFormModal({
  open,
  clients,
  responsibleOptions,
  activeClientId,
  campaign,
  onClose,
  onSave,
  onDelete
}: {
  open: boolean;
  clients: Client[];
  responsibleOptions: ResponsibleOption[];
  activeClientId: string;
  campaign: Campaign | null;
  onClose: () => void;
  onSave: (input: CampaignFormInput) => Promise<void>;
  onDelete: (campaign: Campaign) => Promise<void>;
}) {
  const [form, setForm] = useState<CampaignFormInput>({
    client_id: activeClientId,
    title: "",
    objective: "",
    platform: "Meta Ads",
    audience: "",
    daily_budget: "",
    total_budget: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    status: "creating",
    responsible_user_id: "",
    responsible_name: "",
    copy: "",
    internal_notes: "",
    client_feedback: "",
    files: []
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [withoutEndDate, setWithoutEndDate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const hasNoEndDate = Boolean(campaign && !campaign.end_date);
    setWithoutEndDate(hasNoEndDate);
    setForm({
      client_id: campaign?.client_id ?? activeClientId,
      title: campaign?.title ?? "",
      objective: campaign?.objective ?? "",
      platform: (campaign?.platform as CampaignPlatform) ?? "Meta Ads",
      audience: campaign?.audience ?? "",
      daily_budget: campaign?.daily_budget ? formatCurrency(campaign.daily_budget) : "",
      total_budget: campaign?.total_budget ? formatCurrency(campaign.total_budget) : "",
      start_date: campaign?.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: hasNoEndDate ? "" : campaign?.end_date ?? campaign?.start_date ?? new Date().toISOString().slice(0, 10),
      status: campaign?.status ?? "creating",
      responsible_user_id: campaign?.responsible_user_id ?? "",
      responsible_name: campaign?.responsible_name ?? "",
      copy: campaign?.copy ?? "",
      internal_notes: campaign?.internal_notes ?? "",
      client_feedback: campaign?.client_feedback ?? "",
      files: []
    });
  }, [activeClientId, campaign, open]);
  if (!open) return null;
  const update = <K extends keyof CampaignFormInput>(key: K, value: CampaignFormInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateResponsible = (value: string) => {
    const option = responsibleOptions.find((item) => item.key === value);
    setForm((current) => ({
      ...current,
      responsible_user_id: option?.userId ?? "",
      responsible_name: option?.name ?? ""
    }));
  };
  const updateAndRecalculate = <K extends keyof CampaignFormInput>(key: K, value: CampaignFormInput[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      return {
        ...next,
        total_budget: withoutEndDate ? "" : calculateCampaignTotal(next.start_date, next.end_date, next.daily_budget)
      };
    });
  };
  function toggleWithoutEndDate(checked: boolean) {
    setWithoutEndDate(checked);
    setForm((current) => ({
      ...current,
      end_date: checked ? "" : current.start_date,
      total_budget: checked ? "" : calculateCampaignTotal(current.start_date, current.start_date, current.daily_budget)
    }));
  }
  return (
    <ModalFrame title={campaign ? "Editar campanha" : "Nova campanha"} onClose={onClose}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Nome da campanha" value={form.title} onChange={(value) => update("title", value)} />
        <SelectBox label="Cliente" value={form.client_id} onChange={(value) => update("client_id", value)}>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </SelectBox>
        <SelectBox label="Plataforma" value={form.platform} onChange={(value) => update("platform", value as CampaignPlatform)}>
          {campaignPlatforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </SelectBox>
        <SelectBox label="Status" value={form.status} onChange={(value) => update("status", value as CampaignStatus)}>
          {Object.entries(campaignStatusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </SelectBox>
        <Field label="Data de início" type="date" value={form.start_date} onChange={(value) => updateAndRecalculate("start_date", value)} />
        {!withoutEndDate && <Field label="Data de fim" type="date" value={form.end_date} onChange={(value) => updateAndRecalculate("end_date", value)} />}
        <label className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-[#fbfbfb] px-3.5 py-3 text-sm font-semibold text-primary">
          <input
            type="checkbox"
            checked={withoutEndDate}
            onChange={(event) => toggleWithoutEndDate(event.target.checked)}
            className="h-4 w-4 accent-[#7450a8]"
          />
          Sem data final definida
        </label>
        <Field
          label="Orçamento diário"
          value={form.daily_budget}
          onChange={(value) => updateAndRecalculate("daily_budget", value)}
          onBlur={() => updateAndRecalculate("daily_budget", formatCurrencyInput(form.daily_budget))}
          inputMode="decimal"
          placeholder="R$ 0,00"
        />
        <Field
          label="Orçamento total"
          value={withoutEndDate ? "Sem data final" : form.total_budget}
          onChange={() => {}}
          readOnly
          placeholder="Calculado automaticamente"
        />
        <SelectBox label="Responsável" value={form.responsible_user_id || `name:${form.responsible_name}`} onChange={updateResponsible}>
          <option value="name:">Selecionar responsável</option>
          {form.responsible_name && !responsibleOptions.some((item) => item.name === form.responsible_name) && (
            <option value={`name:${form.responsible_name}`}>{form.responsible_name}</option>
          )}
          {responsibleOptions.map((option) => (
            <option key={option.key} value={option.key}>{option.name} · {option.role}</option>
          ))}
        </SelectBox>
      </div>
      <TextAreaBox label="Objetivo da campanha" value={form.objective} onChange={(value) => update("objective", value)} />
      <TextAreaBox label="Público-alvo" value={form.audience} onChange={(value) => update("audience", value)} />
      <TextAreaBox label="Copy da campanha" value={form.copy} onChange={(value) => update("copy", value)} />
      <TextAreaBox label="Observações internas" value={form.internal_notes} onChange={(value) => update("internal_notes", value)} />
      <button type="button" className="mb-3 flex w-full flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-accent/60 bg-accent-light/40 px-4 py-7 text-sm font-semibold text-accent-dark" onClick={() => inputRef.current?.click()}>
        <Upload className="h-5 w-5" /> Adicionar criativos
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/webm"
        multiple
        className="hidden"
        onChange={async (event) => {
          const input = event.currentTarget;
          const selectedFiles = Array.from(input.files ?? []);
          if (await warnUnsupportedVideos(selectedFiles)) {
            input.value = "";
            return;
          }
          update("files", selectedFiles);
        }}
      />
      {!!form.files.length && <div className="mb-4 flex flex-wrap gap-2">{form.files.map((file) => <span key={file.name} className="rounded-full bg-[#f7f7f7] px-3 py-1 text-xs font-semibold text-muted">{file.name}</span>)}</div>}
      <div className={cn("grid gap-3", campaign && "sm:grid-cols-[1fr_1.4fr]")}>
        {campaign && (
          <button
            type="button"
            disabled={saving || deleting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-danger/35 px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/5 disabled:opacity-50"
            onClick={async () => {
              if (!window.confirm("Tem certeza que deseja excluir esta campanha?")) return;
              setDeleting(true);
              try {
                await onDelete(campaign);
              } catch (error) {
                window.alert(error instanceof Error ? error.message : "Nao foi possivel excluir a campanha.");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir campanha
          </button>
        )}
        <button disabled={saving || deleting || !form.title || !form.client_id || !form.start_date} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={async () => { setSaving(true); try { await onSave(form); } catch (error) { window.alert(error instanceof Error ? error.message : "Nao foi possivel salvar a campanha."); } finally { setSaving(false); } }}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar campanha
        </button>
      </div>
    </ModalFrame>
  );
}

function MonthlyGoalFormModal({
  open,
  clients,
  responsibleOptions,
  activeClientId,
  goal,
  monthFilter,
  onClose,
  onSave,
  onDelete
}: {
  open: boolean;
  clients: Client[];
  responsibleOptions: ResponsibleOption[];
  activeClientId: string;
  goal: MonthlyGoal | null;
  monthFilter: string;
  onClose: () => void;
  onSave: (input: MonthlyGoalFormInput) => Promise<void>;
  onDelete: (goal: MonthlyGoal) => Promise<void>;
}) {
  const currentMonth = monthFilter === "all" ? new Date().toISOString().slice(0, 7) : monthFilter;
  const [form, setForm] = useState<MonthlyGoalFormInput>({
    client_id: activeClientId,
    month: Number(currentMonth.slice(5, 7)),
    year: Number(currentMonth.slice(0, 4)),
    title: "",
    description: "",
    planned_actions: "",
    responsible_user_id: "",
    responsible_name: "",
    status: "planned",
    client_feedback: "",
    result_notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!open) return;
    const baseMonth = monthFilter === "all" ? new Date().toISOString().slice(0, 7) : monthFilter;
    setForm({
      client_id: goal?.client_id ?? activeClientId,
      month: goal?.month ?? Number(baseMonth.slice(5, 7)),
      year: goal?.year ?? Number(baseMonth.slice(0, 4)),
      title: goal?.title ?? "",
      description: goal?.description ?? "",
      planned_actions: goal?.planned_actions ?? "",
      responsible_user_id: goal?.responsible_user_id ?? "",
      responsible_name: goal?.responsible_name ?? "",
      status: goal?.status ?? "planned",
      client_feedback: goal?.client_feedback ?? "",
      result_notes: goal?.result_notes ?? ""
    });
  }, [activeClientId, goal, monthFilter, open]);
  if (!open) return null;
  const update = <K extends keyof MonthlyGoalFormInput>(key: K, value: MonthlyGoalFormInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateResponsible = (value: string) => {
    const option = responsibleOptions.find((item) => item.key === value);
    setForm((current) => ({
      ...current,
      responsible_user_id: option?.userId ?? "",
      responsible_name: option?.name ?? ""
    }));
  };
  return (
    <ModalFrame title={goal ? "Editar objetivo" : "Novo objetivo do mês"} onClose={onClose}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Título" value={form.title} onChange={(value) => update("title", value)} />
        <SelectBox label="Cliente" value={form.client_id} onChange={(value) => update("client_id", value)}>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </SelectBox>
        <Field label="Mês" type="number" value={String(form.month)} onChange={(value) => update("month", Number(value))} />
        <Field label="Ano" type="number" value={String(form.year)} onChange={(value) => update("year", Number(value))} />
        <SelectBox label="Responsável" value={form.responsible_user_id || `name:${form.responsible_name}`} onChange={updateResponsible}>
          <option value="name:">Selecionar responsável</option>
          {form.responsible_name && !responsibleOptions.some((item) => item.name === form.responsible_name) && (
            <option value={`name:${form.responsible_name}`}>{form.responsible_name}</option>
          )}
          {responsibleOptions.map((option) => (
            <option key={option.key} value={option.key}>{option.name} · {option.role}</option>
          ))}
        </SelectBox>
        <SelectBox label="Status" value={form.status} onChange={(value) => update("status", value as MonthlyGoalStatus)}>
          {Object.entries(monthlyGoalStatusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </SelectBox>
      </div>
      <TextAreaBox label="Descrição" value={form.description} onChange={(value) => update("description", value)} />
      <TextAreaBox label="Ações planejadas" value={form.planned_actions} onChange={(value) => update("planned_actions", value)} />
      <TextAreaBox label="Conclusão / resultado" value={form.result_notes} onChange={(value) => update("result_notes", value)} />
      <div className={cn("grid gap-3", goal && "sm:grid-cols-[1fr_1.4fr]")}>
        {goal && (
          <button
            type="button"
            disabled={saving || deleting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-danger/35 px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/5 disabled:opacity-50"
            onClick={async () => {
              if (!window.confirm("Tem certeza que deseja excluir este objetivo?")) return;
              setDeleting(true);
              try {
                await onDelete(goal);
              } catch (error) {
                window.alert(error instanceof Error ? error.message : "Nao foi possivel excluir o objetivo.");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir objetivo
          </button>
        )}
        <button disabled={saving || deleting || !form.title || !form.client_id} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={async () => { setSaving(true); try { await onSave(form); } catch (error) { window.alert(error instanceof Error ? error.message : "Nao foi possivel salvar o objetivo."); } finally { setSaving(false); } }}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar objetivo
        </button>
      </div>
    </ModalFrame>
  );
}

function SelectBox({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="premium-input w-full rounded-xl border border-border-mid bg-white px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15">
        {children}
      </select>
    </label>
  );
}

function TextAreaBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 w-full rounded-xl border border-border-mid bg-white p-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15" />
    </label>
  );
}

function CampaignModal({
  campaign,
  client,
  history,
  isClient,
  canEdit,
  onClose,
  onEdit,
  onApprove,
  onRevision
}: {
  campaign: Campaign | null;
  client: Client | null;
  history: ActivityHistory[];
  isClient: boolean;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (campaign: Campaign) => void;
  onApprove: (campaign: Campaign) => Promise<void>;
  onRevision: (campaign: Campaign, feedback: string) => Promise<void>;
}) {
  const [feedback, setFeedback] = useState("");
  const [savingAction, setSavingAction] = useState<"approve" | "revision" | null>(null);
  if (!campaign) return null;
  const meta = campaignStatusMeta[campaign.status];
  const canClientReviewCampaign = isClient && !["approved", "active", "finished"].includes(campaign.status);
  return (
    <ModalFrame title="Campanha" onClose={onClose}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="mb-2 inline-flex rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-dark">Campanha</span>
          <h2 className="text-xl font-semibold text-primary">{campaign.title}</h2>
          <p className="mt-1 text-sm text-muted">{client?.name ?? "Cliente"} · {campaign.platform}</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
      </div>
      {!!campaign.media.length && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {campaign.media.map((media) => (
            media.type === "video" ? (
              <video key={media.id} src={media.url} controls playsInline preload="metadata" className="aspect-video w-full rounded-[16px] bg-black object-contain" />
            ) : (
              <img key={media.id} src={media.url} alt="" className="aspect-video w-full rounded-[16px] object-cover" />
            )
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoMini label="Objetivo" value={campaign.objective || "Nao informado"} />
        <InfoMini label="Período" value={getCampaignPeriod(campaign)} />
        <InfoMini label="Orçamento diário" value={campaign.daily_budget ? formatCurrency(campaign.daily_budget) : "Nao informado"} />
        <InfoMini label="Orçamento total" value={campaign.total_budget ? formatCurrency(campaign.total_budget) : "Nao informado"} />
        <InfoMini label="Responsável" value={campaign.responsible_name || "Nao informado"} />
        <InfoMini label="Público" value={campaign.audience || "Nao informado"} />
      </div>
      {campaign.copy && <DetailBlock title="Copy da campanha" text={campaign.copy} />}
      {campaign.internal_notes && !isClient && <DetailBlock title="Observações internas" text={campaign.internal_notes} />}
      {campaign.client_feedback && <DetailBlock title="Feedback do cliente" text={campaign.client_feedback} />}
      {canClientReviewCampaign && (
        <div className="mt-5 rounded-[16px] border border-line p-4">
          <TextAreaBox label="Feedback para revisão" value={feedback} onChange={setFeedback} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className="rounded-lg border border-line px-4 py-3 text-sm font-semibold text-primary hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-60"
              disabled={savingAction !== null}
              onClick={async () => {
                if (!feedback.trim()) {
                  alert("Escreva o que precisa ser ajustado antes de enviar para revisão.");
                  return;
                }
                setSavingAction("revision");
                try {
                  await onRevision(campaign, feedback.trim());
                } finally {
                  setSavingAction(null);
                }
              }}
            >
              {savingAction === "revision" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 inline h-4 w-4" />}
              Enviar para revisão
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={savingAction !== null}
              onClick={async () => {
                setSavingAction("approve");
                try {
                  await onApprove(campaign);
                } finally {
                  setSavingAction(null);
                }
              }}
            >
              {savingAction === "approve" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Check className="mr-2 inline h-4 w-4" />}
              Aprovar campanha
            </button>
          </div>
        </div>
      )}
      {canEdit && <button className="mt-5 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white" onClick={() => onEdit(campaign)}>Editar campanha</button>}
      <HistoryTimeline history={history} />
    </ModalFrame>
  );
}

function MonthlyGoalModal({
  goal,
  client,
  history,
  isClient,
  canEdit,
  onClose,
  onEdit,
  onFeedback
}: {
  goal: MonthlyGoal | null;
  client: Client | null;
  history: ActivityHistory[];
  isClient: boolean;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (goal: MonthlyGoal) => void;
  onFeedback: (goal: MonthlyGoal, feedback: string) => Promise<void>;
}) {
  const [feedback, setFeedback] = useState(goal?.client_feedback ?? "");
  useEffect(() => setFeedback(goal?.client_feedback ?? ""), [goal?.client_feedback]);
  if (!goal) return null;
  const meta = monthlyGoalStatusMeta[goal.status];
  return (
    <ModalFrame title="Objetivo do mês" onClose={onClose}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{months[goal.month - 1]} {goal.year}</p>
          <h2 className="mt-1 text-xl font-semibold text-primary">{goal.title}</h2>
          <p className="mt-1 text-sm text-muted">{client?.name ?? "Cliente"} · {goal.responsible_name || "Responsavel nao informado"}</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
      </div>
      {goal.description && <DetailBlock title="Descrição" text={goal.description} />}
      {goal.planned_actions && <DetailBlock title="Ações planejadas" text={goal.planned_actions} />}
      {goal.result_notes && <DetailBlock title="Conclusão / resultado" text={goal.result_notes} />}
      {isClient && (
        <div className="mt-5 rounded-[16px] border border-line p-4">
          <TextAreaBox label="Feedback geral" value={feedback} onChange={setFeedback} />
          <button className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white" onClick={() => onFeedback(goal, feedback)}>Enviar feedback</button>
        </div>
      )}
      {canEdit && <button className="mt-5 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white" onClick={() => onEdit(goal)}>Editar objetivo</button>}
      <HistoryTimeline history={history} />
    </ModalFrame>
  );
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-[16px] bg-[#fbfbfb] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{title}</div>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-primary">{text}</p>
    </div>
  );
}

function HistoryTimeline({ history }: { history: ActivityHistory[] }) {
  if (!history.length) return null;
  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-semibold text-primary">Histórico de alterações</h3>
      <div className="mt-3 space-y-3">
        {history.map((item) => (
          <div key={item.id} className="flex gap-3 text-sm">
            <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
            <div>
              <div className="font-semibold text-primary">{item.description || item.action}</div>
              <div className="mt-0.5 text-xs text-muted">{formatTimelineDate(item.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ClientFormModal ─────────────────────────────────────────────────────────
// NOVO: campo e-mail do cliente + exibe código de convite gerado após salvar

function ClientFormModal({
  open,
  onClose,
  onSave
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: Pick<Client, "name" | "instagram_handle" | "phone" | "brand_color" | "email" | "invite_code"> & {
    avatar_file?: File | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("#170b43");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setName(""); setHandle(""); setPhone(""); setEmail("");
    setColor("#170b43"); setAvatarFile(null); setSavedCode(null); setCopied(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    setSaving(true);
    const code = generateInviteCode(name);
    try {
      await onSave({
        name,
        instagram_handle: handle.replace("@", ""),
        phone,
        brand_color: color,
        email,
        invite_code: code,
        avatar_file: avatarFile
      });
      setSavedCode(code);
    } finally {
      setSaving(false);
    }
  }

  function copyCode() {
    if (!savedCode) return;
    navigator.clipboard.writeText(savedCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!open) return null;

  // ── Tela de sucesso: exibe o código ──
  if (savedCode) {
    return (
      <ModalFrame title="Cliente cadastrado!" onClose={handleClose} compact>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e4f5ee] text-[#2a7a58]">
            <Check className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">{name} foi adicionado!</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Envie o código abaixo para o seu cliente. Ele vai usar este código junto com o e-mail{email ? ` (${email})` : ""} para criar a senha e acessar a plataforma.
            </p>
          </div>

          <div className="w-full rounded-[14px] border border-dashed border-accent/50 bg-accent-light/50 px-5 py-5">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              Código de convite
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tracking-widest text-primary">
              {savedCode}
            </div>
            {email && (
              <div className="mt-2 text-xs text-muted">
                E-mail vinculado: <span className="font-semibold text-primary">{email}</span>
              </div>
            )}
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2">
            <button
              className="flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-semibold text-primary hover:bg-[#f7f7f7]"
              onClick={copyCode}
            >
              {copied ? <Check className="h-4 w-4 text-[#2a7a58]" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar código"}
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white"
              onClick={handleClose}
            >
              Fechar
            </button>
          </div>

          <p className="text-[11px] leading-4 text-muted">
            O código também fica disponível na aba <strong>Clientes</strong> a qualquer momento.
          </p>
        </div>
      </ModalFrame>
    );
  }

  // ── Formulário de cadastro ──
  return (
    <ModalFrame title="Novo cliente" onClose={handleClose} compact>
      <AvatarPicker name={name} color={color} onFile={setAvatarFile} />
      <Field label="Nome" value={name} onChange={setName} placeholder="Nome do cliente" />
      <Field label="E-mail do cliente" type="email" value={email} onChange={setEmail} placeholder="cliente@empresa.com" />
      <Field label="Instagram" value={handle} onChange={(value) => setHandle(value.replace("@", ""))} placeholder="@cliente" />
      <Field label="Telefone" value={phone} onChange={(value) => setPhone(formatPhone(value))} placeholder="(19) 99999-9999" />

      <div className="mb-4 flex gap-2">
        {["#170b43", "#b688d6", "#4CAF85", "#E8975A", "#E05C5C"].map((swatch) => (
          <button
            key={swatch}
            className={cn("h-8 w-8 rounded-full border-2", color === swatch ? "border-primary" : "border-transparent")}
            style={{ background: swatch }}
            onClick={() => setColor(swatch)}
          />
        ))}
      </div>

      <div className="mb-4 rounded-lg bg-[#f0e4f9] px-3 py-2.5 text-xs leading-5 text-[#6a30a0]">
        Um código de convite será gerado automaticamente. Envie-o ao cliente para que ele crie a senha e acesse a plataforma.
      </div>

      <button
        disabled={saving || !name || !email}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#b688d6] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        onClick={handleSave}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Cadastrar e gerar código
      </button>
    </ModalFrame>
  );
}

function MemberFormModal({
  open,
  member,
  onClose,
  onSave
}: {
  open: boolean;
  member: TeamMember | null;
  onClose: () => void;
  onSave: (input: Pick<TeamMember, "name" | "email" | "role_title"> & { avatar_file?: File | null }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(member?.name ?? "");
    setEmail(member?.email ?? "");
    setRoleTitle(normalizeRoleTitle(member?.role_title));
    setAvatarFile(null);
    setCopied(false);
  }, [member, open]);

  if (!open) return null;

  return (
    <ModalFrame title={member ? "Editar membro" : "Novo membro"} onClose={onClose} compact>
      <AvatarPicker name={name} currentAvatar={member?.avatar} color="#b688d6" onFile={setAvatarFile} label="Foto do membro" />
      <Field label="Nome" value={name} onChange={setName} placeholder="Nome do membro" />
      <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="membro@agencia.com" />
      <label className="mb-4 block">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Função / cargo</span>
        <select
          value={roleTitle}
          onChange={(event) => setRoleTitle(event.target.value)}
          className="premium-input w-full rounded-xl border border-border-mid bg-white px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
        >
          <option value="">Selecione uma função</option>
          {standardRoleTitles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>

      {member?.access_code && (
        <div className="mb-4 rounded-lg border border-dashed border-accent/40 bg-accent-light/40 px-3 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Código de acesso</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="font-mono text-sm font-semibold text-primary">{member.access_code}</span>
            <button
              className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-accent-dark shadow-soft"
              onClick={() => {
                navigator.clipboard.writeText(member.access_code).catch(() => {});
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      <button
        disabled={saving || !name || !email || !roleTitle}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({ name, email, role_title: roleTitle, avatar_file: avatarFile });
            onClose();
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {member ? "Salvar membro" : "Adicionar e gerar código"}
      </button>
    </ModalFrame>
  );
}

// ─── BillingView ─────────────────────────────────────────────────────────────

function BillingNotice({ subscription, onRegularize }: { subscription: Subscription | null; onRegularize: () => void }) {
  if (!subscription) return null;

  if (subscription.status === "trial") {
    const daysLeft = getTrialDaysLeft(subscription);
    if (daysLeft === null || daysLeft > 3) return null;
    const timeText = daysLeft <= 0 ? "hoje" : `em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`;
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#dac6ec] bg-[#fbf7ff] px-4 py-3 text-sm text-primary shadow-soft">
        <div>
          <div className="font-semibold">Seu teste gratuito termina {timeText}.</div>
          <div className="mt-1 text-xs leading-5 text-muted">
            Mantenha a assinatura ativa para continuar usando sem interrupção.
          </div>
        </div>
        <button className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white" onClick={onRegularize}>
          Ver assinatura
        </button>
      </div>
    );
  }

  if (subscription.status !== "past_due") return null;
  const daysLeft = getPastDueDaysLeft(subscription) ?? 5;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#f3c7cf] bg-[#fff5f7] px-4 py-3 text-sm text-[#7b2d42] shadow-soft">
      <div>
        <div className="font-semibold">Não conseguimos confirmar seu pagamento.</div>
        <div className="mt-1 text-xs leading-5">
          Regularize sua assinatura para evitar a suspensão do acesso. Seu acesso será suspenso em {daysLeft} dia{daysLeft === 1 ? "" : "s"}.
        </div>
      </div>
      <button className="rounded-xl bg-[#7b2d42] px-4 py-2 text-xs font-semibold text-white" onClick={onRegularize}>
        Regularizar
      </button>
    </div>
  );
}

function SubscriptionBlocked({
  subscription,
  onRegularize,
  onUpdatePayment
}: {
  subscription: Subscription | null;
  onRegularize: () => void;
  onUpdatePayment: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[58vh] max-w-2xl flex-col items-center justify-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent-light text-accent-dark">
        <Lock className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-primary">Regularize sua assinatura para continuar usando o ReveeAprove.</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Seu acesso foi pausado porque não conseguimos confirmar o pagamento da assinatura. Assim que o pagamento for regularizado, sua conta será liberada automaticamente.
      </p>
      <div className="mt-6 grid w-full gap-3 sm:grid-cols-3">
        <button className="premium-button rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white" onClick={onRegularize}>Regularizar pagamento</button>
        <button className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-primary" onClick={onUpdatePayment}>Atualizar pagamento</button>
        <a className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-primary" href="mailto:suporte@reveeaprove.com">Falar com suporte</a>
      </div>
      {subscription?.past_due_since && <div className="mt-5 text-xs text-muted">Pendente desde {formatTimelineDate(subscription.past_due_since)}</div>}
    </div>
  );
}

function BillingView({
  agencyName,
  billingDocument,
  subscription,
  history,
  referrals,
  usage,
  onChangePlan,
  onCancel,
  onReactivate,
  onPaymentLink,
  onUpdatePayment
}: {
  agencyName: string;
  billingDocument: string;
  subscription: Subscription | null;
  history: BillingHistory[];
  referrals: Referral[];
  usage: { clients: number; members: number; contentsThisMonth: number };
  onChangePlan: (plan: SubscriptionPlan, cycle: BillingCycle) => Promise<void>;
  onCancel: (reason: string) => Promise<void>;
  onReactivate: () => Promise<void>;
  onPaymentLink: () => void;
  onUpdatePayment: () => void;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const referralCode = referrals[0]?.referral_code ?? generateReferralCode(agencyName);
  const appOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const referralLink = `${appOrigin.replace(/\/$/, "")}/cadastro?ref=${encodeURIComponent(referralCode)}`;
  const status = subscription?.status ?? "trial";
  const isExempt = status === "exempt";
  const currentPlan = subscription?.plan ?? "studio";
  const pendingReferrals = referrals.filter((item) => item.status === "pending").length;
  const activeReferrals = referrals.filter((item) => item.status === "active" || item.status === "credited" || item.status === "converted").length;
  const referralDiscount = getReferralDiscountAmount(currentPlan, subscription?.billing_cycle ?? "monthly", activeReferrals);
  const estimatedNextAmount = getEstimatedPriceWithReferralDiscount(currentPlan, subscription?.billing_cycle ?? "monthly", activeReferrals);
  const dueDays = getPastDueDaysLeft(subscription);
  const nextCharge = isExempt
    ? "Sem cobrança"
    : subscription?.current_period_end
      ? formatDate(subscription.current_period_end)
      : "--";

  return (
    <div className="space-y-4">
      <section className="premium-card overflow-hidden rounded-[20px]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-white px-5 py-5 sm:px-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Assinatura</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-primary">{getPlanLabel(currentPlan)}</h2>
            <p className="mt-1 text-sm text-muted">
              {isExempt ? "Conta liberada manualmente" : `${getStatusLabel(status)} · ${subscription?.billing_cycle === "annual" ? "ciclo anual" : "ciclo mensal"}`}
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-primary shadow-soft transition hover:border-accent"
            onClick={() => setManageOpen(true)}
          >
            <MoreHorizontal className="h-4 w-4" />
            Gerenciar
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-4 sm:p-5">
          <BillingMetric label="Status" value={getStatusLabel(status)} icon={CreditCard} />
          <BillingMetric label="Próxima cobrança" value={nextCharge} icon={CalendarDays} />
          <BillingMetric label="Forma de pagamento" value={subscription?.payment_method || "Não informada"} icon={ReceiptText} />
          <BillingMetric label="Valor" value={isExempt ? "Liberado" : formatCurrency(getPlanPrice(currentPlan, subscription?.billing_cycle ?? "monthly"))} icon={RefreshCw} />
        </div>

        {status === "past_due" && (
          <div className="mx-4 mb-4 rounded-[14px] border border-[#f3c7cf] bg-[#fff5f7] px-4 py-3 text-sm text-[#7b2d42] sm:mx-5">
            Você tem {dueDays ?? 5} dia{dueDays === 1 ? "" : "s"} restante{dueDays === 1 ? "" : "s"} para regularizar.
          </div>
        )}

      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <section className="premium-card rounded-[18px] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-primary">Histórico de faturamento</h3>
            <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-dark">{history.length} registros</span>
          </div>
          <div className="space-y-2">
            {history.length ? history.map((item) => (
              <div key={item.id} className="grid gap-2 rounded-xl border border-line px-3 py-3 text-sm sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                <div>
                  <div className="font-semibold text-primary">{formatCurrency(item.amount)}</div>
                  <div className="text-xs text-muted">Vence em {item.due_date ? formatDate(item.due_date) : "--"}</div>
                </div>
                <div className="text-xs font-semibold text-muted">{item.payment_method || "Pagamento"}</div>
                <div className="text-xs font-semibold text-accent-dark">{item.status}</div>
                {item.invoice_url && <a className="text-xs font-semibold text-primary underline" href={item.invoice_url} target="_blank">Abrir fatura</a>}
              </div>
            )) : (
              <div className="soft-panel rounded-xl px-4 py-8 text-center text-sm text-muted">Nenhuma cobrança registrada ainda.</div>
            )}
          </div>
        </section>

        <section className="premium-card rounded-[18px] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-accent-dark" />
            <h3 className="text-lg font-semibold text-primary">Indique e ganhe</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">Cada indicação ativa gera R$ 3,00 de desconto mensal. O desconto nunca passa de 80% do plano.</p>
          <div className="mt-4 rounded-xl border border-dashed border-accent/40 bg-accent-light/35 px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Seu código</div>
            <div className="mt-1 font-mono text-sm font-semibold text-primary">{referralCode}</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-line px-3 py-2">
              <div className="font-semibold text-primary">{pendingReferrals}</div>
              <div className="text-muted">pendentes</div>
            </div>
            <div className="rounded-xl border border-line px-3 py-2">
              <div className="font-semibold text-primary">{activeReferrals}</div>
              <div className="text-muted">ativas</div>
            </div>
            <div className="rounded-xl border border-line px-3 py-2">
              <div className="font-semibold text-primary">{formatCurrency(referralDiscount)}</div>
              <div className="text-muted">desconto</div>
            </div>
            <div className="rounded-xl border border-line px-3 py-2">
              <div className="font-semibold text-primary">{formatCurrency(estimatedNextAmount)}</div>
              <div className="text-muted">próxima</div>
            </div>
          </div>
          <button
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white"
            onClick={() => navigator.clipboard.writeText(referralLink).catch(() => {})}
          >
            <Copy className="h-4 w-4" />
            Copiar link de indicação
          </button>
          <div className="mt-3 text-xs text-muted">{referrals.length} indicação{referrals.length === 1 ? "" : "ões"} registrada{referrals.length === 1 ? "" : "s"}</div>
        </section>

        <section className="premium-card rounded-[18px] p-4 sm:p-5">
          <h3 className="text-lg font-semibold text-primary">Uso do plano</h3>
          <div className="mt-4 space-y-2 text-sm">
            <PlanUsageLine label="Clientes" used={usage.clients} limit={getLimit(subscription, "clients")} plan={currentPlan} />
            <PlanUsageLine label="Membros" used={usage.members} limit={getLimit(subscription, "members")} plan={currentPlan} />
            <PlanUsageLine label="Conteúdos este mês" used={usage.contentsThisMonth} limit={getContentLimit(subscription)} plan={currentPlan} />
          </div>
        </section>
      </div>

      {manageOpen && (
        <BillingManagementModal
          agencyName={agencyName}
          billingDocument={billingDocument}
          subscription={subscription}
          history={history}
          onClose={() => setManageOpen(false)}
          onChangePlan={onChangePlan}
          onCancel={onCancel}
          onReactivate={onReactivate}
          onPaymentLink={onPaymentLink}
          onUpdatePayment={onUpdatePayment}
        />
      )}
    </div>
  );
}

function BillingManagementModal({
  agencyName,
  billingDocument,
  subscription,
  history,
  onClose,
  onChangePlan,
  onCancel,
  onReactivate,
  onPaymentLink,
  onUpdatePayment
}: {
  agencyName: string;
  billingDocument: string;
  subscription: Subscription | null;
  history: BillingHistory[];
  onClose: () => void;
  onChangePlan: (plan: SubscriptionPlan, cycle: BillingCycle) => Promise<void>;
  onCancel: (reason: string) => Promise<void>;
  onReactivate: () => Promise<void>;
  onPaymentLink: () => void;
  onUpdatePayment: () => void;
}) {
  const [planOpen, setPlanOpen] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>(subscription?.billing_cycle ?? "monthly");
  const status = subscription?.status ?? "trial";
  const currentPlan = subscription?.plan ?? "studio";
  const isExempt = status === "exempt";
  const nextCharge = isExempt
    ? "Sem cobrança"
    : subscription?.current_period_end
      ? formatDate(subscription.current_period_end)
      : "Ainda não definida";
  const canCancel = status !== "cancelled" && status !== "exempt";
  const visibleHistory = history.slice(0, 4);

  return (
    <ModalFrame title="Faturamento" onClose={onClose}>
      <div className="divide-y divide-line">
        <section className="pb-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-primary">{getPlanLabel(currentPlan)}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                {isExempt ? "Conta liberada manualmente para uso sem cobrança." : `Renova em ${nextCharge}`}
              </p>
            </div>
            <button className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-primary" onClick={() => setPlanOpen((current) => !current)}>
              {planOpen ? "Fechar" : "Atualizar"}
            </button>
          </div>

          {planOpen && (
            <div className="mt-4 rounded-2xl border border-line bg-[#fbfafd] p-4">
              <div className="mb-3 inline-flex rounded-full border border-line bg-white p-1">
                {(["monthly", "annual"] as BillingCycle[]).map((item) => (
                  <button
                    key={item}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", cycle === item ? "bg-accent-light text-accent-dark" : "text-muted")}
                    onClick={() => setCycle(item)}
                  >
                    {item === "monthly" ? "Mensal" : "Anual"}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(PLANS) as SubscriptionPlan[]).map((plan) => (
                  <button
                    key={plan}
                    className={cn(
                      "rounded-xl border bg-white px-4 py-3 text-left transition hover:border-accent",
                      currentPlan === plan && subscription?.billing_cycle === cycle ? "border-accent bg-accent-light/30" : "border-line"
                    )}
                    disabled={currentPlan === plan && subscription?.billing_cycle === cycle}
                    onClick={() => void onChangePlan(plan, cycle)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-primary">{PLANS[plan].name}</span>
                      {plan === "premium" && <Crown className="h-4 w-4 text-accent-dark" />}
                    </span>
                    <span className="mt-1 block text-sm text-muted">{formatCurrency(getPlanPrice(plan, cycle))}/{cycle === "annual" ? "ano" : "mês"}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">Upgrade libera na hora. Downgrade pode ser aplicado no próximo ciclo de cobrança.</p>
            </div>
          )}
        </section>

        <section className="py-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-primary">Histórico de faturamento</h3>
            <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-primary">Ver todos</button>
          </div>
          <div className="mt-4 space-y-1">
            {visibleHistory.length ? visibleHistory.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-line py-3 text-sm last:border-b-0">
                <div className="font-medium text-primary">{item.due_date ? formatDate(item.due_date) : formatDate(item.created_at)}</div>
                <div className="text-muted">{formatCurrency(item.amount)}</div>
                {item.invoice_url ? <a className="font-semibold text-primary underline" href={item.invoice_url} target="_blank">Ver</a> : <span className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent-dark">{item.status}</span>}
              </div>
            )) : (
              <div className="rounded-xl border border-line bg-[#fbfafd] px-4 py-8 text-center text-sm text-muted">Nenhuma cobrança registrada ainda.</div>
            )}
          </div>
        </section>

        <section className="py-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-primary">Dados de faturamento</h3>
            <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-primary" onClick={onUpdatePayment}>Editar</button>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <BillingInfoLine label="Nome" value={agencyName} />
            <BillingInfoLine label="CPF/CNPJ" value={billingDocument || "Não informado"} />
            <BillingInfoLine label="Status" value={getStatusLabel(status)} />
            <BillingInfoLine label="Ciclo" value={subscription?.billing_cycle === "annual" ? "Anual" : "Mensal"} />
          </div>
        </section>

        <section className="py-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-primary">Método de pagamento</h3>
            <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-primary" onClick={onUpdatePayment}>Adicionar novo</button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light text-accent-dark">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-primary">{subscription?.payment_method || "Não informado"}</div>
                <div className="text-xs text-muted">{isExempt ? "Conta isenta de cobrança" : "Usado nas próximas cobranças"}</div>
              </div>
            </div>
            {!isExempt && <button className="text-sm font-semibold text-primary" onClick={onPaymentLink}>Abrir</button>}
          </div>
        </section>

        <section className="pt-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h3 className="text-lg font-semibold text-primary">{status === "cancelled" || status === "suspended" ? "Reativar assinatura" : "Cancelar plano"}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                {status === "cancelled" || status === "suspended"
                  ? "Reative para voltar a usar todos os recursos da agência."
                  : "Se cancelar, os dados não serão apagados e o acesso permanece até o fim do período pago."}
              </p>
            </div>
            {status === "cancelled" || status === "suspended" ? (
              <button className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white" onClick={() => void onReactivate()}>Reativar</button>
            ) : (
              <button
                disabled={!canCancel}
                className="rounded-full border border-danger px-5 py-2.5 text-sm font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => {
                  const reason = window.prompt("Motivo do cancelamento: preço, não estou usando, encontrei outra ferramenta, faltou alguma função ou outro motivo") ?? "";
                  if (reason.trim()) void onCancel(reason.trim());
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </section>
      </div>
    </ModalFrame>
  );
}

function BillingInfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-medium text-primary">{label}</div>
      <div className="mt-1 text-muted">{value}</div>
    </div>
  );
}

function PlanUsageLine({ label, used, limit, plan }: { label: string; used: number; limit: number | null; plan: SubscriptionPlan }) {
  const text = limit === null ? `${used} usados · ilimitado` : `Você utilizou ${used} de ${limit} disponíveis no ${getPlanLabel(plan)}.`;
  const reached = limit !== null && used >= limit;
  return (
    <div className={cn("rounded-xl border px-3 py-3", reached ? "border-[#f3c7cf] bg-[#fff5f7]" : "border-line bg-white")}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-primary">{label}</span>
        <span className={cn("text-xs font-semibold", reached ? "text-danger" : "text-muted")}>{limit === null ? "Ilimitado" : `${used}/${limit}`}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
    </div>
  );
}

function BillingMetric({ label, value, icon: Icon }: { label: string; value: string; icon: ElementType }) {
  return (
    <div className="rounded-[14px] border border-line bg-white px-3 py-3">
      <Icon className="mb-3 h-4 w-4 text-accent-dark" />
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-primary">{value}</div>
    </div>
  );
}

// ─── ModalFrame ──────────────────────────────────────────────────────────────

function ModalFrame({
  title,
  children,
  onClose,
  compact
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  compact?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div
        className={cn(
          "premium-card glass-scroll max-h-[94dvh] w-full overflow-y-auto rounded-t-[22px] p-4 shadow-modal sm:rounded-[22px] sm:p-6",
          compact ? "max-w-md" : "max-w-2xl"
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg border border-line p-2 text-muted hover:bg-accent-light hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── ConfirmDialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-primary/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
      >
        <motion.div
          initial={{ y: 28, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 28, opacity: 0, scale: 0.98 }}
          className="w-full max-w-md rounded-t-[22px] bg-white p-5 shadow-modal sm:rounded-[20px] sm:p-6"
        >
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-light text-danger">
            <Trash2 className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button
              className="rounded-lg border border-line px-4 py-3 text-sm font-semibold text-primary hover:bg-[#f7f7f7]"
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              className="rounded-lg bg-danger px-4 py-3 text-sm font-semibold text-white hover:bg-[#c04040]"
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── StatusPill ──────────────────────────────────────────────────────────────

function VideoPlayer({ media }: { media: PostMedia; title: string }) {
  const sourceUrl = media.media_url.includes("/storage/v1/object/public/post-media/")
    ? `/api/media-proxy?url=${encodeURIComponent(media.media_url)}`
    : media.media_url;
  return (
    <div className="relative h-full w-full bg-black">
      <video
        key={sourceUrl}
        src={sourceUrl}
        poster={media.thumbnail_url ?? undefined}
        controls
        preload="auto"
        playsInline
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function StatusPill({ status }: { status: ContentStatus }) {
  const meta = statusMeta[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

// ─── MediaThumb ──────────────────────────────────────────────────────────────

function MediaThumb({ post }: { post: Post }) {
  const media = post.media[0];
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-accent-light">
      {media
        ? media.media_type === "video"
          ? media.thumbnail_url
            ? <img src={media.thumbnail_url} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-accent-dark"><FileText className="h-4 w-4" /></div>
          : <img src={media.media_url} alt="" className="h-full w-full object-cover" />
        : <div className="flex h-full items-center justify-center text-accent-dark"><FileText className="h-4 w-4" /></div>}
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="premium-card flex min-h-[380px] flex-col items-center justify-center rounded-[20px] p-8 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light text-accent-dark shadow-soft">
        <PanelRightOpen className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-7 text-muted">{description}</p>
      {action && (
        <button
          className="premium-button mt-5 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
