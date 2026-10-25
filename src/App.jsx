import { useEffect, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'urlop-planer-v1'
const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
const weekdays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1)
  const offset = (firstDay.getDay() + 6) % 7
  const total = new Date(year, month + 1, 0).getDate()
  return [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
}

function App() {
  const [saved] = useState(readSaved)
  const [year, setYear] = useState(saved.year || 2027)
  const [allowance, setAllowance] = useState(saved.allowance ?? 26)
  const [selected, setSelected] = useState(saved.selected || [])
  const [holidays, setHolidays] = useState(saved.holidays || [])
  const [holidayMode, setHolidayMode] = useState(false)
  const [copyStatus, setCopyStatus] = useState('idle')
  const [backupStatus, setBackupStatus] = useState('')
  const importInput = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ year, allowance, selected, holidays }))
  }, [year, allowance, selected, holidays])

  useEffect(() => {
    if (copyStatus === 'idle') return undefined
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 2200)
    return () => window.clearTimeout(timeout)
  }, [copyStatus])

  useEffect(() => {
    if (!backupStatus) return undefined
    const timeout = window.setTimeout(() => setBackupStatus(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [backupStatus])

  const yearKey = String(year)
  const picked = selected.filter((date) => date.startsWith(`${yearKey}-`))
  const markedHolidays = holidays.filter((date) => date.startsWith(`${yearKey}-`))
  const used = picked.filter((date) => {
    const day = new Date(`${date}T12:00:00`).getDay()
    return day !== 0 && day !== 6 && !markedHolidays.includes(date)
  }).length
  const remaining = allowance - used
  const selectedRanges = (() => {
    const dates = [...picked].sort()
    const ranges = []
    for (const date of dates) {
      const previous = ranges[ranges.length - 1]
      const currentDay = new Date(`${date}T12:00:00`)
      const previousDay = previous ? new Date(`${previous.end}T12:00:00`) : null
      if (previousDay && currentDay - previousDay === 86400000) {
        previous.end = date
      } else {
        ranges.push({ start: date, end: date })
      }
    }
    const formatDate = (date) => {
      const [dateYear, month, day] = date.split('-')
      return `${day}.${month}.${dateYear}`
    }
    return ranges.map(({ start, end }) => start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`)
  })()

  function toggleDate(date) {
    const list = holidayMode ? holidays : selected
    const setList = holidayMode ? setHolidays : setSelected
    setList(list.includes(date) ? list.filter((item) => item !== date) : [...list, date])
  }

  function resetPlan() {
    setSelected(selected.filter((date) => !date.startsWith(`${yearKey}-`)))
    setHolidays(holidays.filter((date) => !date.startsWith(`${yearKey}-`)))
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(selectedRanges.join('\n'))
      setCopyStatus('success')
    } catch {
      setCopyStatus('error')
    }
  }

  function exportPlan() {
    const backup = {
      app: 'urlopnik',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { year, allowance, selected, holidays },
    }
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `urlopnik-${year}-backup.json`
    link.click()
    URL.revokeObjectURL(url)
    setBackupStatus('Eksport gotowy — plik JSON został pobrany.')
  }

  async function importPlan(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const backup = JSON.parse(await file.text())
      const data = backup?.data
      const validDate = (date) => {
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
        const parsed = new Date(`${date}T12:00:00`)
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
      }
      if (backup.app !== 'urlopnik' || backup.version !== 1 || !data
        || !Number.isInteger(data.year) || data.year < 1900 || data.year > 2200
        || !Number.isInteger(data.allowance) || data.allowance < 0 || data.allowance > 366
        || !Array.isArray(data.selected) || !data.selected.every(validDate)
        || !Array.isArray(data.holidays) || !data.holidays.every(validDate)) {
        throw new Error('Nieprawidłowy format kopii zapasowej.')
      }
      setYear(data.year)
      setAllowance(data.allowance)
      setSelected([...new Set(data.selected)])
      setHolidays([...new Set(data.holidays)])
      setBackupStatus('Import gotowy — plan został wczytany.')
    } catch {
      setBackupStatus('Nie udało się wczytać pliku. Wybierz kopię JSON z aplikacji Urlopnik.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Urlopnik — strona główna">
          <span className="brand-mark">u.</span><span>urlopnik</span>
        </a>
        <span className="local-note"><span className="save-dot" /> Zapisane na tym urządzeniu</span>
      </header>

      <section className="intro" id="top">
        <div className="eyebrow"><span className="eyebrow-line" /> TWÓJ ROK, TWOJE ZASADY</div>
        <h1>Zaplanuj urlop.<br /><span>Wykorzystaj rok.</span></h1>
        <p className="intro-copy">Zaznacz dni, które chcesz mieć dla siebie. Resztę policzymy za Ciebie.</p>
      </section>

      <section className="planner-controls" aria-label="Ustawienia planu">
        <label className="field">
          <span className="field-label">ROK PLANOWANIA</span>
          <span className="input-wrap"><input type="number" min="1900" max="2200" value={year} onChange={(event) => setYear(Math.min(2200, Math.max(1900, Number(event.target.value) || 1900)))} /><span className="field-suffix">rok</span></span>
        </label>
        <div className="control-divider" />
        <label className="field">
          <span className="field-label">PULA URLOPOWA</span>
          <span className="input-wrap"><input type="number" min="0" max="366" value={allowance} onChange={(event) => setAllowance(Math.min(366, Math.max(0, Number(event.target.value) || 0)))} /><span className="field-suffix">dni</span></span>
        </label>
        <div className="balance" aria-live="polite">
          <span className="balance-label">ZOSTAJE CI</span>
          <strong className={remaining < 0 ? 'over-limit' : ''}>{remaining}</strong><span className="balance-unit">dni</span>
          <div className="balance-track"><span style={{ width: `${allowance ? Math.max(0, Math.min(100, (used / allowance) * 100)) : (used ? 100 : 0)}%` }} /></div>
        </div>
      </section>

      <section className="summary-row" aria-live="polite">
        <div><span className="summary-number">{picked.length}</span><span className="summary-text">zaznaczonych dni</span></div>
        <span className="summary-separator" />
        <div><span className="summary-number">{used}</span><span className="summary-text">dni z puli</span></div>
        <div className="summary-actions">
          <button className={`mode-button ${holidayMode ? 'active' : ''}`} onClick={() => setHolidayMode(!holidayMode)} type="button" aria-pressed={holidayMode}>
            <span className="mode-icon">{holidayMode ? '✓' : '✳'}</span>{holidayMode ? 'Tryb świąt włączony' : 'Oznacz święta'}
          </button>
          <button className="reset-button" type="button" onClick={resetPlan}>Wyczyść rok</button>
          <span className="action-divider" />
          <button className="backup-button" type="button" onClick={exportPlan}>Eksport</button>
          <button className="backup-button" type="button" onClick={() => importInput.current?.click()}>Import</button>
          <input ref={importInput} className="file-input" type="file" accept=".json,application/json" onChange={importPlan} aria-label="Wybierz kopię zapasową JSON do importu" />
        </div>
      </section>
      <p className={`backup-status ${backupStatus.includes('Nie udało') ? 'error' : ''}`} aria-live="polite">{backupStatus}</p>

      <div className="calendar-grid">
        {monthNames.map((month, index) => {
          const days = getMonthDays(year, index)
          return <section className="month-card" key={`${year}-${month}`}>
            <header className="month-heading"><h2>{month}</h2><span>{String(index + 1).padStart(2, '0')}</span></header>
            <div className="weekday-grid">{weekdays.map((day, dayIndex) => <span key={day} className={dayIndex === 5 ? 'saturday-label' : dayIndex === 6 ? 'sunday-label' : ''}>{day}</span>)}</div>
            <div className="days-grid">
              {days.map((day, slot) => {
                if (!day) return <span key={`empty-${slot}`} className="day-empty" />
                const date = `${yearKey}-${String(index + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dow = (new Date(year, index, day).getDay() + 6) % 7
                const isHoliday = holidays.includes(date)
                const isSelected = selected.includes(date)
                const classes = ['day-button', dow === 5 && 'saturday', dow === 6 && 'sunday', isHoliday && 'holiday', isSelected && !holidayMode && 'selected', isSelected && holidayMode && 'selected-muted'].filter(Boolean).join(' ')
                return <button key={date} type="button" className={classes} aria-label={`${day} ${month} ${year}${isHoliday ? ', święto' : ''}${isSelected ? ', zaznaczony urlop' : ''}`} aria-pressed={holidayMode ? isHoliday : isSelected} onClick={() => toggleDate(date)}>{day}{isHoliday && <i className="holiday-dot" />}</button>
              })}
            </div>
          </section>
        })}
      </div>

      <footer className="legend">
        <span><i className="legend-swatch selected-swatch" /> Wybrany urlop</span>
        <span><i className="legend-swatch holiday-swatch" /> Święto</span>
        <span><i className="legend-swatch saturday-swatch" /> Sobota</span>
        <span><i className="legend-swatch sunday-swatch" /> Niedziela</span>
        <p>Wskazówka: kliknij dzień, aby dodać go do urlopu. Święta zaznaczysz przełącznikiem u góry.</p>
      </footer>
      <section className="copy-section" aria-label="Lista zaznaczonych dni wolnych">
        <div className="copy-heading">
          <div><span className="field-label">TWÓJ PLAN</span><h2>Lista dni wolnych</h2></div>
          <button className={`copy-button ${copyStatus}`} type="button" onClick={copyList} disabled={selectedRanges.length === 0}>
            {copyStatus === 'success' ? 'Skopiowano!' : copyStatus === 'error' ? 'Nie udało się' : 'Kopiuj listę'} <span aria-hidden="true">{copyStatus === 'success' ? '✓' : copyStatus === 'error' ? '!' : '↗'}</span>
          </button>
        </div>
        <textarea readOnly value={selectedRanges.join('\n')} placeholder="Zaznacz dni w kalendarzu, a lista pojawi się tutaj…" aria-label="Lista zaznaczonych dni, gotowa do skopiowania" rows={Math.max(3, Math.min(8, selectedRanges.length || 3))} />
        <span className="copy-feedback" aria-live="polite">{copyStatus === 'success' ? 'Lista dni wolnych została skopiowana do schowka.' : copyStatus === 'error' ? 'Nie udało się skopiować listy. Zaznacz i skopiuj tekst z pola powyżej.' : ''}</span>
        <p className="copy-hint">Daty w formacie DD.MM.RRRR · sąsiadujące dni zapisane jako przedział</p>
      </section>
      <div className="bottom-note">DOBRY PLAN ZACZYNA SIĘ OD DNIA DLA SIEBIE <span>✳</span></div>
    </main>
  )
}

export default App
