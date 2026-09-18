/* המעבדה — סקריפט משותף: ניווט, אנימציות כניסה, אפקטים וטופס */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var header = doc.querySelector(".site-header");
  var toggle = doc.querySelector(".nav-toggle");
  var nav = doc.getElementById("main-nav");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- מחרוזות ממשק לפי שפת העמוד ---------- */
  var STRINGS = {
    he: {
      toTop: "חזרה לראש העמוד",
      menuOpen: "פתיחת תפריט",
      menuClose: "סגירת תפריט",
      playerService: "רכישת נגן אנדרואיד כשר",
      productNote: function (p) { return "אשמח לקבל פרטים על " + p + "."; },
      sending: "שולח...",
      sent: "תודה! הפנייה התקבלה ונחזור אליכם בהקדם.",
      failed: "השליחה נכשלה. נסו שוב או כתבו לנו ישירות למייל."
    },
    en: {
      toTop: "Back to top",
      menuOpen: "Open menu",
      menuClose: "Close menu",
      playerService: "Buying a kosher Android player",
      productNote: function (p) { return "I'd like details about the " + p + "."; },
      sending: "Sending...",
      sent: "Thank you! Your inquiry was received and we'll get back to you soon.",
      failed: "Sending failed. Please try again or email us directly."
    }
  };
  var t = STRINGS[(root.lang || "he").slice(0, 2)] || STRINGS.he;

  /* ---------- שכבות רקע ואלמנטים דקורטיביים ---------- */
  function buildChrome() {
    if (!reduced.matches) {
      var fx = doc.createElement("div");
      fx.className = "bg-fx";
      fx.setAttribute("aria-hidden", "true");
      fx.innerHTML = '<span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span>';
      doc.body.prepend(fx);
    }

    var bar = doc.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    doc.body.appendChild(bar);

    var top = doc.createElement("button");
    top.className = "to-top";
    top.type = "button";
    top.setAttribute("aria-label", t.toTop);
    top.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>';
    top.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced.matches ? "auto" : "smooth" });
    });
    doc.body.appendChild(top);

    return { bar: bar, top: top };
  }

  var chrome = buildChrome();

  /* ---------- גלילה: כותרת, פס התקדמות, כפתור חזרה ---------- */
  // גובה המסמך נמדד מראש כדי שמאזין הגלילה לא יאלץ חישוב פריסה בכל אירוע
  var scrollMax = 0;
  function measure() {
    scrollMax = doc.documentElement.scrollHeight - window.innerHeight;
  }

  function onScroll() {
    var y = window.scrollY || 0;
    if (header) header.classList.toggle("is-scrolled", y > 20);
    chrome.top.classList.toggle("is-on", y > 600);
    chrome.bar.style.setProperty("--p", scrollMax > 0 ? String(Math.min(y / scrollMax, 1)) : "0");
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { measure(); onScroll(); }, { passive: true });
  window.addEventListener("load", function () { measure(); onScroll(); });
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () { measure(); onScroll(); }).observe(doc.body);
  }
  measure();
  onScroll();

  /* ---------- תפריט מובייל ---------- */
  function setMenu(open) {
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? t.menuClose : t.menuOpen);
    doc.body.style.overflow = open ? "hidden" : "";
  }
  if (toggle && nav) {
    nav.querySelectorAll("li").forEach(function (li, i) {
      li.style.setProperty("--i", i);
    });
    toggle.addEventListener("click", function () {
      setMenu(!header.classList.contains("is-open"));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("is-open")) {
        setMenu(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 961px)").addEventListener("change", function (mq) {
      if (mq.matches) setMenu(false);
    });
  }

  /* ---------- אנימציות כניסה עם השהיה מדורגת ---------- */
  var reveals = Array.prototype.slice.call(doc.querySelectorAll(".reveal"));

  // השהיה אוטומטית לפריטים סמוכים שלא הוגדרה להם ידנית.
  // הדירוג מתאפס בכל שורה בגריד, אחרת פריטים בשורות האחרונות נכנסים באיחור מורגש.
  reveals.forEach(function (el) {
    if (el.style.getPropertyValue("--d")) return;
    var parent = el.parentElement;
    if (!parent) return;
    var siblings = Array.prototype.filter.call(parent.children, function (c) {
      return c.classList.contains("reveal");
    });
    if (siblings.length < 2) return;

    var top = Math.round(el.offsetTop);
    var indexInRow = 0;
    for (var i = 0; i < siblings.length; i++) {
      if (siblings[i] === el) break;
      if (Math.round(siblings[i].offsetTop) === top) indexInRow++;
    }
    if (indexInRow > 0) el.style.setProperty("--d", Math.min(indexInRow, 5) * 0.07 + "s");
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) show(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });

    // רשת ביטחון: קפיצה לעוגן או גלילה מהירה עלולה "לדלג" על פריטים,
    // ולכן אחרי שהגלילה נעצרת נחשפים כל אלה שכבר עברו את קו הצפייה.
    var sweepTimer;
    var sweep = function () {
      var limit = window.innerHeight * 0.92;
      reveals.slice().forEach(function (el) {
        if (el.getBoundingClientRect().top < limit) show(el);
      });
    };
    window.addEventListener("scroll", function () {
      clearTimeout(sweepTimer);
      sweepTimer = setTimeout(sweep, 160);
    }, { passive: true });
    window.addEventListener("load", sweep);
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
    reveals.length = 0;
  }

  function show(el) {
    el.classList.add("is-visible");
    if (io) io.unobserve(el);
    var at = reveals.indexOf(el);
    if (at > -1) reveals.splice(at, 1);
  }

  /* ---------- זוהר עוקב-עכבר על כרטיסים ---------- */
  var spotSelector = ".card, .step, .product, .app, .contact-card, .form-card, .stat, .dev-visual, .showcase, .featured";
  if (!reduced.matches && window.matchMedia("(hover: hover)").matches) {
    doc.querySelectorAll(spotSelector).forEach(function (el) {
      el.classList.add("spot");
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left) + "px");
        el.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* ---------- ספירה מונפשת למספרים ---------- */
  function animateCount(el) {
    var raw = el.textContent.trim();
    var match = raw.match(/[\d][\d,.]*/);
    if (!match) return;
    var target = parseFloat(match[0].replace(/,/g, ""));
    if (!isFinite(target)) return;

    var grouped = match[0].indexOf(",") > -1;
    var before = raw.slice(0, match.index);
    var after = raw.slice(match.index + match[0].length);
    var start = performance.now();
    var dur = 1600;

    function frame(now) {
      var t = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      var value = Math.round(target * eased);
      el.textContent = before + (grouped ? value.toLocaleString("en-US") : String(value)) + after;
      if (t < 1) requestAnimationFrame(frame);
    }
    el.textContent = before + "0" + after;
    requestAnimationFrame(frame);
  }

  var counters = doc.querySelectorAll(".stat-num");
  if (counters.length && !reduced.matches && "IntersectionObserver" in window) {
    var countIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { countIo.observe(el); });
  }

  /* ---------- סימון הקישור הפעיל בניווט לפי מקטע ---------- */
  var sectionLinks = Array.prototype.filter.call(
    doc.querySelectorAll('.main-nav a[href*="#"]'),
    function (a) {
      var hash = a.getAttribute("href").split("#")[1];
      return hash && doc.getElementById(hash);
    }
  );
  if (sectionLinks.length && "IntersectionObserver" in window) {
    var linkFor = {};
    var targets = sectionLinks.map(function (a) {
      var id = a.getAttribute("href").split("#")[1];
      linkFor[id] = a;
      return doc.getElementById(id);
    });
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = linkFor[entry.target.id];
        if (link) link.classList.toggle("is-active", entry.isIntersecting);
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    targets.forEach(function (t) { navIo.observe(t); });
  }

  /* ---------- שנה נוכחית בפוטר ---------- */
  doc.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- טופס יצירת קשר ---------- */
  var form = doc.getElementById("lead-form");
  if (form) {
    var params = new URLSearchParams(window.location.search);
    var product = params.get("product");
    if (product) {
      form.elements.service.value = t.playerService;
      form.elements.description.value = t.productNote(product);
    }

    var status = form.querySelector(".form-status");
    var button = form.querySelector("button[type=submit]");
    var buttonHtml = button.innerHTML;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      button.disabled = true;
      button.textContent = t.sending;
      status.className = "form-status";
      status.textContent = "";

      fetch(form.action.replace("formsubmit.co/", "formsubmit.co/ajax/"), {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          if (!res.ok) throw new Error(res.status);
          return res.json();
        })
        .then(function () {
          form.reset();
          status.classList.add("ok");
          status.textContent = t.sent;
        })
        .catch(function () {
          status.classList.add("err");
          status.textContent = t.failed;
        })
        .finally(function () {
          button.disabled = false;
          button.innerHTML = buttonHtml;
        });
    });
  }

  /* ---------- פירוט מלא בנגנים: כל כרטיס נפתח בנפרד ---------- */
  doc.querySelectorAll("[data-open-details]").forEach(function (link) {
    link.addEventListener("click", function () {
      var targetId = link.getAttribute("href").split("#")[1];
      var target = targetId && doc.getElementById(targetId);
      var details = target && target.querySelector("details.more");
      if (details) details.open = true;
    });
  });

  /* ---------- סינון אפליקציות בעמוד ההורדות ---------- */
  var filterButtons = doc.querySelectorAll(".filter-btn");
  if (filterButtons.length) {
    var apps = doc.querySelectorAll(".app[data-price]");
    filterButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-filter");
        filterButtons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        apps.forEach(function (app) {
          var show = value === "all" || app.getAttribute("data-price") === value;
          app.hidden = !show;
          if (show && !reduced.matches) {
            app.style.animation = "none";
            void app.offsetWidth;
            app.style.animation = "answer-in .45s cubic-bezier(.16,1,.3,1)";
          }
        });
      });
    });
  }

  // מונע ריצוד של אנימציות בזמן שינוי גודל החלון
  var resizeTimer;
  window.addEventListener("resize", function () {
    root.classList.add("is-resizing");
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { root.classList.remove("is-resizing"); }, 200);
  }, { passive: true });
})();
