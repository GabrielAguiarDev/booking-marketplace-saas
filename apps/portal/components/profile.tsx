"use client";

import { useRef, useState } from "react";

import { useSave } from "./cadastro-ui";
import { usePortal } from "./store";
import { CORAL, FAINT, MUTED } from "./tokens";

const COLORS = ["#1F6FEB", "#14171A", "#0E7C3E", "#8B3A1E", "#6D3AC7", "#7B2136", CORAL];

/**
 * Perfil público: o que o cliente vê antes de decidir.
 *
 * A prévia à direita é montada com os mesmos campos que estão sendo editados —
 * inclusive a nota, que vem de `rating_avg`. Quando ainda não há avaliação, a
 * prévia diz isso em vez de inventar 4,9 (R7).
 */
export function Profile() {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();
  const fileInput = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState(data?.establishment.description ?? "");
  const [addressLine, setAddressLine] = useState(data?.establishment.address_line ?? "");
  const [neighborhood, setNeighborhood] = useState(data?.establishment.neighborhood ?? "");
  const [phone, setPhone] = useState(data?.establishment.phone ?? "");
  const [accent, setAccent] = useState(data?.establishment.accentColor ?? COLORS[0]!);

  if (!data) return null;
  const canWrite = data.establishment.role !== "staff";

  const dirty =
    description !== (data.establishment.description ?? "") ||
    addressLine !== (data.establishment.address_line ?? "") ||
    neighborhood !== (data.establishment.neighborhood ?? "") ||
    phone !== (data.establishment.phone ?? "") ||
    accent !== (data.establishment.accentColor ?? COLORS[0]!);

  const save = () =>
    void run(
      () =>
        actions.savePublicProfile(data.establishment.id, {
          description: description.trim() || null,
          addressLine: addressLine.trim() || null,
          neighborhood: neighborhood.trim() || null,
          phone: phone.trim() || null,
          accentColor: accent,
        }),
      "Perfil atualizado.",
    );

  const upload = (file: File | undefined) => {
    if (!file) return;
    void run(() => actions.uploadPhoto(data.establishment.id, file), "Foto enviada.");
  };

  // Só serviço ativo com alguém ativo que o execute gera horário; é o que a
  // prévia pode prometer sem mentir.
  const sellable = data.services.filter(
    (service) =>
      service.isActive &&
      service.professionalIds.some(
        (id) => data.professionals.find((item) => item.id === id)?.isActive,
      ),
  );

  return (
    <div className="profile-grid">
      <section className="panel">
        <header className="panel-head stacked">
          <h2>O que o cliente vê no app</h2>
          <p>Tudo aqui aparece na hora na prévia do lado.</p>
        </header>
        <div className="profile-form">
          <div>
            <p className="field-label">Galeria</p>
            <div className="gallery">
              {data.photos.map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    backgroundImage: `url(${photo.url})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                    position: "relative",
                  }}
                >
                  {canWrite ? (
                    <button
                      aria-label="Apagar foto"
                      className="ghost small"
                      disabled={pending}
                      onClick={() =>
                        void run(
                          () =>
                            actions.removePhoto({ id: photo.id, storagePath: photo.storagePath }),
                          "Foto apagada.",
                        )
                      }
                      style={{ position: "absolute", right: 4, top: 4, background: "#fff" }}
                      type="button"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
              {canWrite ? (
                <div>
                  <button
                    className="link"
                    disabled={pending}
                    onClick={() => fileInput.current?.click()}
                    type="button"
                  >
                    {pending ? "enviando…" : "+ adicionar"}
                  </button>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(event) => {
                      upload(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                    ref={fileInput}
                    type="file"
                  />
                </div>
              ) : null}
            </div>
            <p className="form-note">
              JPG, PNG ou WebP até 5 MB.{" "}
              {data.photos.length === 0
                ? "Sem foto, o perfil aparece bem abaixo na busca."
                : `${data.photos.length} ${data.photos.length === 1 ? "foto publicada" : "fotos publicadas"}.`}
            </p>
          </div>

          <label>
            <p className="field-label">Descrição que aparece no app</p>
            <textarea
              disabled={!canWrite}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="O que a loja faz, o que a diferencia, desde quando existe."
              rows={4}
              style={{ width: "100%" }}
              value={description}
            />
          </label>

          <label>
            <p className="field-label">Endereço</p>
            <input
              disabled={!canWrite}
              onChange={(event) => setAddressLine(event.target.value)}
              placeholder="Rua, número"
              style={{ width: "100%" }}
              value={addressLine}
            />
          </label>

          <label>
            <p className="field-label">Bairro</p>
            <input
              disabled={!canWrite}
              onChange={(event) => setNeighborhood(event.target.value)}
              style={{ width: "100%" }}
              value={neighborhood}
            />
          </label>

          <label>
            <p className="field-label">Telefone</p>
            <input
              disabled={!canWrite}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(00) 00000-0000"
              style={{ width: "100%" }}
              value={phone}
            />
          </label>

          <div>
            <p className="field-label">Cor da sua marca no app</p>
            <div className="swatches">
              {COLORS.map((color) => (
                <button
                  aria-label={`Usar a cor ${color}`}
                  className={color === accent ? "swatch picked" : "swatch"}
                  disabled={!canWrite}
                  key={color}
                  onClick={() => setAccent(color)}
                  style={{ background: color }}
                  type="button"
                />
              ))}
              <code>{accent}</code>
            </div>
          </div>

          {canWrite ? (
            <div className="register-actions">
              <button
                className="primary small"
                disabled={!dirty || pending}
                onClick={save}
                type="button"
              >
                {pending ? "Salvando…" : "Salvar perfil"}
              </button>
            </div>
          ) : (
            <p className="form-note">Só dono ou gerente edita o perfil público.</p>
          )}
        </div>
      </section>

      <aside className="preview">
        <code className="preview-label">PRÉVIA · APP DO CLIENTE</code>
        <div className="phone">
          <div className="phone-hero">
            {data.photos[0] ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                alt=""
                src={data.photos[0].url}
                style={{ height: "100%", objectFit: "cover", width: "100%" }}
              />
            ) : (
              <i style={{ background: accent }} />
            )}
          </div>
          <div className="phone-body">
            <strong>{data.establishment.name}</strong>
            <p className="phone-rating">
              {data.establishment.ratingCount > 0 ? (
                <>
                  <code style={{ color: accent }}>
                    {data.establishment.ratingAvg?.toFixed(1).replace(".", ",")}
                  </code>
                  <span>
                    · {data.establishment.ratingCount}{" "}
                    {data.establishment.ratingCount === 1 ? "avaliação" : "avaliações"}
                  </span>
                </>
              ) : (
                <span style={{ color: FAINT }}>ainda sem avaliação</span>
              )}
            </p>
            <p className="phone-desc" style={{ color: description ? undefined : FAINT }}>
              {description || "Sem descrição — o cliente abre o perfil e não sabe o que esperar."}
            </p>
            <div className="phone-slots">
              {sellable.length === 0 ? (
                <code style={{ color: MUTED }}>nenhum serviço no ar</code>
              ) : (
                sellable.slice(0, 4).map((service) => <code key={service.id}>{service.name}</code>)
              )}
            </div>
            <div className="phone-cta" style={{ background: accent }}>
              {data.establishment.bookingMode === "queue" ? "Entrar na fila" : "Agendar"}
            </div>
            <div className="phone-alt">
              {data.establishment.bookingMode === "scheduled"
                ? "Só com hora marcada"
                : "Entrar na fila de espera"}
            </div>
          </div>
        </div>
        <p className="form-note" style={{ padding: "0 4px" }}>
          Os horários oferecidos vêm da jornada da equipe, não daqui. A prévia mostra a capa, o
          nome, a descrição e a cor.
        </p>
      </aside>
    </div>
  );
}
