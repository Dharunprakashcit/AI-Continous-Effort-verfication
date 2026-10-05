import React from "react";

const base = {
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export const IconUser = () => (
  <svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></svg>
);
export const IconPulse = () => (
  <svg {...base}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
);
export const IconTasks = () => (
  <svg {...base}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 12l3 3 5-6" /></svg>
);
export const IconChat = () => (
  <svg {...base}><path d="M4 5h16v11H9l-5 4z" /></svg>
);
export const IconUsers = () => (
  <svg {...base}><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /><path d="M16 5a3.5 3.5 0 010 7M18 14.5c2.5.5 4 2 4 5.5" /></svg>
);
export const IconChart = () => (
  <svg {...base}><path d="M4 20V4M4 20h16" /><rect x="8" y="12" width="3" height="5" /><rect x="13" y="7" width="3" height="10" /></svg>
);
export const IconBell = () => (
  <svg {...base}><path d="M6 17V11a6 6 0 0112 0v6l2 2H4z" /><path d="M10 21a2 2 0 004 0" /></svg>
);
export const IconMenu = () => (
  <svg {...base}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconTarget = () => (
  <svg {...base}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></svg>
);
export const IconTrophy = () => (
  <svg {...base}><path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a3 3 0 003 3M16 6h4v1a3 3 0 01-3 3M12 13v4M8 20h8" /></svg>
);
export const IconBook = () => (
  <svg {...base}><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" /><path d="M5 17a3 3 0 013-3h11" /></svg>
);
export const IconBolt = () => (
  <svg {...base}><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></svg>
);
