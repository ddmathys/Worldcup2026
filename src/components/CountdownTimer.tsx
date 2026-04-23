"use client";

import { useEffect, useState } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export default function CountdownTimer({ target }: { target: Date }) {
  const [time, setTime] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setTime(calcTimeLeft(target));
    const id = setInterval(() => setTime(calcTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const units = [
    { label: "Jours", value: time?.days ?? 0 },
    { label: "Heures", value: time?.hours ?? 0 },
    { label: "Minutes", value: time?.minutes ?? 0 },
    { label: "Secondes", value: time?.seconds ?? 0 },
  ];

  return (
    <div className="flex items-center gap-3 sm:gap-5">
      {units.map(({ label, value }, i) => (
        <div key={label} className="flex items-center gap-3 sm:gap-5">
          <div className="text-center">
            <div className="w-16 sm:w-20 h-16 sm:h-20 glass flex items-center justify-center rounded-2xl border border-yellow-400/20">
              <span className="text-2xl sm:text-3xl font-black text-gold tabular-nums">
                {time === null ? "–" : String(value).padStart(2, "0")}
              </span>
            </div>
            <span className="text-xs text-white/40 mt-1.5 block font-medium uppercase tracking-wider">
              {label}
            </span>
          </div>
          {i < units.length - 1 && (
            <span className="text-2xl font-black text-yellow-400/40 -mt-6">:</span>
          )}
        </div>
      ))}
    </div>
  );
}
