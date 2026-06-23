import { useEffect, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Polygon, CircleMarker,
  Marker, Popup, useMap, useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const ZOOM_THRESHOLD = 12

// ── Formatadores ──────────────────────────────────────────────────────────────
function fmtNum(n) {
  return n != null && !isNaN(n) ? Number(n).toLocaleString('pt-BR') : '—'
}
function fmtBRL(n) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) {
    const bi = n / 1000
    return 'R$ ' + bi.toLocaleString('pt-BR', { minimumFractionDigits: bi % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }) + ' bi'
  }
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 }) + ' mi'
}
function fmtArea(n) {
  return n ? (n / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ha' : '—'
}

// ── Popup de detalhes ─────────────────────────────────────────────────────────
function PopupContent({ item }) {
  if (!item.e) {
    return (
      <div>
        <div className="lb-popup-header">
          <div className="lb-popup-title">{item.n}</div>
        </div>
        <div className="lb-popup-nodata">Área KML sem dados da planilha vinculados.</div>
      </div>
    )
  }
  const e = item.e
  const color = item._color || '#7f8c8d'
  const isOn  = e.on_off === 1
  return (
    <div>
      <div className="lb-popup-header">
        {e.regional && <div className="lb-popup-badge" style={{ background: color }}>{e.regional}</div>}
        {e.cidade   && <div className="lb-popup-city">{e.cidade}{e.uf ? `, ${e.uf}` : ''}</div>}
        <div className="lb-popup-title">
          {e.empreendimento || e.nome || item.n}
        </div>
      </div>
      <div className="lb-popup-body">
        <div className="lb-popup-grid">
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">Tipo</span>
            <span className="lb-popup-val">{e.tipo || '—'}</span>
          </div>
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">Ano Prev.</span>
            <span className="lb-popup-val">{e.year || '—'}</span>
          </div>
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">Área Total</span>
            <span className="lb-popup-val">{fmtArea(e.area_total)}</span>
          </div>
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">Unidades</span>
            <span className="lb-popup-val">{fmtNum(e.total_unidades)}</span>
          </div>
          <hr className="lb-popup-divider" />
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">VGV Total</span>
            <span className="lb-popup-val green">{fmtBRL(e.vgv_total)}</span>
          </div>
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">VGV BT</span>
            <span className="lb-popup-val green">{fmtBRL(e.vgv_bt)}</span>
          </div>
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">Custo Terreno</span>
            <span className="lb-popup-val">{fmtBRL(e.custo_terreno)}</span>
          </div>
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">Custo Construção</span>
            <span className="lb-popup-val">{fmtBRL(e.custo_construcao)}</span>
          </div>
          <hr className="lb-popup-divider" />
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">Part. Buriti</span>
            <span className="lb-popup-val">
              {e.participacao_buriti ? (e.participacao_buriti * 100).toFixed(1) + '%' : '—'}
            </span>
          </div>
          <div className="lb-popup-cell">
            <span className="lb-popup-lbl">Status</span>
            <span className={isOn ? 'lb-popup-status-on' : 'lb-popup-status-off'}>
              {isOn ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Ícone de overview marker ──────────────────────────────────────────────────
function makeOverviewIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="lb-ov-pin" style="--pin-color:${color}"></div>`,
    iconSize:      [14, 20],
    iconAnchor:    [7, 20],
    tooltipAnchor: [0, -22],
  })
}

// ── Controller: flyTo quando item da lista é clicado ─────────────────────────
function MapController({ flyTo }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (!flyTo || flyTo === prev.current) return
    prev.current = flyTo
    map.flyTo(flyTo.coords, flyTo.zoom, { duration: 1.0, easeLinearity: 0.35 })
  }, [flyTo, map])
  return null
}

// ── Visibilidade overview/polígonos por zoom ──────────────────────────────────
function ZoomController({ onZoomChange }) {
  useMapEvents({
    zoomend: (e) => onZoomChange(e.target.getZoom()),
  })
  return null
}

// ── Componente principal do mapa ──────────────────────────────────────────────
export default function LandbankMap({ items, flyTo, onItemSelect, highlightedIdx }) {
  const [zoom, setZoom]             = useState(4)
  const [layers, setLayers]         = useState({ satellite: true, streets: false, terrain: false, vegetation: false })
  const [layerPanelOpen, setPanel]  = useState(true)
  const isOverview = zoom < ZOOM_THRESHOLD

  const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  const streetsUrl   = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  const terrainUrl   = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'

  function toggleLayer(key) {
    setLayers(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (key === 'satellite' && next.satellite) next.streets = false
      if (key === 'streets'   && next.streets)   next.satellite = false
      if (!next.satellite && !next.streets)      next.streets = true
      return next
    })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={[-12, -50]}
        zoom={4}
        zoomControl={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <MapController flyTo={flyTo} />
        <ZoomController onZoomChange={setZoom} />

        {/* Tile layers */}
        {layers.satellite && <TileLayer url={satelliteUrl} maxZoom={19} />}
        {layers.streets   && <TileLayer url={streetsUrl}   maxZoom={19} />}
        {layers.terrain   && <TileLayer url={terrainUrl}   maxZoom={17} opacity={0.7} />}
        {layers.vegetation && <TileLayer url={terrainUrl}  maxZoom={17} opacity={0.55} />}

        {/* Polígonos e markers — visíveis no zoom alto */}
        {!isOverview && items.map((item, idx) => {
          const color = item._color
          const centroid = item.c

          return item.p.length > 0
            ? item.p.map((coords, pi) => (
                <Polygon
                  key={`${idx}-${pi}`}
                  positions={coords}
                  pathOptions={{
                    color, weight: highlightedIdx === idx ? 3 : 2,
                    opacity: 0.9, fillColor: color,
                    fillOpacity: highlightedIdx === idx ? 0.35 : 0.15,
                    smoothFactor: 1.2,
                  }}
                  eventHandlers={{ click: () => onItemSelect(idx) }}
                >
                  <Popup maxWidth={320}>
                    <PopupContent item={item} />
                  </Popup>
                </Polygon>
              ))
            : centroid
              ? (
                <CircleMarker
                  key={idx}
                  center={centroid}
                  radius={7}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 2.5 }}
                  eventHandlers={{ click: () => onItemSelect(idx) }}
                >
                  <Popup maxWidth={320}>
                    <PopupContent item={item} />
                  </Popup>
                </CircleMarker>
              )
              : null
        })}

        {/* Overview markers — visíveis no zoom baixo */}
        {isOverview && items.map((item, idx) => {
          const centroid = item.c
          if (!centroid) return null
          const color  = item._color
          const linked = !!item.e
          const name   = linked ? (item.e.empreendimento || item.e.nome || item.n) : item.n
          const city   = linked ? (item.e.cidade || '') : ''
          const regional = linked ? (item.e.regional || '') : ''
          const units  = linked && item.e.total_unidades ? fmtNum(item.e.total_unidades) + ' unidades' : ''

          return (
            <Marker
              key={`ov-${idx}`}
              position={centroid}
              icon={makeOverviewIcon(color)}
              zIndexOffset={200}
              eventHandlers={{ click: () => onItemSelect(idx, 13) }}
            >
              <Popup maxWidth={220}>
                <div className="lb-ov-tooltip">
                  {regional && <div><span className="lb-ov-tag" style={{ background: color }}>{regional}</span></div>}
                  {city     && <div className="lb-ov-city">{city}</div>}
                  <div>{name}</div>
                  {units    && <div className="lb-ov-units">{units}</div>}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Painel de camadas */}
      <div className="lb-layer-panel">
        <div className="lb-layer-header" onClick={() => setPanel(v => !v)}>
          <i className="fa-solid fa-layer-group" />
          Camadas
          <i className={`fa-solid fa-chevron-down lb-chevron${layerPanelOpen ? ' open' : ''}`} />
        </div>
        {layerPanelOpen && (
          <div className="lb-layer-body">
            {[
              { key: 'streets',    label: 'Mapa Base (Ruas)' },
              { key: 'satellite',  label: 'Satélite' },
              { key: 'terrain',    label: 'Relevo / Topografia' },
              { key: 'vegetation', label: 'Cobertura Vegetal' },
            ].map(({ key, label }) => (
              <label key={key} className="lb-layer-option">
                <input
                  type="checkbox"
                  checked={!!layers[key]}
                  onChange={() => toggleLayer(key)}
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div style={{
        position: 'absolute', bottom: 8, right: 12,
        fontSize: 10, color: 'rgba(255,255,255,0.7)',
        zIndex: 400, pointerEvents: 'none',
        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
      }}>
        Centro de Inteligência e Dados · v2.0
      </div>
    </div>
  )
}
