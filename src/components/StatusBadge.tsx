import clsx from "clsx";

type Status = "open" | "soon" | "locked" | "live" | "finished";

const config: Record<Status, { label: string; className: string }> = {
  open: { label: "Ouvert", className: "badge-open" },
  soon: { label: "Bientôt verrouillé", className: "badge-soon" },
  locked: { label: "Verrouillé", className: "badge-locked" },
  live: { label: "En cours", className: "badge-live" },
  finished: { label: "Terminé", className: "badge-finished" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { label, className } = config[status];
  return (
    <span className={clsx("inline-flex items-center gap-1", className)}>
      {status === "live" && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      )}
      {label}
    </span>
  );
}
