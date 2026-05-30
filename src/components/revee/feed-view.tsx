"use client";

import { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, FileText, Grid3X3, Send, Trash2 } from "lucide-react";
import { toInstagramHandle } from "@/lib/utils";
import type { Client, Comment, ContentStatus, Post } from "@/types/domain";

export function FeedView({
  client,
  posts,
  isClient,
  statusMeta,
  onOpenPost,
  onReorder,
  onComment,
  onDeleteComment,
  currentUserId,
  generalRequests = []
}: {
  client: Client;
  posts: Post[];
  isClient: boolean;
  statusMeta: Record<ContentStatus, { label: string; color: string; bg: string }>;
  onOpenPost: (post: Post) => void;
  onReorder: (posts: Post[]) => void;
  onComment?: (content: string) => void;
  onDeleteComment?: (commentId: string) => void;
  currentUserId?: string;
  generalRequests?: Comment[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ordered = posts.slice().sort((a, b) =>
    a.feed_order - b.feed_order ||
    new Date(b.scheduled_date || b.created_at).getTime() - new Date(a.scheduled_date || a.created_at).getTime()
  );
  const handle = toInstagramHandle(client.name, client.instagram_handle);
  const [comment, setComment] = useState("");

  function handleDragEnd(event: DragEndEvent) {
    if (isClient) return;
    const oldIndex = ordered.findIndex((post) => post.id === event.active.id);
    const newIndex = ordered.findIndex((post) => post.id === event.over?.id);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) onReorder(arrayMove(ordered, oldIndex, newIndex));
  }

  return (
    <div className="mx-auto max-w-6xl">
      <section className="premium-card overflow-hidden rounded-[18px] sm:rounded-[20px]">
        <div className="flex items-center justify-between border-b border-line px-3 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em]">@{handle}</h2>
            <p className="mt-1 text-xs text-muted">{isClient ? "Prévia editorial enviada pela agência" : "Arraste para reorganizar o feed em tempo real"}</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-2 text-xs font-semibold text-muted shadow-soft sm:flex">
            <Grid3X3 className="h-4 w-4" />
            Grid editorial
          </div>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map((post) => post.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-1 bg-white p-1 sm:gap-2 sm:p-2 lg:gap-3 lg:p-3">
              {ordered.map((post) => (
                <FeedTile
                  key={post.id}
                  post={post}
                  isClient={isClient}
                  statusMeta={statusMeta}
                  onClick={() => onOpenPost(post)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {generalRequests.length > 0 && (
          <div className="border-t border-line bg-white px-4 py-4 sm:px-5">
            {isClient && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-primary">Suas solicitações salvas</div>
                <div className="mt-1 text-xs text-muted">Você pode excluir uma solicitação se mudar de ideia.</div>
              </div>
            )}
            <div className="space-y-2">
              {generalRequests.slice(0, isClient ? 6 : 3).map((request) => (
                <div key={request.id} className="rounded-xl border border-accent/25 bg-accent-light/35 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-primary">
                      {isClient ? "Solicitação enviada" : `Cliente ${request.user_name} deixou uma solicitação:`}
                    </div>
                    {request.user_id === currentUserId && onDeleteComment && (
                      <button
                        className="rounded-md p-1.5 text-muted hover:bg-red-light hover:text-danger"
                        onClick={() => onDeleteComment(request.id)}
                        title="Excluir solicitação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-[#4a4568]">
                    {request.content.replace(/^Observação geral do preview do feed:\s*/i, "")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isClient && onComment && (
          <div className="border-t border-line bg-white p-3 sm:p-5">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Observação geral do preview do feed</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Ex: Gostei da sequência mas queria alterar o segundo post."
                className="premium-input min-h-28 w-full resize-y rounded-xl border border-line px-3 py-3 text-sm leading-6 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
            </label>
            <div className="mt-3 flex justify-end">
              <button
                className="premium-button inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-45"
                disabled={!comment.trim()}
                onClick={() => {
                  if (!comment.trim()) return;
                  onComment(comment.trim());
                  setComment("");
                }}
              >
                <Send className="h-4 w-4" />
                Enviar observação
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FeedTile({
  post,
  isClient,
  statusMeta,
  onClick
}: {
  post: Post;
  isClient: boolean;
  statusMeta: Record<ContentStatus, { label: string; color: string; bg: string }>;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: post.id, disabled: isClient });
  const media = post.media[0];
  const isVideo = post.content_format === "video" || post.media.some((item) => item.media_type === "video");
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="premium-card-hover overflow-hidden rounded-[6px] border border-line bg-white sm:rounded-[12px] lg:rounded-[14px]">
      <button
        {...attributes}
        {...listeners}
        onClick={onClick}
        className="group relative aspect-[4/5] w-full overflow-hidden bg-[#eeeaf4]"
      >
        {media ? (
          media.media_type === "video" ? (
            media.thumbnail_url ? (
              <img src={media.thumbnail_url} alt="" className="h-full w-full object-cover transition duration-150 group-hover:scale-[1.015]" loading="lazy" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
                <FileText className="h-7 w-7" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Vídeo</span>
              </div>
            )
          ) : (
            <img src={media.media_url} alt="" className="h-full w-full object-cover transition duration-150 group-hover:scale-[1.015]" loading="lazy" decoding="async" />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-muted"><FileText /></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-primary/72 opacity-0 transition group-hover:opacity-100">
          <Eye className="h-5 w-5 text-white" />
        </div>
        <span
          className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white sm:right-2 sm:top-2 sm:h-2.5 sm:w-2.5"
          style={{ background: statusMeta[post.status].color }}
        />
        {post.media.length > 1 && (
          <span className="absolute left-1 top-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px]">
            {post.media.length} slides
          </span>
        )}
        {isVideo && (
          <span className="absolute left-1 bottom-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur sm:left-2 sm:bottom-2 sm:px-2 sm:py-1 sm:text-[10px]">
            Vídeo
          </span>
        )}
      </button>
    </div>
  );
}
