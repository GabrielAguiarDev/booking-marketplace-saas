"use client";

import { CircleAlert, Toggle } from "./blocks";
import { ESTABLISHMENTS } from "./data";

function Modal({
  children,
  onClose,
  width,
}: {
  children: React.ReactNode;
  onClose: () => void;
  width: number;
}) {
  return (
    <div className="overlay">
      <button aria-label="Fechar" className="overlay-backdrop" onClick={onClose} type="button" />
      <div className="modal" style={{ width }}>
        {children}
      </div>
    </div>
  );
}

export function AccessModal({ estabId, onClose }: { estabId: string; onClose: () => void }) {
  const est = ESTABLISHMENTS.find((item) => item.id === estabId) ?? ESTABLISHMENTS[0]!;

  return (
    <Modal onClose={onClose} width={520}>
      <div className="modal-head">
        <h3>Acessar conta de {est.name}</h3>
        <p>
          Você entrará na conta do estabelecimento em modo somente leitura. A sessão é registrada na
          auditoria com seu nome, o motivo informado e tudo que for visitado.
        </p>
      </div>
      <div className="modal-body">
        <label>
          <span>
            Motivo <b className="required">obrigatório</b>
          </span>
          <textarea placeholder="Ex.: investigar agendamentos duplicados relatados no chamado #4417" />
        </label>
        <div className="row-fields">
          <label className="field-grow">
            <span>Prazo da sessão</span>
            <select defaultValue="15 minutos">
              <option>15 minutos</option>
              <option>30 minutos</option>
              <option>1 hora</option>
            </select>
          </label>
          <label className="field-grow">
            <span>Modo</span>
            <div className="static-field">
              <Toggle on />
              <strong>Somente leitura</strong>
            </div>
          </label>
        </div>
        <p className="callout amber icon">
          <CircleAlert />
          Sessão auditada · visível ao estabelecimento no registro dele
        </p>
      </div>
      <div className="modal-foot">
        <button className="ghost" onClick={onClose} type="button">
          Cancelar
        </button>
        <button className="primary" onClick={onClose} type="button">
          Iniciar sessão auditada
        </button>
      </div>
    </Modal>
  );
}

export function CityModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} width={480}>
      <div className="modal-head">
        <h3>Abrir nova cidade</h3>
        <p>
          A cidade entra em pré-lançamento: aceita cadastros, mas não aparece na busca do app até
          ser ativada.
        </p>
      </div>
      <div className="modal-body">
        <div className="row-fields">
          <label className="field-grow">
            <span>Cidade</span>
            <input placeholder="Ex.: Uberlândia" />
          </label>
          <label className="uf-field">
            <span>UF</span>
            <select defaultValue="MG">
              <option>MG</option>
              <option>SP</option>
              <option>PR</option>
            </select>
          </label>
        </div>
        <div className="row-fields">
          <label className="field-grow">
            <span>Vagas de mensalidade</span>
            <input className="mono" defaultValue="12" />
          </label>
          <label className="field-grow">
            <span>Preço do plano ali</span>
            <input className="mono" defaultValue="R$ 229,00" />
          </label>
        </div>
      </div>
      <div className="modal-foot">
        <button className="ghost" onClick={onClose} type="button">
          Cancelar
        </button>
        <button className="primary" onClick={onClose} type="button">
          Abrir cidade
        </button>
      </div>
    </Modal>
  );
}

export function PlanImpactModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} width={470}>
      <div className="modal-head">
        <h3>Editar plano Mensalidade fixa</h3>
        <p>Confira o alcance da mudança antes de confirmar.</p>
      </div>
      <div className="modal-body">
        <div className="impact-banner">
          <code>802</code>
          <p>
            estabelecimentos vigentes serão impactados em 8 cidades. A mudança entra em vigor no
            próximo ciclo de cobrança de cada um.
          </p>
        </div>
        <div className="impact-list">
          <div>
            <span>Preço em São Paulo</span>
            <code>R$ 349,00 → R$ 379,00</code>
          </div>
          <div>
            <span>Limite de profissionais</span>
            <code>12 → 15</code>
          </div>
          <div className="last">
            <span>Aviso ao estabelecimento</span>
            <b>30 dias antes</b>
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="ghost" onClick={onClose} type="button">
          Cancelar
        </button>
        <button className="danger-solid" onClick={onClose} type="button">
          Confirmar para 802 contratos
        </button>
      </div>
    </Modal>
  );
}
