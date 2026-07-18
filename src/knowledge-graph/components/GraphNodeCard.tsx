/**
 * GraphNodeCard — Custom React Flow node renderer.
 *
 * Renders a single KnowledgeNode as a premium dark-glass card
 * with visual encoding for node type, severity, risk score, and hub status.
 */
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { KnowledgeNode } from "../types";
import { NODE_TYPE_CONFIG } from "../types";

const SEVERITY_RING: Record<string, string> = {
  critical: "ring-2 ring-red-500/80 shadow-red-500/30 shadow-lg",
  high:     "ring-1 ring-orange-500/70",
  medium:   "ring-1 ring-yellow-500/50",
  low:      "",
};

export const GraphNodeCard = memo(function GraphNodeCard({ data, selected }: NodeProps) {
  const node = data as unknown as KnowledgeNode;
  const cfg = NODE_TYPE_CONFIG[node.type] ?? NODE_TYPE_CONFIG.topic;

  const isCountry = node.type === "country";
  const isTopic   = node.type === "topic";
  const isHub     = node.isHub;

  const ringClass = node.severity ? (SEVERITY_RING[node.severity] ?? "") : "";

  const baseSize = isCountry ? 64 : isTopic ? 44 : cfg.size;

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center select-none cursor-pointer
        transition-all duration-200
        ${selected ? "scale-110 z-50" : "hover:scale-105"}
      `}
      style={{ width: baseSize, height: baseSize }}
    >
      {/* Handles — invisible but required by React Flow */}
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />

      {/* Hub glow ring */}
      {isHub && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: `radial-gradient(circle, ${cfg.color}30 0%, transparent 70%)`,
            transform: "scale(1.6)",
          }}
        />
      )}

      {/* Main node body */}
      <div
        className={`
          relative flex flex-col items-center justify-center rounded-full
          border transition-all duration-200
          ${ringClass}
          ${selected ? "border-white/60" : "border-white/20 hover:border-white/40"}
        `}
        style={{
          width: baseSize,
          height: baseSize,
          background: isCountry
            ? `radial-gradient(circle at 40% 35%, ${cfg.color}ee, ${cfg.color}88)`
            : isTopic
            ? `rgba(30,30,40,0.85)`
            : `linear-gradient(135deg, ${cfg.color}cc, ${cfg.color}66)`,
          boxShadow: selected
            ? `0 0 20px ${cfg.color}80, 0 0 40px ${cfg.color}40`
            : isHub
            ? `0 0 12px ${cfg.color}60`
            : `0 2px 8px rgba(0,0,0,0.4)`,
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Icon */}
        <span
          className="leading-none text-center"
          style={{ fontSize: isCountry ? 20 : isTopic ? 14 : 16 }}
        >
          {cfg.icon}
        </span>

        {/* Risk badge (country nodes only) */}
        {isCountry && node.riskScore > 0 && (
          <span
            className="absolute -bottom-1 -right-1 text-[8px] font-bold rounded-full px-1 leading-tight"
            style={{
              background: node.riskScore > 70 ? "#ef4444" : node.riskScore > 40 ? "#f97316" : "#22c55e",
              color: "white",
            }}
          >
            {node.riskScore}
          </span>
        )}

        {/* Degree badge (hubs only) */}
        {isHub && !isCountry && (
          <span
            className="absolute -top-1 -right-1 text-[8px] font-bold bg-white/20 rounded-full px-1 leading-tight text-white"
          >
            {node.degree}
          </span>
        )}

        {/* Live indicator */}
        {node.live && (
          <span className="absolute top-0 left-0 w-2 h-2 rounded-full bg-green-400 animate-pulse border border-black/40" />
        )}
      </div>

      {/* Label below node */}
      <div
        className="mt-1 text-center leading-tight pointer-events-none"
        style={{ maxWidth: Math.max(baseSize + 20, 80) }}
      >
        <div
          className="text-[10px] font-semibold text-white/90 truncate"
          style={{ maxWidth: baseSize + 20 }}
        >
          {node.label}
        </div>
        {node.sublabel && !isCountry && (
          <div className="text-[8px] text-white/50 truncate" style={{ maxWidth: baseSize + 20 }}>
            {node.sublabel}
          </div>
        )}
      </div>
    </div>
  );
});
