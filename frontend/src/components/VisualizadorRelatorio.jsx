import { useEffect, useRef, useState } from 'react'
import * as pbi from 'powerbi-client'

const API = 'http://localhost:8000'

const powerbi = new pbi.service.Service(
  pbi.factories.hpmFactory,
  pbi.factories.wpmpFactory,
  pbi.factories.routerFactory,
)

export default function VisualizadorRelatorio({ relatorio, onClose }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('carregando') // carregando | erro | ok
  const [erro, setErro]     = useState('')

  useEffect(() => {
    let report = null

    async function carregar() {
      try {
        const user = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
        const resp = await fetch(`${API}/relatorios/${relatorio.id}/embed`, {
          headers: { 'X-Usuario-Id': user.id ?? '' },
        })
        if (!resp.ok) {
          const d = await resp.json()
          throw new Error(d.detail || 'Erro ao obter token de embed.')
        }
        const { embed_url, embed_token, report_id } = await resp.json()

        const config = {
          type:        'report',
          id:          report_id,
          embedUrl:    embed_url,
          accessToken: embed_token,
          tokenType:   pbi.models.TokenType.Embed,
          settings: {
            navContentPaneEnabled: false,
            filterPaneEnabled:     false,
            displayOption:         pbi.models.DisplayOption.FitToPage,
          },
        }

        report = powerbi.embed(containerRef.current, config)
        report.on('loaded', () => setStatus('ok'))
        report.on('error', () => { setStatus('erro'); setErro('O relatório retornou um erro ao carregar.') })
      } catch (e) {
        setStatus('erro')
        setErro(e.message)
      }
    }

    carregar()

    return () => {
      if (containerRef.current) powerbi.reset(containerRef.current)
    }
  }, [relatorio.id])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'var(--gray-900)',
        color: '#fff',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fa-solid fa-chart-bar" style={{ color: 'var(--brand-400)' }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>{relatorio.nome}</span>
          {relatorio.categoria && (
            <span style={{ fontSize: 12, color: 'var(--gray-400)', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 99 }}>
              {relatorio.categoria}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: 18, padding: '4px 8px', borderRadius: 6,
            transition: 'background var(--t-base)',
          }}
          title="Fechar"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      {/* Corpo */}
      <div style={{ flex: 1, position: 'relative', background: '#f4f4f4' }}>

        {/* Estado: carregando */}
        {status === 'carregando' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 14, color: 'var(--gray-500)', fontSize: 14,
          }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--brand-500)' }} />
            Carregando relatório...
          </div>
        )}

        {/* Estado: erro */}
        {status === 'erro' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: 32, textAlign: 'center',
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 32, color: 'var(--red-500)' }} />
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--gray-800)' }}>Não foi possível carregar o relatório</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', maxWidth: 480 }}>{erro}</div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
          </div>
        )}

        {/* Container do Power BI */}
        <div
          ref={containerRef}
          className="pbi-container"
          style={{
            position: 'absolute', inset: 0,
            opacity: status === 'ok' ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        />
      </div>
    </div>
  )
}
