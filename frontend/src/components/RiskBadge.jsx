import React from "react";

const COLORS = {
  LOW: "#1a7f37",
  MEDIUM: "#b98900",
  HIGH: "#cf222e",
  UNKNOWN: "#6e7781",
};

export default function RiskBadge({ level }) {
  const color = COLORS[level] || COLORS.UNKNOWN;
  return (
    <span className="badge" style={{ backgroundColor: color }}>
      {level}
    </span>
  );
}
