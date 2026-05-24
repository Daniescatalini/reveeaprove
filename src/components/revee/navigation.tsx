"use client";

import { useState } from "react";
import type { ElementType, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sun,
  User,
  UserPlus,
  Users
} from "lucide-react";
import { ReveeLogo } from "@/components/logo";
import { cn, initials, toInstagramHandle } from "@/lib/utils";
import type { Client, Profile } from "@/types/domain";
import type { ContentFormat, ContentStatus } from "@/types/domain";
import type { AgencyWorkspace, View, ViewItem } from "./types";

type ProfileAction = "profile" | "settings" | "workspace" | "clients" | "team" | "billing" | "logout";
type StatusFilter = "all" | ContentStatus;
type TypeFilter = "all" | ContentFormat;

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  postId?: string;
  campaignId?: string;
  goalId?: string;
  createdAt: string;
};

type SidebarProps = {
  profile: Profile | null;
  agencyName: string;
  workspace: AgencyWorkspace;
  activeClient: Client | null;
  clients: Client[];
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  view: View;
  setView: (view: View) => void;
  views: ViewItem[];
  collapsed: boolean;
  mobileOpen: boolean;
  darkMode: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onNewClient: () => void;
  onEditWorkspace: () => void;
  onToggleDarkMode: () => void;
  onProfileAction: (action: ProfileAction) => void;
};

export function Sidebar(props: SidebarProps) {
  const { mobileOpen, onCloseMobile } = props;
  return (
    <>
      <DesktopSidebar {...props} />
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[60] bg-primary/60 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => event.target === event.currentTarget && onCloseMobile()}
          >
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="h-full w-[304px] max-w-[86vw]"
            >
              <SidebarContent {...props} collapsed={false} mobile />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function DesktopSidebar(props: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-20 hidden h-screen shrink-0 flex-col overflow-visible bg-primary text-white transition-[width] duration-300 ease-out lg:flex",
        props.collapsed ? "w-[84px]" : "w-[286px]"
      )}
    >
      <SidebarContent {...props} />
    </aside>
  );
}

function SidebarContent({
  profile,
  agencyName,
  workspace,
  activeClient,
  clients,
  activeClientId,
  setActiveClientId,
  view,
  setView,
  views,
  collapsed,
  mobile,
  darkMode,
  onToggleCollapsed,
  onCloseMobile,
  onNewClient,
  onEditWorkspace,
  onToggleDarkMode,
  onProfileAction
}: SidebarProps & { mobile?: boolean }) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  if (!profile) return null;
  const isClient = profile.role === "client";
  const isMember = profile.role === "member";
  const isAgency = profile.role === "agency";
  const compact = collapsed && !mobile;
  const displayName = profile.role === "agency" ? agencyName : profile.name;
  const roleLabel = isAgency ? "Agência" : isMember ? "Membro" : "Cliente";
  const avatar = isAgency ? workspace.avatar || profile.avatar : profile.avatar;
  const avatarStyle = isAgency && avatar ? {
    objectPosition: `${workspace.avatarPositionX ?? 50}% ${workspace.avatarPositionY ?? 50}%`,
    transform: `scale(${workspace.avatarZoom ?? 1})`
  } : undefined;

  function navigate(nextView: View) {
    setView(nextView);
    onCloseMobile();
  }

  return (
    <div className="relative flex h-full flex-col overflow-visible bg-primary text-white shadow-modal">
      <div className={cn("relative shrink-0 border-b border-white/10", compact ? "h-[78px]" : "h-[92px]")}>
        <div className={cn("flex h-full items-center p-5", compact && "justify-center px-3")}>
          {!compact && <ReveeLogo tone="light" className="h-[24px] max-w-[210px] object-contain" />}
          {!compact && (
            <button
              className="ml-auto rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
              onClick={onCloseMobile}
              aria-label="Fechar menu"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!mobile && (
        <button
          className="absolute right-3 top-5 z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lift backdrop-blur transition hover:bg-accent lg:flex"
          onClick={onToggleCollapsed}
          aria-label={compact ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      )}

      {!isClient && !compact && (
        <div className="mx-3 mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="mb-1 text-[10px] text-white/40">Cliente ativo</div>
          <select
            className="w-full bg-transparent text-sm font-semibold outline-none"
            value={activeClientId}
            onChange={(event) => setActiveClientId(event.target.value)}
          >
            {clients.map((client) => (
              <option className="text-primary" key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className={cn("mt-5 space-y-1", compact && "mt-4")}>
        {!compact && <div className="px-5 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">Menu</div>}
        {views.map((item) => (
          <button
            key={item.id}
            className={cn(
              "relative flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white",
              compact && "justify-center px-0",
              view === item.id && "bg-accent/20 text-white"
            )}
            onClick={() => navigate(item.id)}
            title={compact ? item.label : undefined}
          >
            {view === item.id && <span className="absolute left-0 top-1.5 h-7 w-1 rounded-r bg-accent" />}
            <item.icon className="h-4 w-4 shrink-0" />
            {!compact && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className={cn("relative mt-auto border-t border-white/10 p-5", compact && "px-0")}>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-xl text-left transition hover:bg-white/10",
            compact ? "justify-center px-0 py-2" : "px-2 py-2"
          )}
          onClick={() => setProfileMenuOpen((current) => !current)}
          title="Menu do perfil"
        >
          <span
            className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-white"
            style={{ background: workspace.brandColor || "#b688d6" }}
          >
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" style={avatarStyle} /> : initials(displayName)}
          </span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{displayName}</span>
                <span className="block text-xs text-white/45">{roleLabel}</span>
              </span>
              <ChevronDown className={cn("h-4 w-4 text-white/45 transition", profileMenuOpen && "rotate-180 text-white")} />
            </>
          )}
        </button>
        <AnimatePresence>
          {profileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className={cn(
                "absolute bottom-[82px] z-30 w-64 overflow-hidden rounded-2xl border border-line bg-white p-2 text-primary shadow-modal",
                compact ? "left-[68px]" : "left-4"
              )}
            >
              <ProfileMenuItem icon={User} label="Meu perfil" onClick={() => { onProfileAction("profile"); setProfileMenuOpen(false); }} />
              {isAgency && <ProfileMenuItem icon={Users} label="Clientes" onClick={() => { onProfileAction("clients"); setProfileMenuOpen(false); }} />}
              {isAgency && <ProfileMenuItem icon={UserPlus} label="Equipe" onClick={() => { onProfileAction("team"); setProfileMenuOpen(false); }} />}
              {isAgency && <ProfileMenuItem icon={CreditCard} label="Minha assinatura" onClick={() => { onProfileAction("billing"); setProfileMenuOpen(false); }} />}
              <ProfileMenuItem icon={darkMode ? Sun : Moon} label="Tema escuro" trailing={darkMode ? "On" : "Off"} onClick={onToggleDarkMode} />
              <ProfileMenuItem icon={LogOut} label="Sair" danger onClick={() => onProfileAction("logout")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProfileMenuItem({
  icon: Icon,
  label,
  trailing,
  danger,
  onClick
}: {
  icon: ElementType;
  label: string;
  trailing?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition hover:bg-accent-light",
        danger ? "text-danger hover:bg-red-light" : "text-primary"
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {trailing && (
        <span className="ml-auto flex items-center gap-1 rounded-full bg-accent-light px-2 py-0.5 text-[10px] text-accent-dark">
          {trailing === "On" && <Check className="h-3 w-3" />}
          {trailing}
        </span>
      )}
    </button>
  );
}

export function Topbar({
  view,
  views,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  monthFilter,
  setMonthFilter,
  availableMonths,
  isClient,
  clients,
  activeClientId,
  setActiveClientId,
  onNewPost,
  onOpenMobileSidebar,
  notifications,
  onClearNotifications,
  onOpenNotification
}: {
  view: View;
  views: ViewItem[];
  query: string;
  setQuery: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (value: TypeFilter) => void;
  monthFilter: string;
  setMonthFilter: (value: string) => void;
  availableMonths: string[];
  isClient: boolean;
  clients: Client[];
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  onNewPost: () => void;
  onOpenMobileSidebar: () => void;
  notifications: NotificationItem[];
  onClearNotifications: () => void;
  onOpenNotification: (item: NotificationItem) => void;
}) {
  const title = views.find((item) => item.id === view)?.label ?? "Revee Aprove";
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="z-30 border-b border-line bg-white/92 px-4 py-3 shadow-[0_1px_0_rgba(23,11,67,0.02)] backdrop-blur-xl sm:px-5 lg:sticky lg:top-0 lg:px-6">
      <div className="hidden items-center gap-3 lg:flex">
        <button
          className="rounded-xl border border-line bg-white p-2.5 text-primary shadow-soft lg:hidden"
          onClick={onOpenMobileSidebar}
          aria-label="Abrir menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="hidden text-[15px] font-semibold tracking-[-0.01em] text-primary lg:block">{title}</div>
        <div className="ml-auto hidden min-w-0 items-center gap-2 rounded-xl border border-line bg-[#f7f7f7]/85 px-3 py-2 text-sm text-muted shadow-soft sm:flex">
          <Search className="h-4 w-4" />
          <input
            className="w-44 bg-transparent outline-none lg:w-56"
            placeholder="Buscar título, legenda, cliente, hashtag..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {!isClient && (
          <button
            className="premium-button flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white sm:h-auto sm:w-auto sm:px-3.5 sm:py-2.5"
            onClick={onNewPost}
            aria-label="Novo conteúdo"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo conteúdo</span>
          </button>
        )}
        <div className="relative">
          <button
            className="relative rounded-xl border border-line bg-white p-2.5 text-primary shadow-soft transition hover:bg-accent-light"
            onClick={() => setNotificationsOpen((current) => !current)}
            aria-label="Abrir notificações"
          >
            <Bell className="h-4 w-4" />
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
                className="fixed left-4 right-4 top-[72px] z-40 max-h-[70vh] overflow-hidden rounded-2xl border border-line bg-white p-2 text-primary shadow-modal sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[360px] sm:max-w-[calc(100vw-32px)]"
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
                <div className="max-h-[calc(70vh-58px)] overflow-y-auto sm:max-h-[320px]">
                  {notifications.length ? notifications.map((item) => (
                    <button
                      key={item.id}
                      className="group relative block w-full rounded-xl px-3 py-3 text-left transition hover:bg-accent-light/50"
                      onClick={() => {
                        onOpenNotification(item);
                        setNotificationsOpen(false);
                      }}
                    >
                      <span className="absolute left-1 top-4 h-2 w-2 rounded-full bg-accent opacity-70 transition group-hover:opacity-100" />
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="mt-1 text-xs leading-5 text-muted">{item.detail}</div>
                      <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-dark">{item.time}</div>
                    </button>
                  )) : (
                    <div className="soft-panel rounded-xl px-4 py-7 text-center">
                      <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-accent-dark shadow-soft">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="text-sm font-semibold text-primary">Tudo em ordem</div>
                      <div className="mt-1 text-xs leading-5 text-muted">As próximas aprovações e revisões aparecerão aqui.</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-3 grid gap-2 lg:hidden">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-[#f7f7f7] px-3 py-2 text-sm text-muted shadow-soft">
          <Search className="h-4 w-4" />
          <input
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="Buscar conteúdo"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:overflow-x-auto sm:pb-1">
        <FilterSelect value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} label="Status">
          <option value="all">Todos status</option>
          <option value="approved">Aprovados</option>
          <option value="revision_requested">Revisão</option>
          <option value="awaiting_approval">Aguardando</option>
          <option value="scheduled">Agendados</option>
          <option value="published">Publicados</option>
          <option value="draft">Rascunhos</option>
        </FilterSelect>
        <FilterSelect value={typeFilter} onChange={(value) => setTypeFilter(value as TypeFilter)} label="Tipo">
          <option value="all">Todos tipos</option>
          <option value="static">Post estático</option>
          <option value="video">Vídeo</option>
          <option value="carousel">Carrossel</option>
        </FilterSelect>
        <FilterSelect value={monthFilter} onChange={setMonthFilter} label="Mês">
          <option value="all">Todos meses</option>
          {availableMonths.map((month) => (
            <option key={month} value={month}>{month.split("-").reverse().join("/")}</option>
          ))}
        </FilterSelect>
      </div>
    </header>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  children
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0 shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 truncate rounded-full border border-line bg-white/85 px-2.5 py-2 text-[11px] font-semibold text-primary shadow-soft outline-none transition hover:border-accent focus:border-accent sm:w-auto sm:px-3 sm:text-xs"
      >
        {children}
      </select>
    </label>
  );
}

export function MobileNav({
  view,
  setView,
  isClient,
  views,
  canCreateContent = false,
  onNewPost
}: {
  view: View;
  setView: (view: View) => void;
  isClient: boolean;
  views: ViewItem[];
  canCreateContent?: boolean;
  onNewPost?: () => void;
}) {
  const visibleViews = views.filter((item) => !(isClient && item.agencyOnly));
  const navItems = canCreateContent
    ? [visibleViews[0], visibleViews[1], visibleViews[2], visibleViews[3]].filter(Boolean)
    : visibleViews.slice(0, 4);
  return (
    <nav className={cn(
      "mobile-safe fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-white px-2 pt-2 shadow-[0_-12px_30px_rgba(23,11,67,0.08)] lg:hidden",
      canCreateContent ? "grid-cols-5" : "grid-cols-4"
    )}>
      {navItems.slice(0, 2).map((item) => (
        <button
          key={item.id}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold text-muted",
            view === item.id && "bg-accent-light text-accent-dark"
          )}
          onClick={() => setView(item.id)}
        >
          <item.icon className="h-4 w-4" />
          {item.label.replace(" Preview", "")}
        </button>
      ))}
      {canCreateContent && (
        <button
          className="mx-auto -mt-7 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-modal ring-8 ring-white"
          onClick={onNewPost}
          aria-label="Criar conteúdo"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}
      {navItems.slice(2, 4).map((item) => (
        <button
          key={item.id}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold text-muted",
            view === item.id && "bg-accent-light text-accent-dark"
          )}
          onClick={() => setView(item.id)}
        >
          <item.icon className="h-4 w-4" />
          {item.label.replace(" Preview", "")}
        </button>
      ))}
    </nav>
  );
}
