import React, { useEffect, useRef, useState } from "react";

export const RISK_COLOR = { LOW: "#2e9e5b", MEDIUM: "#e0a100", HIGH: "#d64545", UNKNOWN: "#9aa3b2" };

export function colorForScore(score) {
  if (score == null) return RISK_COLOR.UNKNOWN;
  if (score >= 70) return RISK_COLOR.LOW;
  if (score >= 30) return RISK_COLOR.MEDIUM;
  return RISK_COLOR.HIGH;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({ value, suffix = "", duration = 700 }) {
  const [shown, setShown] = useState(value == null || prefersReducedMotion() ? value : 0);

  useEffect(() => {
    if (value == null || prefersReducedMotion()) {
      setShown(value);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // requestAnimationFrame is paused in hidden tabs, so always land on the real value.
    const settle = setTimeout(() => setShown(value), duration + 250);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [value, duration]);

  return <>{shown == null ? "N/A" : `${shown}${suffix}`}</>;
}

export function Ring({ value, size = 150, stroke = 14, color, caption }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value ?? "No"} percent`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e3e7ee" strokeWidth={stroke} />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color || colorForScore(value)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ "--c": c }}
        />
      </svg>
      <div className="ring-text">
        <strong><CountUp value={value} suffix={value == null ? "" : "%"} /></strong>
        {caption && <span>{caption}</span>}
      </div>
    </div>
  );
}

export function Donut({ segments, size = 180, stroke = 28, centerLabel, centerValue }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut">
      <div className="donut-chart" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e3e7ee" strokeWidth={stroke} />
          {total > 0 &&
            segments.map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.label}
                  className="donut-seg"
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="ring-text">
          <strong>{centerValue ?? total}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="legend">
        {segments.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
            <b>{s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({ items, max = 100, unit = "" }) {
  return (
    <ul className="hbars">
      {items.map((it, i) => (
        <li key={it.label}>
          <span className="hbars-label">{it.label}</span>
          <span className="hbars-track">
            <span
              className="hbars-fill"
              style={{
                width: `${it.value == null ? 0 : Math.min(100, (it.value / max) * 100)}%`,
                background: it.color || "#4b7bec",
                animationDelay: `${i * 70}ms`,
              }}
            />
          </span>
          <span className="hbars-value">{it.value == null ? "N/A" : `${it.value}${unit}`}</span>
        </li>
      ))}
    </ul>
  );
}

const PALETTE = ["#4b7bec", "#e0a100", "#2e9e5b", "#d64545", "#8854d0"];

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(Math.max(280, Math.floor(el.clientWidth) || 560));
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function LineChart({ series, height = 230, yMax = 100 }) {
  const [boxRef, W] = useWidth();
  const pad = { l: 36, r: 16, t: 14, b: 30 };
  const labels = series[0]?.points.map((p) => p.label) || [];
  const n = labels.length;
  const x = (i) => pad.l + (n <= 1 ? 0 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v) => pad.t + (1 - v / yMax) * (height - pad.t - pad.b);

  return (
    <div ref={boxRef}>
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="linechart" role="img" aria-label="Trend over time">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y((g / 100) * yMax)} y2={y((g / 100) * yMax)} stroke="#e3e7ee" />
            <text x={pad.l - 8} y={y((g / 100) * yMax) + 4} textAnchor="end" className="axis">{Math.round((g / 100) * yMax)}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" className="axis">{l}</text>
        ))}
        {series.map((s, si) => {
          const color = s.color || PALETTE[si % PALETTE.length];
          const pts = s.points.map((p, i) => (p.value == null ? null : [x(i), y(p.value), p]));
          const path = pts.filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength="1" className="line-path" />
              {pts.filter(Boolean).map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#fff" stroke={color} strokeWidth="2">
                  <title>{`${s.name}, ${p[2].label}: ${p[2].value}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <ul className="legend inline">
          {series.map((s, i) => (
            <li key={s.name}><i style={{ background: s.color || PALETTE[i % PALETTE.length] }} />{s.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StackedBars({ data, series, height = 220 }) {
  const [boxRef, W] = useWidth();
  const pad = { l: 34, r: 12, t: 12, b: 28 };
  const totals = data.map((d) => series.reduce((a, s) => a + (d[s.key] || 0), 0));
  const top = Math.max(5, ...totals);
  const niceTop = Math.ceil(top / 5) * 5;
  const slot = (W - pad.l - pad.r) / data.length;
  const bw = Math.min(46, slot * 0.6);
  const y = (v) => pad.t + (1 - v / niceTop) * (height - pad.t - pad.b);

  return (
    <div ref={boxRef}>
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="linechart" role="img" aria-label="Activity per day">
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(niceTop * g)} y2={y(niceTop * g)} stroke="#e3e7ee" />
            <text x={pad.l - 8} y={y(niceTop * g) + 4} textAnchor="end" className="axis">{Math.round(niceTop * g)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          let acc = 0;
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={d.label + i}>
              {series.map((s) => {
                const v = d[s.key] || 0;
                const yTop = y(acc + v);
                const h = y(acc) - yTop;
                acc += v;
                return h > 0 ? (
                  <rect key={s.key} className="bar-rect" x={cx - bw / 2} y={yTop} width={bw} height={h} fill={s.color} rx="2" style={{ animationDelay: `${i * 50}ms` }}>
                    <title>{`${d.label}, ${s.label}: ${v}`}</title>
                  </rect>
                ) : null;
              })}
              <text x={cx} y={height - 8} textAnchor="middle" className="axis">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <ul className="legend inline">
        {series.map((s) => (
          <li key={s.key}><i style={{ background: s.color }} />{s.label}</li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ points, color = "#4b7bec", width = 120, height = 36 }) {
  const vals = points.map((p) => p.value);
  const known = vals.filter((v) => v != null);
  if (known.length < 2) return null;
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  const span = hi - lo || 1;
  const step = width / (vals.length - 1);
  const d = vals
    .map((v, i) => (v == null ? null : `${i * step},${height - 4 - ((v - lo) / span) * (height - 8)}`))
    .filter(Boolean)
    .map((p, i) => `${i ? "L" : "M"}${p}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="line-path" />
    </svg>
  );
}
