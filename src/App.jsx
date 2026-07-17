import { useState, useEffect, useMemo } from "react";

const UMBRAL_SUBSISTENCIA = 325000; // ~5 UTM referencial

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
`;

const CANALES = ["Instagram", "Facebook", "Otro"];
const CATEGORIAS_GASTO = ["Compra de prendas", "Envío", "Lavado/Insumos", "Publicidad", "Otro"];

function fmt(n) {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// --- Tag hole decoration ---
function Hole({ style }) {
  return (
    <div
      style={{
        position: "absolute",
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "#D8C6A1",
        boxShadow: "inset 0 2px 3px rgba(43,38,32,0.35)",
        ...style,
      }}
    />
  );
}

export default function RopaTracker() {
  const [view, setView] = useState("movimientos"); // 'movimientos' | 'fiados'
  const [entries, setEntries] = useState([]);
  const [creditos, setCreditos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("venta"); // 'venta' | 'gasto'
  const [selectedMonth, setSelectedMonth] = useState(monthKey(todayISO()));
  const [error, setError] = useState("");

  // Form state
  const [fecha, setFecha] = useState(todayISO());
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [costo, setCosto] = useState("");
  const [canal, setCanal] = useState(CANALES[0]);
  const [categoria, setCategoria] = useState(CATEGORIAS_GASTO[0]);

  // Fiado form state
  const [nombreFiado, setNombreFiado] = useState("");
  const [descFiado, setDescFiado] = useState("");
  const [montoFiado, setMontoFiado] = useState("");
  const [fechaFiado, setFechaFiado] = useState(todayISO());
  const [errorFiado, setErrorFiado] = useState("");

  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  function loadAll() {
    try {
      const res = localStorage.getItem("ropausada-entries");
      setEntries(res ? JSON.parse(res) : []);
    } catch (e) {
      setEntries([]);
    }
    try {
      const resC = localStorage.getItem("ropausada-creditos");
      setCreditos(resC ? JSON.parse(resC) : []);
    } catch (e) {
      setCreditos([]);
    }
    setLastSync(new Date());
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  useEffect(() => {
    (async () => {
      await loadAll();
      setLoaded(true);
    })();
  }, []);

  function persist(next) {
    setEntries(next);
    try {
      localStorage.setItem("ropausada-entries", JSON.stringify(next));
    } catch (e) {
      setError("No se pudo guardar. Intenta de nuevo.");
    }
  }

  function persistCreditos(next) {
    setCreditos(next);
    try {
      localStorage.setItem("ropausada-creditos", JSON.stringify(next));
    } catch (e) {
      setErrorFiado("No se pudo guardar. Intenta de nuevo.");
    }
  }

  function addCredito(e) {
    e.preventDefault();
    setErrorFiado("");
    const montoNum = parseFloat(montoFiado);
    if (!nombreFiado.trim() || !montoNum || montoNum <= 0) {
      setErrorFiado("Completa el nombre de la persona y un monto válido.");
      return;
    }
    const credito = {
      id: uid(),
      nombre: nombreFiado.trim(),
      descripcion: descFiado.trim(),
      monto: montoNum,
      fecha: fechaFiado,
      abonos: [],
      pagado: false,
    };
    persistCreditos([credito, ...creditos]);
    setNombreFiado("");
    setDescFiado("");
    setMontoFiado("");
    setFechaFiado(todayISO());
  }

  function agregarAbono(id, montoAbono) {
    const next = creditos.map((c) => {
      if (c.id !== id) return c;
      const abonos = [...c.abonos, { monto: montoAbono, fecha: todayISO() }];
      const totalAbonado = abonos.reduce((s, a) => s + a.monto, 0);
      return { ...c, abonos, pagado: totalAbonado >= c.monto };
    });
    persistCreditos(next);
  }

  function marcarPagado(id) {
    const next = creditos.map((c) => (c.id === id ? { ...c, pagado: true } : c));
    persistCreditos(next);
  }

  function eliminarCredito(id) {
    persistCreditos(creditos.filter((c) => c.id !== id));
  }

  function resetForm() {
    setFecha(todayISO());
    setDescripcion("");
    setMonto("");
    setCosto("");
    setCanal(CANALES[0]);
    setCategoria(CATEGORIAS_GASTO[0]);
  }

  function addEntry(e) {
    e.preventDefault();
    setError("");
    const montoNum = parseFloat(monto);
    if (!descripcion.trim() || !montoNum || montoNum <= 0) {
      setError("Completa la descripción y un monto válido.");
      return;
    }
    const base = {
      id: uid(),
      type: tab,
      fecha,
      descripcion: descripcion.trim(),
      monto: montoNum,
    };
    const entry =
      tab === "venta"
        ? { ...base, costo: parseFloat(costo) || 0, canal }
        : { ...base, categoria };
    persist([entry, ...entries]);
    resetForm();
  }

  function removeEntry(id) {
    persist(entries.filter((e) => e.id !== id));
  }

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => monthKey(e.fecha)));
    set.add(monthKey(todayISO()));
    return Array.from(set).sort().reverse();
  }, [entries]);

  const monthEntries = useMemo(
    () => entries.filter((e) => monthKey(e.fecha) === selectedMonth).sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    [entries, selectedMonth]
  );

  const totals = useMemo(() => {
    let ventas = 0,
      gastos = 0,
      costos = 0;
    monthEntries.forEach((e) => {
      if (e.type === "venta") {
        ventas += e.monto;
        costos += e.costo || 0;
      } else {
        gastos += e.monto;
      }
    });
    const ganancia = ventas - costos - gastos;
    return { ventas, gastos, costos, ganancia };
  }, [monthEntries]);

  const pctUmbral = Math.min(100, (totals.ventas / UMBRAL_SUBSISTENCIA) * 100);
  const cercaUmbral = totals.ventas >= UMBRAL_SUBSISTENCIA * 0.8;
  const superaUmbral = totals.ventas >= UMBRAL_SUBSISTENCIA;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#D8C6A1",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(43,38,32,0.06) 1px, transparent 0)",
        backgroundSize: "16px 16px",
        fontFamily: "'Inter', sans-serif",
        color: "#2B2620",
        padding: "20px 14px 60px",
      }}
    >
      <style>{FONT_IMPORT}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div
          style={{
            display: "inline-block",
            transform: "rotate(-1.5deg)",
            border: "2px dashed #2B2620",
            borderRadius: 6,
            padding: "10px 22px",
            background: "#F4ECDA",
            position: "relative",
          }}
        >
          <Hole style={{ top: 6, left: 6 }} />
          <Hole style={{ top: 6, right: 6 }} />
          <div
            style={{
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: 1,
            }}
          >
            RECICLA&nbsp;CAJA
          </div>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7, marginTop: 2 }}>
            CONTROL DE VENTAS · ROPA USADA
          </div>
        </div>
      </div>

      {/* Refresh control */}
      <div style={{ maxWidth: 480, margin: "0 auto 14px", display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "1.5px solid #2B2620",
            background: refreshing ? "#2B2620" : "transparent",
            color: refreshing ? "#F4ECDA" : "#2B2620",
            borderRadius: 999,
            padding: "6px 14px",
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            cursor: refreshing ? "default" : "pointer",
          }}
        >
          <span
            style={{
              display: "inline-block",
              transition: "transform 0.6s",
              transform: refreshing ? "rotate(360deg)" : "rotate(0deg)",
            }}
          >
            ⟳
          </span>
          {refreshing ? "ACTUALIZANDO…" : "ACTUALIZAR DATOS"}
        </button>
        {lastSync && !refreshing && (
          <span style={{ fontSize: 10, opacity: 0.55 }}>
            Últ. {lastSync.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* View switcher */}
      <div style={{ maxWidth: 480, margin: "0 auto 16px", display: "flex", gap: 8, justifyContent: "center" }}>
        <TabButton active={view === "movimientos"} onClick={() => setView("movimientos")} label="Movimientos" color="#2B2620" />
        <TabButton active={view === "fiados"} onClick={() => setView("fiados")} label="Fiados" color="#C98A2C" />
      </div>

      {view === "fiados" ? (
        <FiadosView
          creditos={creditos}
          loaded={loaded}
          nombreFiado={nombreFiado}
          setNombreFiado={setNombreFiado}
          descFiado={descFiado}
          setDescFiado={setDescFiado}
          montoFiado={montoFiado}
          setMontoFiado={setMontoFiado}
          fechaFiado={fechaFiado}
          setFechaFiado={setFechaFiado}
          errorFiado={errorFiado}
          addCredito={addCredito}
          agregarAbono={agregarAbono}
          marcarPagado={marcarPagado}
          eliminarCredito={eliminarCredito}
        />
      ) : (
      <>
      {/* Month selector */}
      <div style={{ maxWidth: 480, margin: "0 auto 14px", display: "flex", justifyContent: "center" }}>
        <select
          value={selectedMonth}
          onChange={(ev) => setSelectedMonth(ev.target.value)}
          style={{
            fontFamily: "'Space Mono', monospace",
            background: "#2B2620",
            color: "#F4ECDA",
            border: "none",
            borderRadius: 999,
            padding: "8px 18px",
            fontSize: 13,
            letterSpacing: 1,
          }}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m).toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Summary stamp card */}
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto 18px",
          background: "#F4ECDA",
          border: "2px solid #2B2620",
          borderRadius: 10,
          padding: 18,
          position: "relative",
          boxShadow: "4px 4px 0 rgba(43,38,32,0.25)",
        }}
      >
        <Hole style={{ top: "50%", left: -7, marginTop: -7 }} />
        <Hole style={{ top: "50%", right: -7, marginTop: -7 }} />

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <SummaryItem label="VENTAS" value={fmt(totals.ventas)} color="#55624A" />
          <SummaryItem label="GASTOS" value={fmt(totals.gastos + totals.costos)} color="#A63A2E" />
        </div>
        <div
          style={{
            borderTop: "1px dashed #2B2620",
            paddingTop: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: 12, letterSpacing: 2, opacity: 0.7 }}>GANANCIA NETA</span>
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
              fontSize: 24,
              color: totals.ganancia >= 0 ? "#55624A" : "#A63A2E",
            }}
          >
            {fmt(totals.ganancia)}
          </span>
        </div>

        {/* Threshold bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, letterSpacing: 1, opacity: 0.7, marginBottom: 4 }}>
            <span>VENTAS DEL MES vs LÍMITE SUBSISTENCIA (5 UTM ref.)</span>
            <span>{fmt(UMBRAL_SUBSISTENCIA)}</span>
          </div>
          <div style={{ height: 10, background: "#D8C6A1", borderRadius: 6, overflow: "hidden", border: "1px solid #2B2620" }}>
            <div
              style={{
                height: "100%",
                width: pctUmbral + "%",
                background: superaUmbral ? "#A63A2E" : cercaUmbral ? "#C98A2C" : "#55624A",
                transition: "width 0.3s",
              }}
            />
          </div>
          {superaUmbral && (
            <div style={{ fontSize: 11, marginTop: 6, color: "#A63A2E", fontWeight: 600 }}>
              Superaste el umbral referencial este mes — revisa si te conviene iniciar actividades en el SII.
            </div>
          )}
          {!superaUmbral && cercaUmbral && (
            <div style={{ fontSize: 11, marginTop: 6, color: "#8A6A1E", fontWeight: 600 }}>
              Te estás acercando al umbral referencial de venta de subsistencia.
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: 480, margin: "0 auto 10px", display: "flex", gap: 8, justifyContent: "center" }}>
        <TabButton active={tab === "venta"} onClick={() => setTab("venta")} label="+ Venta" color="#55624A" />
        <TabButton active={tab === "gasto"} onClick={() => setTab("gasto")} label="+ Gasto" color="#A63A2E" />
      </div>

      {/* Form */}
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto 20px",
          background: "#F4ECDA",
          border: "2px solid #2B2620",
          borderRadius: 10,
          padding: 16,
          boxShadow: "3px 3px 0 rgba(43,38,32,0.2)",
        }}
      >
        <Row>
          <Field label="Fecha" style={{ flex: 1 }}>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={tab === "venta" ? "Canal" : "Categoría"} style={{ flex: 1 }}>
            {tab === "venta" ? (
              <select value={canal} onChange={(e) => setCanal(e.target.value)} style={inputStyle}>
                {CANALES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            ) : (
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle}>
                {CATEGORIAS_GASTO.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
        </Row>

        <Field label={tab === "venta" ? "Producto" : "Descripción"}>
          <input
            type="text"
            placeholder={tab === "venta" ? "Ej: Chaqueta de mezclilla" : "Ej: Bolsas para envío"}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Row>
          <Field label={tab === "venta" ? "Precio de venta" : "Monto"} style={{ flex: 1 }}>
            <input
              type="number"
              placeholder="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              style={inputStyle}
            />
          </Field>
          {tab === "venta" && (
            <Field label="Costo (opcional)" style={{ flex: 1 }}>
              <input
                type="number"
                placeholder="0"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                style={inputStyle}
              />
            </Field>
          )}
        </Row>

        {error && <div style={{ color: "#A63A2E", fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <button
          type="button"
          onClick={addEntry}
          style={{
            width: "100%",
            marginTop: 4,
            padding: "10px 0",
            border: "none",
            borderRadius: 6,
            background: tab === "venta" ? "#55624A" : "#A63A2E",
            color: "#F4ECDA",
            fontFamily: "'Space Mono', monospace",
            fontWeight: 700,
            letterSpacing: 1,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          GUARDAR {tab === "venta" ? "VENTA" : "GASTO"}
        </button>
      </div>

      {/* Entries list */}
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {!loaded && <div style={{ textAlign: "center", opacity: 0.6, fontSize: 13 }}>Cargando…</div>}
        {loaded && monthEntries.length === 0 && (
          <div style={{ textAlign: "center", opacity: 0.6, fontSize: 13, padding: "20px 0" }}>
            Sin movimientos este mes todavía.
          </div>
        )}
        {monthEntries.map((e) => (
          <EntryCard key={e.id} entry={e} onDelete={() => removeEntry(e.id)} />
        ))}
      </div>
      </>
      )}
    </div>
  );
}

function FiadosView({
  creditos,
  loaded,
  nombreFiado,
  setNombreFiado,
  descFiado,
  setDescFiado,
  montoFiado,
  setMontoFiado,
  fechaFiado,
  setFechaFiado,
  errorFiado,
  addCredito,
  agregarAbono,
  marcarPagado,
  eliminarCredito,
}) {
  const pendientes = creditos.filter((c) => !c.pagado);
  const pagados = creditos.filter((c) => c.pagado);
  const totalPendiente = pendientes.reduce((sum, c) => {
    const abonado = c.abonos.reduce((s, a) => s + a.monto, 0);
    return sum + Math.max(0, c.monto - abonado);
  }, 0);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* Total pendiente stamp */}
      <div
        style={{
          background: "#F4ECDA",
          border: "2px solid #2B2620",
          borderRadius: 10,
          padding: 16,
          marginBottom: 18,
          position: "relative",
          boxShadow: "4px 4px 0 rgba(43,38,32,0.25)",
          textAlign: "center",
        }}
      >
        <Hole style={{ top: "50%", left: -7, marginTop: -7 }} />
        <Hole style={{ top: "50%", right: -7, marginTop: -7 }} />
        <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.7 }}>TOTAL POR COBRAR</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 26, color: "#C98A2C" }}>
          {fmt(totalPendiente)}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
          {pendientes.length} {pendientes.length === 1 ? "persona" : "personas"} con saldo pendiente
        </div>
      </div>

      {/* Add credito form */}
      <div
        style={{
          background: "#F4ECDA",
          border: "2px solid #2B2620",
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          boxShadow: "3px 3px 0 rgba(43,38,32,0.2)",
        }}
      >
        <Row>
          <Field label="Nombre de la persona" style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Ej: María Pérez"
              value={nombreFiado}
              onChange={(e) => setNombreFiado(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Fecha" style={{ flex: 1 }}>
            <input type="date" value={fechaFiado} onChange={(e) => setFechaFiado(e.target.value)} style={inputStyle} />
          </Field>
        </Row>
        <Field label="Producto (opcional)">
          <input
            type="text"
            placeholder="Ej: Poleron + jeans"
            value={descFiado}
            onChange={(e) => setDescFiado(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Monto fiado">
          <input
            type="number"
            placeholder="0"
            value={montoFiado}
            onChange={(e) => setMontoFiado(e.target.value)}
            style={inputStyle}
          />
        </Field>
        {errorFiado && <div style={{ color: "#A63A2E", fontSize: 12, marginBottom: 8 }}>{errorFiado}</div>}
        <button
          type="button"
          onClick={addCredito}
          style={{
            width: "100%",
            marginTop: 4,
            padding: "10px 0",
            border: "none",
            borderRadius: 6,
            background: "#C98A2C",
            color: "#F4ECDA",
            fontFamily: "'Space Mono', monospace",
            fontWeight: 700,
            letterSpacing: 1,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          REGISTRAR FIADO
        </button>
      </div>

      {!loaded && <div style={{ textAlign: "center", opacity: 0.6, fontSize: 13 }}>Cargando…</div>}

      {loaded && pendientes.length > 0 && (
        <>
          <SectionLabel text="Pendientes" />
          {pendientes.map((c) => (
            <CreditoCard
              key={c.id}
              credito={c}
              onAbono={(monto) => agregarAbono(c.id, monto)}
              onPagado={() => marcarPagado(c.id)}
              onDelete={() => eliminarCredito(c.id)}
            />
          ))}
        </>
      )}

      {loaded && pagados.length > 0 && (
        <>
          <SectionLabel text="Pagados" />
          {pagados.map((c) => (
            <CreditoCard key={c.id} credito={c} pagadoView onDelete={() => eliminarCredito(c.id)} />
          ))}
        </>
      )}

      {loaded && creditos.length === 0 && (
        <div style={{ textAlign: "center", opacity: 0.6, fontSize: 13, padding: "20px 0" }}>
          Todavía no registras fiados.
        </div>
      )}
    </div>
  );
}

function SectionLabel({ text }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.65, margin: "10px 4px" }}>
      {text.toUpperCase()}
    </div>
  );
}

function CreditoCard({ credito, onAbono, onPagado, onDelete, pagadoView }) {
  const [abonoInput, setAbonoInput] = useState("");
  const abonado = credito.abonos.reduce((s, a) => s + a.monto, 0);
  const saldo = Math.max(0, credito.monto - abonado);

  return (
    <div
      style={{
        position: "relative",
        background: "#F4ECDA",
        border: "1.5px dashed #2B2620",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 8,
        opacity: pagadoView ? 0.65 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{credito.nombre}</div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
            {new Date(credito.fecha + "T00:00:00").toLocaleDateString("es-CL")}
            {credito.descripcion ? ` · ${credito.descripcion}` : ""}
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
            Total {fmt(credito.monto)}
            {abonado > 0 ? ` · abonado ${fmt(abonado)}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
              fontSize: 15,
              color: pagadoView ? "#55624A" : "#C98A2C",
            }}
          >
            {pagadoView ? "PAGADO" : fmt(saldo)}
          </div>
          <button
            onClick={onDelete}
            style={{ border: "none", background: "transparent", color: "#A63A2E", fontSize: 15, cursor: "pointer", marginTop: 4 }}
            aria-label="Eliminar"
          >
            ×
          </button>
        </div>
      </div>

      {!pagadoView && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            type="number"
            placeholder="Abono"
            value={abonoInput}
            onChange={(e) => setAbonoInput(e.target.value)}
            style={{ ...inputStyle, flex: 1, padding: "6px 8px", fontSize: 12 }}
          />
          <button
            onClick={() => {
              const n = parseFloat(abonoInput);
              if (n > 0) {
                onAbono(n);
                setAbonoInput("");
              }
            }}
            style={{
              border: "1px solid #2B2620",
              background: "transparent",
              borderRadius: 6,
              padding: "0 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: "pointer",
            }}
          >
            ABONAR
          </button>
          <button
            onClick={onPagado}
            style={{
              border: "1px solid #55624A",
              background: "#55624A",
              color: "#F4ECDA",
              borderRadius: 6,
              padding: "0 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: "pointer",
            }}
          >
            PAGADO
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.7 }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 17, color }}>{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 18px",
        borderRadius: 999,
        border: `2px solid ${active ? color : "#2B2620"}`,
        background: active ? color : "transparent",
        color: active ? "#F4ECDA" : "#2B2620",
        fontFamily: "'Space Mono', monospace",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 1,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Row({ children }) {
  return <div style={{ display: "flex", gap: 10 }}>{children}</div>;
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 10, ...style }}>
      <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, opacity: 0.65, marginBottom: 3 }}>
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid rgba(43,38,32,0.4)",
  borderRadius: 6,
  background: "#fff",
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  boxSizing: "border-box",
};

function EntryCard({ entry, onDelete }) {
  const isVenta = entry.type === "venta";
  const neto = isVenta ? entry.monto - (entry.costo || 0) : -entry.monto;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#F4ECDA",
        border: "1.5px dashed #2B2620",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 8,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{entry.descripcion}</div>
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
          {new Date(entry.fecha + "T00:00:00").toLocaleDateString("es-CL")} ·{" "}
          {isVenta ? entry.canal : entry.categoria}
          {isVenta && entry.costo ? ` · costo ${fmt(entry.costo)}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontWeight: 700,
            fontSize: 14,
            color: neto >= 0 ? "#55624A" : "#A63A2E",
          }}
        >
          {neto >= 0 ? "+" : ""}
          {fmt(neto)}
        </span>
        <button
          onClick={onDelete}
          aria-label="Eliminar"
          style={{
            border: "none",
            background: "transparent",
            color: "#A63A2E",
            fontSize: 16,
            cursor: "pointer",
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}