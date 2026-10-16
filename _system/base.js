/* base.js — shared behaviour for every trip plan.
   No dependencies, no build. Everything degrades gracefully if an element is absent,
   so a page that has no checklist or no plan toggle simply skips that block.

   Configuration comes from markup already on the page:
     <meta name="trip-date" content="YYYY-MM-DD">   drives the countdown
   The #countdown element must contain NO sibling text - this script writes the whole
   phrase ("33 days to go" / "Tomorrow" / "Today"). Markup like
   `<strong id="countdown"></strong> days to departure` double-prints and, because the
   hero is bottom-aligned, the wider chip shifts every following pixel on the page.
     <body data-slug="niagara-day-aug-2026">        namespaces localStorage keys
   That keeps this file identical across trips. */
(function () {
  "use strict";

  var slug = (document.body && document.body.dataset && document.body.dataset.slug) ||
             location.pathname.replace(/\//g, "") || "trip";

  var legacyPrefix = (document.body && document.body.dataset && document.body.dataset.ckLegacy) || "";

  /* ---- countdown ------------------------------------------------------------------
     Two conventions in this repo, both supported:
       #countdown  — this script writes the WHOLE phrase; must have no sibling text
       #cd         — number + unit only; the markup supplies "until departure" alongside
     Ticks every minute like the original per-page scripts did.                        */
  (function () {
    var full = document.getElementById("countdown");
    var num = document.getElementById("cd");
    if (!full && !num) return;
    var meta = document.querySelector('meta[name="trip-date"]');
    if (!meta) return;
    var parts = meta.content.split("-");
    if (parts.length !== 3) return;
    var trip = new Date(+parts[0], +parts[1] - 1, +parts[2]);

    function tick() {
      var now = new Date();
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var days = Math.round((trip - today) / 864e5);
      if (full) {
        full.textContent =
          days > 1 ? days + " days to go" :
          days === 1 ? "Tomorrow" :
          days === 0 ? "Today" :
          days > -7 ? "Trip week" : "Trip complete";
      }
      if (num) {
        num.textContent = days > 1 ? days.toLocaleString() + " days"
                        : days === 1 ? "1 day" : days === 0 ? "today" : "—";
      }
    }
    tick();
    setInterval(tick, 60000);
  })();

  /* ---- checklist persistence -------------------------------------------------------
     Supports #checklist input[data-k] and the older [data-ck] convention. For [data-ck]
     the previous per-page key is read as a fallback so ticks already made by the user
     survive the migration.                                                             */
  (function () {
    function bind(box, id) {
      var key = slug + ":" + id;
      var legacy = legacyPrefix ? legacyPrefix + id : null;
      try {
        var v = localStorage.getItem(key);
        if (v === null && legacy) v = localStorage.getItem(legacy);
        if (v === "1") {
          box.checked = true;
          if (box.parentElement) box.parentElement.classList.add("done");
        }
      } catch (e) { /* private mode */ }
      box.addEventListener("change", function () {
        if (box.parentElement) box.parentElement.classList.toggle("done", box.checked);
        try { localStorage.setItem(key, box.checked ? "1" : "0"); } catch (e) {}
      });
    }
    document.querySelectorAll("#checklist input[type=checkbox]").forEach(function (b) {
      bind(b, b.dataset.k || b.id || "");
    });
    document.querySelectorAll("[data-ck]").forEach(function (b) {
      bind(b, b.dataset.ck);
    });
  })();

  /* ---- scrollspy -------------------------------------------------------------------
     Marks both `active` and `on` — the two families used different class names — and
     scrolls the active item into view in the horizontally-scrolling nav, which the older
     pages did and the newer ones did not. Worth having everywhere.                      */
  (function () {
    if (!("IntersectionObserver" in window)) return;
    var links = [].slice.call(document.querySelectorAll("nav a[href^='#']"));
    if (!links.length) return;
    var sections = links
      .map(function (a) { return document.querySelector(a.getAttribute("href")); })
      .filter(Boolean);
    if (!sections.length) return;

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          var hit = a.getAttribute("href") === "#" + e.target.id;
          a.classList.toggle("active", hit);
          a.classList.toggle("on", hit);
          if (hit && a.scrollIntoView) {
            a.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
          }
        });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });

    sections.forEach(function (s) { obs.observe(s); });
  })();

  /* ---- A/B plan toggle -------------------------------------------------------------- */
  (function () {
    var buttons = document.querySelectorAll("[data-plan-btn]");
    if (!buttons.length) return;
    var key = slug + ":plan";

    function setPlan(which) {
      document.querySelectorAll("[data-plan]").forEach(function (panel) {
        panel.classList.toggle("show", panel.dataset.plan === which);
      });
      document.querySelectorAll("[data-plan-btn]").forEach(function (btn) {
        btn.classList.toggle("on", btn.dataset.planBtn === which);
      });
      try { localStorage.setItem(key, which); } catch (e) {}
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () { setPlan(btn.dataset.planBtn); });
    });

    var saved = null;
    try { saved = localStorage.getItem(key); } catch (e) {}
    setPlan(saved || buttons[0].dataset.planBtn);
  })();
})();
