import '../styles/modal-confirmacao.css'

export default function ModalConfirmacao({
  titulo,
  mensagem,
  labelConfirmar = 'Confirmar',
  labelCancelar  = 'Cancelar',
  variante       = 'primary',  // 'primary' | 'danger' | 'warning'
  icone,
  modo           = 'confirm',  // 'confirm' | 'alert'
  onConfirmar,
  onCancelar,
}) {
  function handleOverlay(e) {
    if (e.target === e.currentTarget) {
      modo === 'alert' ? onConfirmar?.() : onCancelar?.()
    }
  }

  const iconePadrao = {
    danger:  'fa-triangle-exclamation',
    warning: 'fa-circle-exclamation',
    primary: 'fa-circle-info',
  }[variante]

  return (
    <div className="mc-overlay" onClick={handleOverlay}>
      <div className="mc-box" role="dialog" aria-modal="true">
        <div className={`mc-icon-wrap mc-icon-${variante}`}>
          <i className={`fa-solid ${icone || iconePadrao}`} />
        </div>

        <div className="mc-body">
          {titulo && <div className="mc-titulo">{titulo}</div>}
          <div className="mc-mensagem">{mensagem}</div>
        </div>

        <div className="mc-actions">
          {modo === 'confirm' && (
            <button className="btn btn-ghost" onClick={onCancelar}>
              {labelCancelar}
            </button>
          )}
          <button
            className={`btn btn-${variante === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirmar}
            autoFocus
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
