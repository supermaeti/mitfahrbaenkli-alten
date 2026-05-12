import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

/* ── Supabase ─────────────────────────────────────────────── */
const sb = createClient(
  'https://zdljleqeqdmgwuocxzcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkbGpsZXFlcWRtZ3d1b2N4emNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDk5OTAsImV4cCI6MjA5NDA4NTk5MH0.wHPF3I2J10IY0HKkyjYDfotfbUB0EPKtXLT16EVGTW0'
)

/* ── Konfiguration ────────────────────────────────────────── */
const CODE  = 'ALTEN25'
const STOPS = ['Marthalen Bahnhof', 'Alten', 'Andelfingen Meier Elektro']
const SH    = { 'Marthalen Bahnhof': 'Marthalen Bf.', 'Alten': 'Alten', 'Andelfingen Meier Elektro': 'Andelfingen' }
const HH    = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MM    = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const tday  = () => new Date().toISOString().split('T')[0]
const hash  = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i); return (h >>> 0).toString(36) }
const dlbl  = (d, t) => new Date(d + 'T' + t).toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })
const isPast = (d, t) => new Date(d + 'T' + t) < new Date()

/* ── Session (localStorage) ───────────────────────────────── */
const sess = {
  get:   () => { try { return JSON.parse(localStorage.getItem('mfb')) } catch { return null } },
  save:  u  => localStorage.setItem('mfb', JSON.stringify(u)),
  clear: () => localStorage.removeItem('mfb'),
}

/* ── Datenbank-Helfer ─────────────────────────────────────── */
const db = {
  async findUser(name, year) {
    const { data } = await sb.from('users').select('*')
      .eq('name', name.trim().toLowerCase()).eq('birthyear', year).maybeSingle()
    return data
  },
  async registerUser(name, year, pinHash) {
    const { data, error } = await sb.from('users').insert({
      name: name.trim().toLowerCase(), birthyear: year,
      display_name: name.trim(), pin_hash: pinHash,
    }).select().single()
    if (error) throw error
    return data
  },
  async getRides() {
    const { data } = await sb.from('rides').select('*, bookings(*)')
      .gte('date', tday()).order('date').order('time')
    return (data || []).filter(r => !isPast(r.date, r.time))
  },
  async addRide(r) {
    const { data, error } = await sb.from('rides').insert(r).select().single()
    if (error) throw error
    return data
  },
  async updateRide(id, u) {
    const { error } = await sb.from('rides').update(u).eq('id', id)
    if (error) throw error
  },
  async deleteRide(id) { await sb.from('rides').delete().eq('id', id) },
  async bookRide(rideId, userId, userName, seats) {
    const { data: r } = await sb.from('rides').select('seats_left').eq('id', rideId).single()
    if (!r || r.seats_left < seats) throw new Error('Nicht genug Plätze')
    await sb.from('bookings').insert({ ride_id: rideId, user_id: userId, user_name: userName, seats })
    await sb.from('rides').update({ seats_left: r.seats_left - seats }).eq('id', rideId)
  },
  async cancelBooking(bookingId, rideId, seats) {
    await sb.from('bookings').delete().eq('id', bookingId)
    const { data: r } = await sb.from('rides').select('seats_left').eq('id', rideId).single()
    if (r) await sb.from('rides').update({ seats_left: r.seats_left + seats }).eq('id', rideId)
  },
  async getRequests() {
    const { data } = await sb.from('requests').select('*')
      .gte('date', tday()).order('date').order('time')
    return (data || []).filter(r => !isPast(r.date, r.time))
  },
  async addRequest(r) {
    const { data, error } = await sb.from('requests').insert(r).select().single()
    if (error) throw error
    return data
  },
  async acceptRequest(req, driver) {
    const ride = await db.addRide({
      driver_id: driver.id, driver_name: driver.display_name,
      from_stop: req.from_stop, to_stop: req.to_stop,
      date: req.date, time: req.time, seats: 1, seats_left: 0,
      note: `Mitnahme von ${req.requester_name}`,
    })
    await sb.from('bookings').insert({ ride_id: ride.id, user_id: req.requester_id, user_name: req.requester_name, seats: 1 })
    await sb.from('requests').update({ status: 'accepted', driver_id: driver.id, driver_name: driver.display_name }).eq('id', req.id)
  },
  async deleteRequest(id) { await sb.from('requests').delete().eq('id', id) },
}

/* ── Design ───────────────────────────────────────────────── */
const P = '#2d6a4f', A = '#52b788', L = '#d8f3dc', R = '#ef4444', G = '#6b7280'
const sInp  = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #cde0d0', fontSize: 16, boxSizing: 'border-box', outline: 'none', background: '#f7fbf8', fontFamily: 'inherit' }
const sCard = { background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 2px 16px rgba(40,100,60,0.08)', marginBottom: 12 }
const sLbl  = { fontSize: 12, fontWeight: 700, color: G, marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }
const sBtn  = (bg = P, col = '#fff') => ({ background: bg, color: col, border: 'none', borderRadius: 12, padding: '13px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%', fontFamily: 'inherit' })
const sTag  = c => ({ background: c + '22', color: c, borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center' })

/* ── Icons ────────────────────────────────────────────────── */
const IP = {
  car:    'M5 13l1.5-4.5h11L19 13M3 17h1v1a1 1 0 002 0v-1h12v1a1 1 0 002 0v-1h1v-4l-2-6H5L3 13v4zm4-2a1 1 0 110 2 1 1 0 010-2zm10 0a1 1 0 110 2 1 1 0 010-2z',
  ticket: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 000 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 000-4V7a2 2 0 00-2-2H5z',
  user:   'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  clock:  'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  check:  'M20 6L9 17l-5-5',
  trash:  'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  out:    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  swap:   'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
  bench:  'M4 17h16M4 17v2M20 17v2M7 17V9m10 8V9M5 9h14',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  back:   'M19 12H5M12 5l-7 7 7 7',
  hand:   'M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v0m-2 6V6a2 2 0 00-2-2v0a2 2 0 00-2 2v4m0 0v6a6 6 0 0012 0v-4',
}
const Icon = ({ n, size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={IP[n]} />
  </svg>
)

/* ── Kleine Hilfskomponenten ──────────────────────────────── */
const ErrBox = ({ msg }) => msg ? <div style={{ color: R, fontSize: 14, marginBottom: 16, padding: '10px 14px', background: '#fef2f2', borderRadius: 10 }}>{msg}</div> : null
const OkBox  = ({ msg }) => msg ? <div style={{ background: L, borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, color: '#1b4332', fontWeight: 600 }}><Icon n="check" size={18} color={P} />{msg}</div> : null

function ConfirmModal({ title, msg, confirmLabel = 'Ja, stornieren', confirmColor = R, onYes, onNo }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{title}</h3>
        <p style={{ color: G, margin: '0 0 24px', fontSize: 15, lineHeight: 1.5 }}>{msg}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={sBtn('#f4f7f4', G)} onClick={onNo}>Abbrechen</button>
          <button style={sBtn(confirmColor)} onClick={onYes}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function StopSelector({ from, to, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <label style={sLbl}>Von</label>
        <select style={sInp} value={from} onChange={e => onChange(e.target.value, to === e.target.value ? '' : to)}>
          {STOPS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <button onClick={() => to && onChange(to, from)}
        style={{ background: '#f0faf4', border: 'none', borderRadius: 10, width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }}>
        <Icon n="swap" size={18} color={P} />
      </button>
      <div style={{ flex: 1 }}>
        <label style={sLbl}>Nach</label>
        <select style={sInp} value={to} onChange={e => onChange(from, e.target.value)}>
          <option value="">– wählen –</option>
          {STOPS.filter(s => s !== from).map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
  )
}

/* ── PIN-Eingabe ──────────────────────────────────────────── */
function PinInput({ value, onChange, autoFocus }) {
  const r0 = useRef(), r1 = useRef(), r2 = useRef(), r3 = useRef()
  const refs = [r0, r1, r2, r3]
  useEffect(() => { if (autoFocus) setTimeout(() => r0.current?.focus(), 150) }, [autoFocus])
  const onKD = (i, e) => {
    if (e.key !== 'Backspace') return
    e.preventDefault()
    const a = [0,1,2,3].map(j => value[j] || '')
    if (a[i]) { a[i] = ''; onChange(a.join('')) }
    else if (i > 0) { a[i-1] = ''; onChange(a.join('')); refs[i-1].current?.focus() }
  }
  const onCh = (i, e) => {
    const d = e.target.value.replace(/\D/g, '').slice(-1)
    if (!d) return
    const a = [0,1,2,3].map(j => value[j] || '')
    a[i] = d; onChange(a.join(''))
    if (i < 3) refs[i+1].current?.focus()
  }
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '20px 0' }}>
      {[0,1,2,3].map(i => (
        <input key={i} ref={refs[i]} type="tel" inputMode="numeric" maxLength={1}
          value={value[i] || ''} onChange={e => onCh(i, e)} onKeyDown={e => onKD(i, e)}
          style={{ width: 60, height: 68, textAlign: 'center', fontSize: 32, fontWeight: 900, borderRadius: 14,
            border: `2.5px solid ${value[i] ? P : '#cde0d0'}`, background: value[i] ? L : '#f7fbf8',
            outline: 'none', color: P, boxShadow: value[i] ? `0 0 0 4px ${P}18` : 'none', fontFamily: 'monospace' }} />
      ))}
    </div>
  )
}

/* ── Uhr-Picker (Drum) ────────────────────────────────────── */
const IH = 48, VN = 5
function DrumCol({ items, value, onChange }) {
  const ref = useRef(), sY = useRef(0), sI = useRef(0)
  const half = Math.floor(VN / 2)
  const scrollTo = (i, s = true) => ref.current?.scrollTo({ top: i * IH, behavior: s ? 'smooth' : 'instant' })
  useEffect(() => scrollTo(items.indexOf(value), false), []) // eslint-disable-line
  const snap = () => { const i = Math.round(ref.current.scrollTop / IH); scrollTo(i); onChange(items[Math.min(i, items.length - 1)]) }
  const onMD = e => {
    sY.current = e.clientY; sI.current = Math.round(ref.current.scrollTop / IH)
    const mv = e2 => { ref.current.scrollTop = Math.max(0, Math.min((items.length-1)*IH, sI.current*IH + sY.current - e2.clientY)) }
    const up = () => { snap(); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up)
  }
  return (
    <div style={{ position: 'relative', flex: 1, userSelect: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: half*IH, background: 'linear-gradient(to bottom,rgba(255,255,255,.97),transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: half*IH, left: 4, right: 4, height: IH, background: '#f0faf4', borderTop: `2px solid ${P}`, borderBottom: `2px solid ${P}`, zIndex: 1, borderRadius: 8 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: half*IH, background: 'linear-gradient(to top,rgba(255,255,255,.97),transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div ref={ref} onMouseDown={onMD}
        onTouchStart={e => { sY.current = e.touches[0].clientY; sI.current = Math.round(ref.current.scrollTop / IH) }}
        onTouchMove={e => { ref.current.scrollTop = Math.max(0, Math.min((items.length-1)*IH, sI.current*IH + sY.current - e.touches[0].clientY)) }}
        onTouchEnd={snap}
        style={{ height: VN*IH, overflowY: 'scroll', scrollbarWidth: 'none', cursor: 'grab', position: 'relative', zIndex: 3 }}>
        <div style={{ height: half*IH }} />
        {items.map(item => (
          <div key={item} onClick={() => { scrollTo(items.indexOf(item)); onChange(item) }}
            style={{ height: IH, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: item === value ? 28 : 20, fontWeight: item === value ? 800 : 400,
              color: item === value ? P : '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
            {item}
          </div>
        ))}
        <div style={{ height: half*IH }} />
      </div>
    </div>
  )
}

function ClockPicker({ value, onConfirm, onClose }) {
  const [h, setH] = useState(value.split(':')[0])
  const [m, setM] = useState(value.split(':')[1])
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 24px 36px', width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Abfahrtszeit</h3>
          <div style={{ fontSize: 40, fontWeight: 900, color: P, fontVariantNumeric: 'tabular-nums' }}>{h}:{m}</div>
        </div>
        <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 16px' }}>Scrollen oder ziehen</p>
        <div style={{ display: 'flex', alignItems: 'center', background: '#fafafa', borderRadius: 16, padding: '4px 0', marginBottom: 20 }}>
          <DrumCol items={HH} value={h} onChange={setH} />
          <div style={{ fontSize: 36, fontWeight: 900, color: P, padding: '0 6px', flexShrink: 0 }}>:</div>
          <DrumCol items={MM} value={m} onChange={setM} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={sBtn('#f4f7f4', G)} onClick={onClose}>Abbrechen</button>
          <button style={sBtn()} onClick={() => onConfirm(`${h}:${m}`)}>Übernehmen</button>
        </div>
      </div>
    </div>
  )
}

/* ── Login-Bildschirm ─────────────────────────────────────── */
function AuthScreen({ onLogin }) {
  const [step, setStep]   = useState(1)
  const [isNew, setIsNew] = useState(false)
  const [name, setName]   = useState('')
  const [year, setYear]   = useState('')
  const [code, setCode]   = useState('')
  const [pin, setPin]     = useState('')
  const [pin2, setPin2]   = useState('')
  const [errMsg, setErr]  = useState('')
  const [busy, setBusy]   = useState(false)

  const goStep2 = async () => {
    const n = name.trim()
    let y = year.trim()
    if (!n) { setErr('Bitte Name eingeben.'); return }
    if (!/^\d{2}$/.test(y) && !/^\d{4}$/.test(y)) { setErr('Jahrgang eingeben, z.B. 79 oder 1979.'); return }
    if (y.length === 2) y = parseInt(y) > 24 ? '19' + y : '20' + y
    setBusy(true); setErr('')
    const existing = await db.findUser(n, y)
    setIsNew(!existing); setYear(y); setPin(''); setPin2(''); setCode(''); setStep(2); setBusy(false)
  }

  const submit = async () => {
    if (pin.length < 4) { setErr('Bitte 4-stelligen PIN eingeben.'); return }
    setBusy(true); setErr('')
    try {
      if (isNew) {
        if (code.trim().toUpperCase() !== CODE) { setErr('Zugangscode falsch.'); setBusy(false); return }
        if (pin !== pin2) { setErr('PINs stimmen nicht überein.'); setBusy(false); return }
        const u = await db.registerUser(name, year, hash(pin))
        sess.save(u); onLogin(u)
      } else {
        const u = await db.findUser(name, year)
        if (!u || u.pin_hash !== hash(pin)) { setErr('PIN falsch.'); setBusy(false); return }
        sess.save(u); onLogin(u)
      }
    } catch (e) { setErr('Fehler: ' + e.message) }
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7f4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 88, height: 88, borderRadius: 24, background: `linear-gradient(135deg,${P},${A})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 8px 28px ${P}44` }}>
            <Icon n="bench" size={44} color="#fff" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, color: '#1a2e1a' }}>Mitfahrbänkli Alten</h1>
          <p style={{ color: G, margin: '6px 0 0', fontSize: 14 }}>Marthalen · Alten · Andelfingen</p>
        </div>

        {step === 1 ? (
          <div style={sCard}>
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Willkommen!</h2>
            <p style={{ color: G, margin: '0 0 20px', fontSize: 14 }}>Name und Jahrgang eingeben</p>
            <label style={sLbl}>Name</label>
            <input style={{ ...sInp, marginBottom: 14 }} placeholder="z.B. Mathias" value={name} onChange={e => setName(e.target.value)} autoFocus />
            <label style={sLbl}>Jahrgang</label>
            <input style={{ ...sInp, marginBottom: 20 }} placeholder="z.B. 79 oder 1979" value={year} onChange={e => setYear(e.target.value)} inputMode="numeric" onKeyDown={e => e.key === 'Enter' && goStep2()} />
            <ErrBox msg={errMsg} />
            <button style={sBtn()} onClick={goStep2} disabled={busy}>{busy ? '…' : 'Weiter →'}</button>
          </div>
        ) : (
          <div style={sCard}>
            <button onClick={() => { setStep(1); setErr('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: G, fontSize: 14, padding: '0 0 16px', fontFamily: 'inherit' }}>
              <Icon n="back" size={16} color={G} /> Zurück
            </button>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>{isNew ? `Willkommen, ${name.trim()}! 👋` : `Hallo, ${name.trim()}! 👋`}</h2>
            <p style={{ color: G, margin: '0 0 4px', fontSize: 14 }}>{isNew ? 'Neues Konto erstellen' : 'PIN eingeben'}</p>
            {isNew && (
              <div style={{ marginTop: 20 }}>
                <label style={sLbl}>Zugangscode</label>
                <input style={{ ...sInp, letterSpacing: 4, fontSize: 18, fontWeight: 700, textAlign: 'center' }}
                  placeholder="XXXXX" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
                <p style={{ color: G, fontSize: 12, margin: '6px 0 0' }}>Erhältlich bei einem Anwohner</p>
              </div>
            )}
            <div style={{ marginTop: isNew ? 20 : 0 }}>
              <label style={sLbl}>{isNew ? 'PIN wählen (4 Stellen)' : 'PIN'}</label>
              <PinInput value={pin} onChange={setPin} autoFocus />
            </div>
            {isNew && (
              <div>
                <label style={sLbl}>PIN bestätigen</label>
                <PinInput value={pin2} onChange={setPin2} />
              </div>
            )}
            <ErrBox msg={errMsg} />
            <button style={sBtn()} onClick={submit} disabled={busy}>{busy ? '…' : isNew ? 'Konto erstellen' : 'Anmelden'}</button>
          </div>
        )}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 12 }}>🔒 PINs werden verschlüsselt gespeichert</p>
      </div>
    </div>
  )
}

/* ── Fahrtformular (Anbieten + Bearbeiten) ────────────────── */
function RideForm({ user, initial, onSave, onClose }) {
  const nowH = String(new Date().getHours()).padStart(2, '0')
  const nowM = String(new Date().getMinutes()).padStart(2, '0')
  const editing     = !!initial
  const bookedSeats = initial?.bookings?.reduce((s, b) => s + b.seats, 0) || 0

  const [from, setFrom]   = useState(initial?.from_stop || STOPS[0])
  const [to, setTo]       = useState(initial?.to_stop || '')
  const [date, setDate]   = useState(initial?.date || tday())
  const [time, setTime]   = useState(initial?.time || `${nowH}:${nowM}`)
  const [seats, setSeats] = useState(String(initial?.seats || 3))
  const [note, setNote]   = useState(initial?.note || '')
  const [clock, setClock] = useState(false)
  const [errMsg, setErr]  = useState('')
  const [busy, setBusy]   = useState(false)

  const submit = async () => {
    if (!to || from === to) { setErr('Bitte gültige Route wählen.'); return }
    if (editing && +seats < bookedSeats) { setErr(`Mindestens ${bookedSeats} Plätze nötig (bereits gebucht).`); return }
    setBusy(true); setErr('')
    try {
      if (editing) {
        await db.updateRide(initial.id, { from_stop: from, to_stop: to, date, time, seats: +seats, seats_left: +seats - bookedSeats, note: note.trim() })
      } else {
        await db.addRide({ driver_id: user.id, driver_name: user.display_name, from_stop: from, to_stop: to, date, time, seats: +seats, seats_left: +seats, note: note.trim() })
      }
      onSave({ from, to, date, time, seats })
    } catch (e) { setErr('Fehler: ' + e.message) }
    setBusy(false)
  }

  const inner = (
    <>
      {editing && bookedSeats > 0 && <div style={{ background: '#fffbeb', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e', borderLeft: '3px solid #f59e0b' }}>⚠️ {bookedSeats} Platz{bookedSeats > 1 ? 'e' : ''} bereits gebucht – Mitfahrende informieren!</div>}
      <div style={{ marginBottom: 16 }}><StopSelector from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} /></div>
      <div style={{ marginBottom: 16 }}>
        <label style={sLbl}>Datum</label>
        <input style={sInp} type="date" value={date} min={tday()} onChange={e => setDate(e.target.value)} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={sLbl}>Abfahrtszeit</label>
        <button onClick={() => setClock(true)} style={{ ...sBtn('#f0faf4', '#1a2e1a'), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1.5px solid #cde0d0' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon n="clock" size={18} color={P} /><span style={{ fontSize: 22, fontWeight: 900, color: P, fontVariantNumeric: 'tabular-nums' }}>{time} Uhr</span></span>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>ändern</span>
        </button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={sLbl}>Freie Plätze</label>
        <select style={sInp} value={seats} onChange={e => setSeats(e.target.value)}>
          {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} Platz{n > 1 ? 'e' : ''}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={sLbl}>Hinweis (optional)</label>
        <input style={sInp} placeholder="z.B. Hund dabei, pünktlich starten…" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      <ErrBox msg={errMsg} />
      <div style={{ display: 'flex', gap: 10 }}>
        {editing && <button style={sBtn('#f4f7f4', G)} onClick={onClose}>Abbrechen</button>}
        <button style={sBtn()} onClick={submit} disabled={busy}>{busy ? '…' : editing ? 'Speichern' : 'Fahrt veröffentlichen'}</button>
      </div>
      {clock && <ClockPicker value={time} onConfirm={t => { setTime(t); setClock(false) }} onClose={() => setClock(false)} />}
    </>
  )

  if (!editing) return <div style={sCard}>{inner}</div>
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', zIndex: 150 }}>
      <div style={{ background: '#fff', borderRadius: '22px 22px 0 0', padding: '24px 24px 36px', width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box', maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 800 }}>Fahrt bearbeiten</h3>
        {inner}
      </div>
    </div>
  )
}

/* ── Fahrt-Karte ──────────────────────────────────────────── */
function RideCard({ ride, user, onBook, onEdit, onCancelRide, onCancelBooking }) {
  const isOwn   = ride.driver_id === user.id
  const booking = ride.bookings?.find(b => b.user_id === user.id)
  const past    = isPast(ride.date, ride.time)

  return (
    <div style={{ ...sCard, borderLeft: `4px solid ${isOwn ? P : booking ? A : '#d8f3dc'}`, opacity: past ? 0.5 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{SH[ride.from_stop]} → {SH[ride.to_stop]}</div>
          <div style={{ color: G, fontSize: 13, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon n="clock" size={12} color="#9ca3af" /> {dlbl(ride.date, ride.time)}, {ride.time} Uhr
          </div>
        </div>
        {isOwn && !past && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onEdit(ride)} style={{ background: '#f0faf4', border: 'none', borderRadius: 9, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="edit" size={16} color={P} /></button>
            <button onClick={() => onCancelRide(ride)} style={{ background: '#fef2f2', border: 'none', borderRadius: 9, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="trash" size={16} color={R} /></button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: ride.note ? 10 : 12 }}>
        <span style={sTag(P)}>👤 {ride.driver_name}</span>
        <span style={sTag(ride.seats_left > 0 ? A : R)}>{ride.seats_left} Platz{ride.seats_left !== 1 ? 'e' : ''} frei</span>
        {isOwn && <span style={sTag('#7c3aed')}>Meine Fahrt</span>}
        {booking && !isOwn && <span style={sTag(A)}>✓ Gebucht · {booking.seats} Platz{booking.seats !== 1 ? 'e' : ''}</span>}
      </div>

      {ride.note && <div style={{ background: '#f0faf4', borderRadius: 9, padding: '9px 12px', marginBottom: 12, fontSize: 13, color: '#1b4332', borderLeft: `3px solid ${A}`, display: 'flex', gap: 8 }}><span>💬</span><span>{ride.note}</span></div>}

      {isOwn && ride.bookings?.length > 0 && (
        <div style={{ background: '#e8f5e9', borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 5, letterSpacing: 0.5 }}>MITFAHRENDE</div>
          {ride.bookings.map(b => <div key={b.id} style={{ fontSize: 13, color: '#1b4332', marginBottom: 2 }}>👤 {b.user_name} · {b.seats} Platz{b.seats !== 1 ? 'e' : ''}</div>)}
        </div>
      )}

      {!isOwn && !booking && ride.seats_left > 0 && !past && <button style={sBtn()} onClick={() => onBook(ride)}>Mitfahren</button>}
      {!isOwn && booking && !past && <button style={sBtn('#fef2f2', R)} onClick={() => onCancelBooking(ride, booking)}>Buchung stornieren</button>}
    </div>
  )
}

/* ── Anfrage-Karte ────────────────────────────────────────── */
function ReqCard({ req, user, onAccept, onCancel }) {
  const isOwn    = req.requester_id === user.id
  const accepted = req.status === 'accepted'
  const past     = isPast(req.date, req.time)

  return (
    <div style={{ ...sCard, borderLeft: `4px solid ${isOwn ? '#f59e0b' : '#93c5fd'}`, opacity: past ? 0.5 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{SH[req.from_stop]} → {SH[req.to_stop]}</div>
          <div style={{ color: G, fontSize: 13, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon n="clock" size={12} color="#9ca3af" /> {dlbl(req.date, req.time)}, {req.time} Uhr
          </div>
        </div>
        {isOwn && !accepted && !past && (
          <button onClick={() => onCancel(req)} style={{ background: '#fef2f2', border: 'none', borderRadius: 9, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="trash" size={16} color={R} /></button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: req.note ? 10 : 12 }}>
        <span style={sTag('#f59e0b')}>🙋 {req.requester_name}</span>
        {accepted ? <span style={sTag(A)}>✓ Fahrer: {req.driver_name}</span> : <span style={sTag('#3b82f6')}>Sucht Mitfahrgelegenheit</span>}
        {isOwn && <span style={sTag('#7c3aed')}>Meine Anfrage</span>}
      </div>
      {req.note && <div style={{ background: '#fffbeb', borderRadius: 9, padding: '9px 12px', marginBottom: 12, fontSize: 13, color: '#92400e', borderLeft: '3px solid #f59e0b', display: 'flex', gap: 8 }}><span>💬</span><span>{req.note}</span></div>}
      {!isOwn && !accepted && !past && <button style={sBtn('#3b82f6')} onClick={() => onAccept(req)}>🚗 Ich fahre!</button>}
    </div>
  )
}

/* ── Buchungsmodal ────────────────────────────────────────── */
function BookModal({ ride, user, onConfirm, onClose }) {
  const [seats, setSeats] = useState(1)
  const [busy, setBusy]   = useState(false)
  const confirm = async () => {
    setBusy(true)
    await db.bookRide(ride.id, user.id, user.display_name, seats)
    onConfirm(); setBusy(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: '22px 22px 0 0', padding: '24px 24px 36px', width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Platz reservieren</h3>
        <p style={{ color: G, margin: '0 0 20px', fontSize: 14, lineHeight: 1.6 }}>
          <b>{ride.from_stop}</b> → <b>{ride.to_stop}</b><br />{ride.date} · {ride.time} Uhr · Fahrer: <b>{ride.driver_name}</b>
        </p>
        <label style={sLbl}>Anzahl Plätze</label>
        <select style={{ ...sInp, marginBottom: 20 }} value={seats} onChange={e => setSeats(+e.target.value)}>
          {Array.from({ length: ride.seats_left }, (_, i) => i+1).map(n => <option key={n} value={n}>{n} Platz{n > 1 ? 'e' : ''}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={sBtn('#f4f7f4', G)} onClick={onClose}>Abbrechen</button>
          <button style={sBtn()} onClick={confirm} disabled={busy}>{busy ? '…' : 'Jetzt buchen'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Tab: Buchen ──────────────────────────────────────────── */
function BuchenTab({ user }) {
  const [rides, setRides]     = useState([])
  const [fDate, setFD]        = useState('')
  const [fFrom, setFF]        = useState('')
  const [booking, setBooking] = useState(null)
  const [ok, setOk]           = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => { setLoading(true); setRides(await db.getRides()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  const list = rides.filter(r => r.driver_id !== user.id && (!fDate || r.date === fDate) && (!fFrom || r.from_stop === fFrom))

  return (
    <div style={{ padding: 16 }}>
      <div style={{ ...sCard, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={sLbl}>Von</label>
            <select style={sInp} value={fFrom} onChange={e => setFF(e.target.value)}>
              <option value="">Alle</option>{STOPS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={sLbl}>Datum</label>
            <input style={sInp} type="date" value={fDate} min={tday()} onChange={e => setFD(e.target.value)} />
          </div>
        </div>
        {(fFrom || fDate) && <button style={{ ...sBtn('#f4f7f4', G), marginTop: 10, padding: '9px 14px', fontSize: 14 }} onClick={() => { setFF(''); setFD('') }}>× Zurücksetzen</button>}
      </div>
      <OkBox msg={ok} />
      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Laden…</div>
        : list.length === 0
          ? <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}><Icon n="car" size={44} color="#d1d5db" /><p style={{ marginTop: 12 }}>Keine Fahrten verfügbar</p></div>
          : list.map(r => <RideCard key={r.id} ride={r} user={user} onBook={r => { setOk(''); setBooking(r) }} onEdit={() => {}} onCancelRide={() => {}} onCancelBooking={() => {}} />)
      }
      {booking && <BookModal ride={booking} user={user} onConfirm={() => { setBooking(null); setOk('Fahrt gebucht! 🎉'); load() }} onClose={() => setBooking(null)} />}
    </div>
  )
}

/* ── Tab: Anfrage ─────────────────────────────────────────── */
function AnfrageTab({ user }) {
  const nowH = String(new Date().getHours()).padStart(2, '0')
  const nowM = String(new Date().getMinutes()).padStart(2, '0')
  const [reqs, setReqs]       = useState([])
  const [show, setShow]       = useState(false)
  const [from, setFrom]       = useState(STOPS[0])
  const [to, setTo]           = useState('')
  const [date, setDate]       = useState(tday())
  const [time, setTime]       = useState(`${nowH}:${nowM}`)
  const [note, setNote]       = useState('')
  const [clock, setClock]     = useState(false)
  const [errMsg, setErr]      = useState('')
  const [ok, setOk]           = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy]       = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => { setLoading(true); setReqs(await db.getRequests()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!to || from === to) { setErr('Bitte gültige Route wählen.'); return }
    setBusy(true); setErr('')
    await db.addRequest({ requester_id: user.id, requester_name: user.display_name, from_stop: from, to_stop: to, date, time, note: note.trim(), status: 'open' })
    setShow(false); setOk('Anfrage gesendet! 🙋'); setNote(''); setTo(''); load(); setBusy(false)
  }

  const doAccept = async () => {
    setBusy(true)
    await db.acceptRequest(confirm, user)
    setConfirm(null); setOk('Du fährst! Fahrt wurde erstellt. 🚗'); load(); setBusy(false)
  }

  const mine = reqs.filter(r => r.requester_id === user.id)
  const open = reqs.filter(r => r.status === 'open' && r.requester_id !== user.id)

  return (
    <div style={{ padding: 16 }}>
      <OkBox msg={ok} />
      <button style={{ ...sBtn(), marginBottom: 16 }} onClick={() => { setShow(!show); setErr('') }}>
        {show ? '× Formular schliessen' : '+ Mitfahrt anfragen'}
      </button>

      {show && (
        <div style={sCard}>
          <h3 style={{ margin: '0 0 16px', fontWeight: 800 }}>Neue Anfrage</h3>
          <div style={{ marginBottom: 16 }}><StopSelector from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} /></div>
          <div style={{ marginBottom: 16 }}>
            <label style={sLbl}>Datum</label>
            <input style={sInp} type="date" value={date} min={tday()} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={sLbl}>Gewünschte Zeit</label>
            <button onClick={() => setClock(true)} style={{ ...sBtn('#f0faf4', '#1a2e1a'), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1.5px solid #cde0d0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon n="clock" size={18} color={P} /><span style={{ fontSize: 22, fontWeight: 900, color: P, fontVariantNumeric: 'tabular-nums' }}>{time} Uhr</span></span>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>ändern</span>
            </button>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={sLbl}>Hinweis (optional)</label>
            <input style={sInp} placeholder="z.B. mit Einkauf, Rückfahrt…" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <ErrBox msg={errMsg} />
          <button style={sBtn()} onClick={submit} disabled={busy}>{busy ? '…' : 'Anfrage senden'}</button>
          {clock && <ClockPicker value={time} onConfirm={t => { setTime(t); setClock(false) }} onClose={() => setClock(false)} />}
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Laden…</div>
        : <>
            {mine.length > 0 && <>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Meine Anfragen</div>
              {mine.map(r => <ReqCard key={r.id} req={r} user={user} onAccept={() => {}} onCancel={async r => { await db.deleteRequest(r.id); setOk('Anfrage storniert.'); load() }} />)}
            </>}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: mine.length > 0 ? 8 : 0 }}>Offene Anfragen</div>
            {open.length === 0
              ? <div style={{ ...sCard, textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 14 }}>Keine offenen Anfragen</div>
              : open.map(r => <ReqCard key={r.id} req={r} user={user} onAccept={r => setConfirm(r)} onCancel={() => {}} />)
            }
          </>
      }

      {confirm && (
        <ConfirmModal title="Mitfahrt bestätigen?" confirmLabel="Ja, ich fahre! 🚗" confirmColor={P}
          msg={`${confirm.requester_name} möchte von ${SH[confirm.from_stop]} nach ${SH[confirm.to_stop]} am ${confirm.date} um ${confirm.time} Uhr. Eine Fahrt wird automatisch erstellt.`}
          onYes={doAccept} onNo={() => setConfirm(null)} />
      )}
    </div>
  )
}

/* ── Tab: Anbieten ────────────────────────────────────────── */
function AngebotenTab({ user }) {
  const [saved, setSaved] = useState(null)
  if (saved) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: L, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Icon n="check" size={36} color={P} /></div>
        <h2 style={{ margin: '0 0 8px' }}>Fahrt eingetragen!</h2>
        <p style={{ color: G, marginBottom: 24, lineHeight: 1.6 }}>
          <b>{SH[saved.from]}</b> → <b>{SH[saved.to]}</b><br />
          {new Date(saved.date + 'T' + saved.time).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })} · {saved.time} Uhr
        </p>
        <button style={sBtn()} onClick={() => setSaved(null)}>Weitere Fahrt anbieten</button>
      </div>
    </div>
  )
  return <div style={{ padding: 16 }}><RideForm user={user} onSave={setSaved} /></div>
}

/* ── Tab: Meine ───────────────────────────────────────────── */
function MeineTab({ user }) {
  const [rides, setRides]     = useState([])
  const [reqs, setReqs]       = useState([])
  const [editing, setEditing] = useState(null)
  const [confirm, setConf]    = useState(null)
  const [ok, setOk]           = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, q] = await Promise.all([db.getRides(), db.getRequests()])
    setRides(r); setReqs(q); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const offered = rides.filter(r => r.driver_id === user.id)
  const booked  = rides.filter(r => r.bookings?.some(b => b.user_id === user.id))
  const myReqs  = reqs.filter(r => r.requester_id === user.id)

  const doAction = async () => {
    if (confirm.type === 'ride') { await db.deleteRide(confirm.data.id); setOk('Fahrt storniert.') }
    if (confirm.type === 'booking') { await db.cancelBooking(confirm.data.b.id, confirm.data.r.id, confirm.data.b.seats); setOk('Buchung storniert.') }
    if (confirm.type === 'req') { await db.deleteRequest(confirm.data.id); setOk('Anfrage storniert.') }
    setConf(null); load()
  }

  const Sec = ({ title, items, empty, render }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      {loading
        ? <div style={{ ...sCard, color: '#9ca3af', textAlign: 'center', padding: 16 }}>Laden…</div>
        : items.length === 0
          ? <div style={{ ...sCard, color: '#9ca3af', textAlign: 'center', padding: 20, fontSize: 14 }}>{empty}</div>
          : items.map(render)
      }
    </div>
  )

  return (
    <div style={{ padding: 16 }}>
      <OkBox msg={ok} />
      <Sec title="Meine Fahrten (Fahrer)" items={offered} empty="Noch keine Fahrten angeboten"
        render={r => <RideCard key={r.id} ride={r} user={user} onBook={() => {}}
          onEdit={() => setEditing(r)}
          onCancelRide={r => setConf({ type: 'ride', data: r, msg: r.bookings?.length > 0 ? `${r.bookings.length} Person(en) haben gebucht. Trotzdem stornieren?` : 'Fahrt wirklich stornieren?' })}
          onCancelBooking={() => {}} />} />

      <Sec title="Meine Buchungen (Mitfahrer)" items={booked} empty="Noch keine Fahrten gebucht"
        render={r => <RideCard key={r.id} ride={r} user={user} onBook={() => {}} onEdit={() => {}} onCancelRide={() => {}}
          onCancelBooking={(r, b) => setConf({ type: 'booking', data: { r, b }, msg: `Buchung ${SH[r.from_stop]} → ${SH[r.to_stop]} am ${r.date} stornieren?` })} />} />

      <Sec title="Meine Anfragen" items={myReqs} empty="Keine Anfragen"
        render={r => <ReqCard key={r.id} req={r} user={user} onAccept={() => {}}
          onCancel={r => setConf({ type: 'req', data: r, msg: `Anfrage ${SH[r.from_stop]} → ${SH[r.to_stop]} stornieren?` })} />} />

      {editing && <RideForm user={user} initial={editing} onSave={() => { setEditing(null); setOk('Fahrt aktualisiert.'); load() }} onClose={() => setEditing(null)} />}
      {confirm && <ConfirmModal title="Stornieren?" msg={confirm.msg} onYes={doAction} onNo={() => setConf(null)} />}
    </div>
  )
}

/* ── App Root ─────────────────────────────────────────────── */
export default function App() {
  const [user, setUser]       = useState(null)
  const [tab, setTab]         = useState('buchen')
  const [loading, setLoading] = useState(true)

  useEffect(() => { const u = sess.get(); if (u) setUser(u); setLoading(false) }, [])
  const logout = () => { sess.clear(); setUser(null) }

  if (loading) return <div style={{ minHeight: '100vh', background: '#f4f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: '#9ca3af' }}>Laden…</div>
  if (!user)   return <AuthScreen onLogin={setUser} />

  const TABS = [
    { id: 'buchen',   label: 'Buchen',   icon: 'ticket' },
    { id: 'anfrage',  label: 'Anfrage',  icon: 'hand' },
    { id: 'anbieten', label: 'Anbieten', icon: 'car' },
    { id: 'meine',    label: 'Meine',    icon: 'user' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f7f4', fontFamily: "'Segoe UI',system-ui,sans-serif", color: '#1a2e1a' }}>
      <div style={{ background: `linear-gradient(135deg,${P},${A})`, color: '#fff', padding: '14px 20px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>🪑 Mitfahrbänkli Alten</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 1 }}>Hoi, {user.display_name}!</div>
          </div>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontFamily: 'inherit' }}>
            <Icon n="out" size={14} color="#fff" /> Abmelden
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', flexShrink: 0 }}>
        {TABS.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, padding: '10px 4px 8px', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', color: tab === id ? P : G, fontWeight: tab === id ? 700 : 500, fontSize: 11, fontFamily: 'inherit',
              borderBottom: tab === id ? `3px solid ${P}` : '3px solid transparent', transition: 'all .15s' }}>
            <Icon n={icon} size={20} color={tab === id ? P : G} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {tab === 'buchen'   && <BuchenTab    user={user} />}
        {tab === 'anfrage'  && <AnfrageTab   user={user} />}
        {tab === 'anbieten' && <AngebotenTab user={user} />}
        {tab === 'meine'    && <MeineTab     user={user} />}
      </div>
    </div>
  )
}
