export default function DashboardSky() {
  return (
    <span className="dash-sky-scene" aria-hidden="true">
      <svg className="dash-day-art" viewBox="0 0 250 72">
        <g className="dash-flower dash-flower-red" transform="translate(42 27)">
          <line x1="0" y1="8" x2="0" y2="38" />
          <ellipse cx="-8" cy="27" rx="9" ry="4" transform="rotate(24 -8 27)" />
          <ellipse cx="8" cy="31" rx="9" ry="4" transform="rotate(-24 8 31)" />
          <circle cx="0" cy="-11" r="7" /><circle cx="10" cy="-4" r="7" />
          <circle cx="6" cy="8" r="7" /><circle cx="-6" cy="8" r="7" />
          <circle cx="-10" cy="-4" r="7" /><circle className="dash-flower-core" r="6" />
        </g>
        <g className="dash-flower dash-flower-yellow" transform="translate(103 31) scale(.82)">
          <line x1="0" y1="8" x2="0" y2="38" />
          <ellipse cx="-8" cy="27" rx="9" ry="4" transform="rotate(24 -8 27)" />
          <ellipse cx="8" cy="31" rx="9" ry="4" transform="rotate(-24 8 31)" />
          <circle cx="0" cy="-11" r="7" /><circle cx="10" cy="-4" r="7" />
          <circle cx="6" cy="8" r="7" /><circle cx="-6" cy="8" r="7" />
          <circle cx="-10" cy="-4" r="7" /><circle className="dash-flower-core" r="6" />
        </g>
        <g className="dash-sun" transform="translate(211 36)">
          <line x1="0" y1="-31" x2="0" y2="-24" />
          <line x1="0" y1="24" x2="0" y2="31" />
          <line x1="-31" y1="0" x2="-24" y2="0" />
          <line x1="24" y1="0" x2="31" y2="0" />
          <line x1="-22" y1="-22" x2="-17" y2="-17" />
          <line x1="17" y1="17" x2="22" y2="22" />
          <line x1="17" y1="-17" x2="22" y2="-22" />
          <line x1="-22" y1="22" x2="-17" y2="17" />
          <circle r="18" />
        </g>
      </svg>
      <span className="dash-night-stars"><i /><i /><i /></span>
      <span className="dash-moon" />
    </span>
  );
}
