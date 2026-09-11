"use client";

/**
 * Vitrine — os banners da home do app do cliente ("Banners da Home do app" no
 * canvas). O banner é global: o app não tem cidade, então aqui também não há
 * segmentação por cidade. A ordem da lista é a ordem do carrossel.
 */

import { useState } from "react";

import { StatusChip } from "./blocks";
import type { Chip } from "./data";
import { FormError, Modal, useRun } from "./dialogs";
import {
  bannerState,
  CATEGORY_LABEL,
  categoryLabel,
  stamp,
  type Banner,
  type BannerState,
  type BannerTarget,
  type EstablishmentCategory,
} from "./model";
import { useAdmin } from "./store";
import { AMBER, AMBER_SOFT, GREEN, GREEN_SOFT, MUTED, NEUTRAL_SOFT, RED, RED_SOFT } from "./tokens";

const STATE_CHIP: Record<BannerState, Chip> = {
  live: { label: "No ar", fg: GREEN, bg: GREEN_SOFT },
  scheduled: { label: "Agendado", fg: AMBER, bg: AMBER_SOFT },
  ended: { label: "Encerrado", fg: MUTED, bg: NEUTRAL_SOFT },
  paused: { label: "Pausado", fg: MUTED, bg: NEUTRAL_SOFT },
  unavailable: { label: "Destino indisponível", fg: RED, bg: RED_SOFT },
};

const TARGET_LABEL: Record<BannerTarget, string> = {
  establishment: "Loja",
  category: "Categoria",
  url: "Link",
};

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** "sem data", "desde 12 set 2026, 08:00", "12 set 2026, 08:00 → 20 set 2026, 23:59". */
function windowText(b: Pick<Banner, "startsAt" | "endsAt">): string {
  if (!b.startsAt && !b.endsAt) return "Sem data de início ou fim";
  if (!b.endsAt) return `desde ${stamp(b.startsAt!)}`;
  if (!b.startsAt) return `até ${stamp(b.endsAt)}`;
  return `${stamp(b.startsAt)} → ${stamp(b.endsAt)}`;
}

/** ISO → valor de `<input type="datetime-local">`, no fuso deste computador. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

export function Showcase() {
  const { data, actions, notify } = useAdmin();
  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const [removing, setRemoving] = useState<Banner | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canEdit = data.me.roleKey === "admin" || data.me.roleKey === "operations";
  const banners = [...data.banners].sort((a, b) => a.sortOrder - b.sortOrder);
  const states = new Map(banners.map((b) => [b.id, bannerState(b)]));
  const live = banners.filter((b) => states.get(b.id) === "live");
  const tally = (state: BannerState) => banners.filter((b) => states.get(b.id) === state).length;

  const act = async (key: string, action: () => Promise<void>, title: string, sub: string) => {
    setBusy(key);
    try {
      await action();
      notify({ title, sub });
    } catch (cause) {
      notify({
        title: "A ação não foi concluída",
        sub: cause instanceof Error ? cause.message : "Tente de novo.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    const ids = banners.map((b) => b.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    const banner = banners[index]!;
    void act(
      `move-${banner.id}`,
      () => actions.reorderBanners(ids),
      "Ordem salva",
      `"${banner.title}" agora é o ${target + 1}º do carrossel.`,
    );
  };

  return (
    <div className="showcase-grid">
      <div className="stack tight">
        <div className="filter-bar">
          <div className="showcase-counts">
            <StatusChip chip={STATE_CHIP.live} small />
            <code>{tally("live")}</code>
            <StatusChip chip={STATE_CHIP.scheduled} small />
            <code>{tally("scheduled")}</code>
            <StatusChip chip={STATE_CHIP.paused} small />
            <code>{tally("paused")}</code>
          </div>
          <span className="hint">
            Ordem da lista = ordem do carrossel. Vale para o app inteiro, sem cidade.
          </span>
          <div className="spacer" />
          <button
            className="primary"
            disabled={!canEdit}
            onClick={() => setEditing("new")}
            title={canEdit ? undefined : "Só operações ou administrador editam a vitrine."}
            type="button"
          >
            Novo banner
          </button>
        </div>

        <div className="card clip">
          {banners.length === 0 ? (
            <div className="showcase-empty">
              <strong>Nenhum banner na vitrine</strong>
              <p>
                Sem banner, a home do app começa direto nas categorias. Crie o primeiro para
                destacar uma loja, uma categoria ou uma campanha.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ordem</th>
                    <th>Banner</th>
                    <th>Destino</th>
                    <th>Situação</th>
                    <th className="right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {banners.map((banner, index) => {
                    const state = states.get(banner.id)!;
                    return (
                      <tr key={banner.id}>
                        <td>
                          <div className="showcase-order">
                            <code>{index + 1}</code>
                            <button
                              aria-label={`Subir ${banner.title}`}
                              className="ghost tiny"
                              disabled={!canEdit || index === 0 || busy !== null}
                              onClick={() => move(index, -1)}
                              type="button"
                            >
                              ↑
                            </button>
                            <button
                              aria-label={`Descer ${banner.title}`}
                              className="ghost tiny"
                              disabled={!canEdit || index === banners.length - 1 || busy !== null}
                              onClick={() => move(index, 1)}
                              type="button"
                            >
                              ↓
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="showcase-item">
                            {/* eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage, fora do otimizador */}
                            <img alt="" className="showcase-thumb" src={banner.imageUrl} />
                            <div>
                              <strong className="cell-title">{banner.title}</strong>
                              <small className="cell-sub">
                                {banner.subtitle || "Sem subtítulo"}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong className="cell-title showcase-target" title={banner.targetLabel}>
                            {banner.targetLabel}
                          </strong>
                          <small className="cell-sub">
                            {TARGET_LABEL[banner.targetKind]}
                            {state === "unavailable" ? " · loja fora do ar" : ""}
                          </small>
                        </td>
                        <td>
                          <div className="showcase-state">
                            <StatusChip chip={STATE_CHIP[state]} small />
                            <small className="cell-sub">{windowText(banner)}</small>
                          </div>
                        </td>
                        <td className="right">
                          <div className="showcase-row-actions">
                            <button
                              className="ghost tiny"
                              disabled={!canEdit || busy !== null}
                              onClick={() =>
                                void act(
                                  `active-${banner.id}`,
                                  () => actions.setBannerActive(banner.id, !banner.active),
                                  banner.active ? "Banner pausado" : "Banner reativado",
                                  banner.active
                                    ? `"${banner.title}" saiu da home do app.`
                                    : `"${banner.title}" volta a valer pela janela de exibição.`,
                                )
                              }
                              type="button"
                            >
                              {banner.active ? "Pausar" : "Ativar"}
                            </button>
                            <button
                              className="ghost tiny"
                              disabled={!canEdit || busy !== null}
                              onClick={() => setEditing(banner)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button
                              className="ghost tiny danger"
                              disabled={!canEdit || busy !== null}
                              onClick={() => setRemoving(banner)}
                              type="button"
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {!canEdit ? (
          <p className="hint">
            Seu papel só permite ver a vitrine. Operações ou administrador editam.
          </p>
        ) : null}
      </div>

      <aside className="card showcase-aside">
        <div className="card-head">
          <h3>Prévia na home do app</h3>
        </div>
        <div className="showcase-aside-body">
          <AppPreview banners={live} />
          <p className="hint">
            Mostra só o que está no ar agora, na ordem da lista. Agendado entra sozinho no início da
            janela; encerrado sai sozinho no fim. Banner de loja suspensa sai do ar até a loja
            voltar.
          </p>
        </div>
      </aside>

      {editing ? (
        <BannerDialog
          banner={editing === "new" ? null : editing}
          key={editing === "new" ? "new" : editing.id}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {removing ? <RemoveDialog banner={removing} onClose={() => setRemoving(null)} /> : null}
    </div>
  );
}

/** Um card do carrossel, no formato da home do app: imagem 2:1, texto por cima. */
function AppCard({
  imageUrl,
  title,
  subtitle,
}: {
  imageUrl: string | null;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="showcase-card">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob local ou URL pública do Storage
        <img alt="" src={imageUrl} />
      ) : (
        <div className="showcase-card-blank">Imagem 1200 × 600</div>
      )}
      <div className="showcase-card-text">
        <strong>{title || "Título do banner"}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
    </div>
  );
}

/** Um telefone com o topo da home: carrossel de banners e, embaixo, as categorias. */
function AppPreview({ banners }: { banners: Banner[] }) {
  return (
    <div className="showcase-phone">
      <div className="showcase-phone-notch" />
      {banners.length ? (
        <>
          <div className="showcase-carousel">
            {banners.map((b) => (
              <AppCard imageUrl={b.imageUrl} key={b.id} subtitle={b.subtitle} title={b.title} />
            ))}
          </div>
          <div className="showcase-dots">
            {banners.map((b, i) => (
              <i className={i === 0 ? "on" : undefined} key={b.id} />
            ))}
          </div>
        </>
      ) : (
        <p className="showcase-phone-empty">Nenhum banner no ar — a home começa nas categorias.</p>
      )}
      <div className="showcase-phone-section">
        <strong>Categorias</strong>
        <div className="showcase-cats">
          {Object.values(CATEGORY_LABEL)
            .slice(0, 4)
            .map((label) => (
              <span key={label}>
                <i />
                {label}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function BannerDialog({ banner, onClose }: { banner: Banner | null; onClose: () => void }) {
  const { data, actions } = useAdmin();
  const { pending, error, run, setError } = useRun(onClose);

  const stores = data.establishments
    .filter((e) => e.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const [title, setTitle] = useState(banner?.title ?? "");
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(banner?.imageUrl ?? null);
  const [kind, setKind] = useState<BannerTarget>(banner?.targetKind ?? "establishment");
  const [storeId, setStoreId] = useState(
    banner?.targetKind === "establishment" && stores.some((s) => s.id === banner.targetValue)
      ? banner.targetValue
      : "",
  );
  const [category, setCategory] = useState<EstablishmentCategory | "">(
    banner?.targetKind === "category" ? (banner.targetValue as EstablishmentCategory) : "",
  );
  const [url, setUrl] = useState(banner?.targetKind === "url" ? banner.targetValue : "https://");
  const [startsAt, setStartsAt] = useState(toLocalInput(banner?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(banner?.endsAt ?? null));

  const lostStore = banner?.targetKind === "establishment" && !storeId ? banner.targetLabel : null;
  const targetValue =
    kind === "establishment" ? storeId : kind === "category" ? category : url.trim();

  const pick = (next: File | undefined) => {
    if (!next) return;
    if (!IMAGE_TYPES.includes(next.type)) {
      setError("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("A imagem passa de 5 MB. Exporte menor e envie de novo.");
      return;
    }
    setError(null);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const submit = () => {
    const clean = title.trim();
    if (clean.length < 2) return setError("Dê um título ao banner (2 a 60 caracteres).");
    if (!banner && !file) return setError("Envie a imagem do banner.");
    if (!targetValue) return setError("Escolha para onde o banner leva.");
    if (kind === "url" && !/^https:\/\/\S+\.\S+/.test(targetValue))
      return setError("O link precisa começar com https://.");
    if (startsAt && endsAt && endsAt <= startsAt)
      return setError("O fim da exibição precisa ser depois do início.");
    void run(
      () =>
        actions.saveBanner({
          id: banner?.id,
          title: clean,
          subtitle: subtitle.trim(),
          file: file ?? undefined,
          targetKind: kind,
          targetValue,
          startsAt: fromLocalInput(startsAt),
          endsAt: fromLocalInput(endsAt),
        }),
      banner
        ? { title: "Banner salvo", sub: `"${clean}" foi atualizado.` }
        : { title: "Banner criado", sub: `"${clean}" entrou no fim do carrossel.` },
    );
  };

  return (
    <Modal labelledBy="banner-title" onClose={onClose} width={640}>
      <form
        className="showcase-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="modal-head">
          <h3 id="banner-title">{banner ? `Editar "${banner.title}"` : "Novo banner"}</h3>
          <p>
            Aparece no carrossel do topo da home do app, igual para todo mundo. Sai do ar sozinho
            fora da janela de exibição.
          </p>
        </div>
        <div className="modal-body">
          <div className="showcase-upload">
            <AppCard imageUrl={preview} subtitle={subtitle.trim()} title={title.trim()} />
            <div>
              <label className="ghost small showcase-file">
                {preview ? "Trocar imagem" : "Escolher imagem"}
                <input
                  accept={IMAGE_TYPES.join(",")}
                  id="banner-image"
                  onChange={(event) => pick(event.target.files?.[0])}
                  type="file"
                />
              </label>
              <p className="hint">
                JPG, PNG ou WebP, até 5 MB. Proporção 2:1 (1200 × 600 px); o texto vai por cima da
                parte de baixo.
                {file ? ` Nova: ${file.name}.` : ""}
              </p>
            </div>
          </div>

          <label>
            <span>
              Título <b className="required">obrigatório</b>
            </span>
            <input
              id="banner-title-input"
              maxLength={60}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Corte + barba com hora marcada"
              value={title}
            />
          </label>
          <label>
            <span>Subtítulo</span>
            <input
              id="banner-subtitle"
              maxLength={120}
              onChange={(event) => setSubtitle(event.target.value)}
              placeholder="Uma linha curta de apoio"
              value={subtitle}
            />
          </label>

          <div>
            <p className="field-group-label">Destino ao tocar</p>
            <div className="showcase-kinds" role="group" aria-label="Tipo de destino">
              {(Object.keys(TARGET_LABEL) as BannerTarget[]).map((k) => (
                <button
                  aria-pressed={kind === k}
                  className={kind === k ? "ghost small selected" : "ghost small"}
                  key={k}
                  onClick={() => setKind(k)}
                  type="button"
                >
                  {TARGET_LABEL[k]}
                </button>
              ))}
            </div>
            {kind === "establishment" ? (
              <select
                aria-label="Loja de destino"
                id="banner-store"
                onChange={(event) => setStoreId(event.target.value)}
                value={storeId}
              >
                <option value="">Escolha uma loja ativa…</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.city}
                  </option>
                ))}
              </select>
            ) : null}
            {kind === "category" ? (
              <select
                aria-label="Categoria de destino"
                id="banner-category"
                onChange={(event) => setCategory(event.target.value as EstablishmentCategory)}
                value={category}
              >
                <option value="">Escolha uma categoria…</option>
                {(Object.keys(CATEGORY_LABEL) as EstablishmentCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            ) : null}
            {kind === "url" ? (
              <input
                aria-label="Link de destino"
                className="mono"
                id="banner-url"
                maxLength={500}
                onChange={(event) => setUrl(event.target.value)}
                value={url}
              />
            ) : null}
            <p className="hint">
              {kind === "establishment"
                ? lostStore
                  ? `${lostStore} não está mais ativa. Escolha outro destino.`
                  : "Abre a página da loja. Só lojas ativas aparecem na lista."
                : kind === "category"
                  ? "Abre a lista de lojas da categoria."
                  : "Abre o link fora do app. Só https."}
            </p>
          </div>

          <div className="row-fields">
            <label className="field-grow">
              <span>Início da exibição</span>
              <input
                id="banner-starts"
                onChange={(event) => setStartsAt(event.target.value)}
                type="datetime-local"
                value={startsAt}
              />
            </label>
            <label className="field-grow">
              <span>Fim da exibição</span>
              <input
                id="banner-ends"
                onChange={(event) => setEndsAt(event.target.value)}
                type="datetime-local"
                value={endsAt}
              />
            </label>
          </div>
          <p className="hint">Em branco, não tem limite daquele lado. Horário deste computador.</p>
          <FormError message={error} />
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={pending} type="submit">
            {pending
              ? file
                ? "Enviando imagem…"
                : "Salvando…"
              : banner
                ? "Salvar"
                : "Criar banner"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveDialog({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  const { actions } = useAdmin();
  const { pending, error, run } = useRun(onClose);
  const state = bannerState(banner);

  return (
    <Modal labelledBy="banner-remove-title" onClose={onClose} width={440}>
      <div className="modal-head">
        <h3 id="banner-remove-title">Remover &quot;{banner.title}&quot;?</h3>
        <p>
          {state === "live" ? "O banner está no ar e sai da home do app agora. " : ""}A imagem é
          apagada do armazenamento. Não dá para desfazer — para tirar do ar por um tempo, use
          Pausar.
        </p>
      </div>
      <div className="modal-body">
        <FormError message={error} />
      </div>
      <div className="modal-foot">
        <button className="ghost" onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className="danger-solid"
          disabled={pending}
          onClick={() =>
            void run(() => actions.deleteBanner(banner.id), {
              title: "Banner removido",
              sub: `"${banner.title}" saiu da vitrine.`,
            })
          }
          type="button"
        >
          {pending ? "Removendo…" : "Remover banner"}
        </button>
      </div>
    </Modal>
  );
}
