"use client";

import { useEffect, useState } from "react";
import { Icon } from "./ui";

/** "jeu. 26 nov. · 10:24" — heure de Floride, en direct */
export default function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="af-header__clock" />;
  const tz = "America/New_York";
  const day = now.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: tz });
  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  return (
    <span className="af-header__clock">
      <Icon name="clock" size={18} />
      {day} · {time}
    </span>
  );
}
