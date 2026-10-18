// App shell: navigation rail (desktop) or bottom bar (phone), theme switch, and the screens.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Place } from "./data/places";
import { PlanScreen } from "./plan/Plan";
import { SCREENS, type ScreenId } from "./screens";
import { useStore } from "./state/store";
import { Toast } from "./ui/bits";
import { Icon } from "./ui/Icon";

type ThemePref = "system" | "light" | "dark" | "sun";
const NAV: { id: ScreenId; label: string; icon: string; phone?: boolean }[] = [
  { id: "home", label: "Trips", icon: "home", phone: true },
  { id: "plan", label: "Plan", icon: "map", phone: true },
  { id: "today", label: "Today", icon: "sun", phone: true },
  { id: "bookings", label: "Bookings", icon: "ticket", phone: true },
  { id: "tasks", label: "Tasks", icon: "check", phone: true },
  { id: "budget", label: "Budget", icon: "money" },
  { id: "explore", label: "Explore", icon: "compass" },
  { id: "templates", label: "Templates", icon: "layers" },
  { id: "admin", label: "Review", icon: "shield" },
  { id: "settings", label: "Settings", icon: "gear" },
];

function usePhone() {
  const q = "(max-width: 760px)";
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  return m;
}
// Screens that belong to one trip: the phone top bar names the trip, and the screen keeps its own title.
const TRIP_SCREENS = new Set<ScreenId>(["plan", "today", "bookings", "tasks", "budget", "share"]);
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

export default function App() {
  const phone = usePhone();
  const [pref, setPref] = useState<ThemePref>(() => (read("proto.theme") as ThemePref) || "system");
  const [sysDark, setSysDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [screen, setScreen] = useState<ScreenId>(() => (location.hash.slice(1) as ScreenId) in SCREENS || location.hash === "#plan" ? (location.hash.slice(1) as ScreenId) : "plan");
  const [openPlace, setOpenPlace] = useState<Place | undefined>();
  const [more, setMore] = useState(false);
  const { s } = useStore();
  useEffect(() => { const mq = window.matchMedia("(prefers-color-scheme: dark)"); const f = () => setSysDark(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  useEffect(() => {
    const r = document.documentElement;
    if (pref === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", pref);
    write("proto.theme", pref);
  }, [pref]);
  const theme: "light" | "dark" = pref === "dark" || (pref === "system" && sysDark) ? "dark" : "light";
  const go = (id: ScreenId) => { setScreen(id); setMore(false); try { history.replaceState(null, "", `#${id}`); } catch { /* sandboxed */ } };
  const cycle = () => setPref(p => (p === "system" ? (sysDark ? "light" : "dark") : p === "light" ? "dark" : p === "dark" ? "sun" : "system"));

  const Screen = screen === "plan" ? null : SCREENS[screen];
  const body = screen === "plan"
    ? <PlanScreen theme={theme} phone={phone} onOpenPlace={p => { setOpenPlace(p); go("place"); }} onShare={() => go("share")} />
    : Screen ? <Screen phone={phone} theme={theme} go={go} place={openPlace} /> : null;

  return (
    <div className={`app ${phone ? "is-phone" : "is-desk"}`}>
      {!phone && (
        <nav className="rail" aria-label="Main">
          <div className="rail-mark sign" title="Prototype">TP</div>
          {NAV.map(n => (
            <button key={n.id} className={`rail-btn ${screen === n.id ? "on" : ""}`} onClick={() => go(n.id)} aria-current={screen === n.id ? "page" : undefined}>
              <Icon name={n.icon} size={18} /><span>{n.label}</span>
            </button>
          ))}
          <div className="rail-foot">
            <button className="rail-btn" onClick={cycle} aria-label={`Theme: ${pref}`} title={`Theme: ${pref} (click to change)`}>
              <Icon name={theme === "dark" ? "moon" : "sun"} size={18} /><span>{pref === "sun" ? "Sunlight" : pref[0].toUpperCase() + pref.slice(1)}</span>
            </button>
          </div>
        </nav>
      )}
      {phone && (
        <header className="phone-top">
          {TRIP_SCREENS.has(screen) ? <span className="sign">Dolomites</span> : <span className="sign brand-mark" aria-label="Trip planner">TP</span>}
          {TRIP_SCREENS.has(screen) && <span className="num muted small">{s.trip.travellers.length} travellers · 13 nights</span>}
          <button className="btn ghost" onClick={cycle} aria-label={`Theme: ${pref}`}><Icon name={theme === "dark" ? "moon" : "sun"} /></button>
        </header>
      )}
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div key={screen} className={`screen scr-${screen}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .14 }}>{body}</motion.div>
        </AnimatePresence>
      </main>
      {phone && (
        <nav className="bottombar" aria-label="Main">
          {NAV.filter(n => n.phone).map(n => (
            <button key={n.id} className={`bb-btn ${screen === n.id ? "on" : ""}`} onClick={() => go(n.id)}><Icon name={n.icon} size={20} /><span>{n.label}</span></button>
          ))}
          <button className={`bb-btn ${more ? "on" : ""}`} onClick={() => setMore(m => !m)}><Icon name="more" size={20} /><span>More</span></button>
          <AnimatePresence>{more && (
            <motion.div className="more-menu" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              {NAV.filter(n => !n.phone).map(n => <button key={n.id} className="addbox-row" onClick={() => go(n.id)}><Icon name={n.icon} /><span>{n.label}</span></button>)}
              <button className="addbox-row" onClick={() => go("share")}><Icon name="share" /><span>Share</span></button>
              <button className="addbox-row" onClick={() => go("new")}><Icon name="plus" /><span>New trip</span></button>
            </motion.div>
          )}</AnimatePresence>
        </nav>
      )}
      <Toast />
    </div>
  );
}
