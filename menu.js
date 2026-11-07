// ============================================================
// MENU RENDERING + DISH REVIEWS + ADD-TO-ORDER BUTTONS
// Reviews are saved online (Firebase) so every visitor sees them.
// If Firebase is not available, they fall back to this browser only.
// ============================================================
(function () {
  "use strict";

  const REV_KEY = "annamReviews";
  const read = (k) => {
    try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; }
  };
  const write = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  };
  const isJP = () => document.documentElement.lang === "ja";
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Turn the compact arrays from menu-data.js into objects
  const cats = MENU_CATEGORIES.map((c) => ({
    id: c.id, en: c.en, jp: c.jp, noteEn: c.noteEn || "", noteJp: c.noteJp || "",
    items: c.items.map(([name, price, en, jp]) => ({ name, price, en, jp })),
  }));
  const allItems = cats.flatMap((c) => c.items);

  const tabsEl = document.getElementById("menuTabs");
  const listEl = document.getElementById("menuList");
  const noteEl = document.getElementById("menuNote");
  const searchEl = document.getElementById("menuSearch");
  if (!tabsEl || !listEl) return;

  let activeCat = cats[0].id;
  let query = "";

  // ---------- Review dialog elements ----------
  const dialog = document.getElementById("reviewDialog");
  const form = document.getElementById("reviewForm");
  const dlgTitle = document.getElementById("dlgTitle");
  const starPicker = document.getElementById("starPicker");
  const revName = document.getElementById("revName");
  const revText = document.getElementById("revText");
  const dlgMsg = document.getElementById("dlgMsg");
  const dlgReviews = document.getElementById("dlgReviews");
  let current = null;
  let rating = 0;

  // ---------- Review storage ----------
  const useCloud = typeof db !== "undefined" && !!db;
  let allReviews = {};
  if (useCloud) {
    db.collection("reviews").orderBy("createdAt", "desc").limit(1000).onSnapshot(
      (snap) => {
        const g = {};
        snap.docs.forEach((d) => {
          const r = d.data();
          (g[r.dish] = g[r.dish] || []).push(r);
        });
        allReviews = g;
        renderList();
        if (dialog.open && current) drawDialogReviews();
      },
      (err) => console.error("Reviews could not load:", err)
    );
  } else {
    allReviews = read(REV_KEY);
  }

  // ---------- Tabs ----------
  function renderTabs() {
    tabsEl.innerHTML = cats
      .map((c) => {
        const on = !query && c.id === activeCat ? " active" : "";
        return `<button class="tab${on}" data-cat="${c.id}">${esc(isJP() ? c.jp : c.en)}</button>`;
      })
      .join("");
  }

  // ---------- Dish list ----------
  function summary(it, revs) {
    const jp = isJP();
    if (!revs.length) {
      return `<small class="rev-sum muted">${jp ? "最初のレビューを書きませんか？" : "Be the first to review"}</small>`;
    }
    const avg = revs.reduce((s, r) => s + r.rating, 0) / revs.length;
    return `<button class="rev-open" data-name="${esc(it.name)}"><b>&#9733; ${avg.toFixed(1)}</b> (${revs.length} ${jp ? "件" : revs.length === 1 ? "review" : "reviews"})</button>`;
  }

  function itemHTML(it, reviews) {
    const jp = isJP();
    const desc = jp && it.jp ? it.jp : it.en;
    const revs = reviews[it.name] || [];
    const preview = revs.slice(0, 2).map((r) => {
      const t = r.text && r.text.length > 90 ? r.text.slice(0, 90) + "\u2026" : (r.text || "");
      return `<div class="rev-prev"><span class="stars-static">${"&#9733;".repeat(r.rating)}</span> <b>${esc(r.name)}</b>${t ? " &ndash; " + esc(t) : ""}</div>`;
    }).join("");
    const more = revs.length > 2
      ? `<button class="see-all" data-name="${esc(it.name)}">${jp ? "すべて見る (" + revs.length + ")" : "See all " + revs.length + " reviews"}</button>` : "";
    return `
      <li class="dish">
        <div class="dish-main">
          <h4>${esc(it.name)}</h4>
          <p>${esc(desc)}</p>
          <div class="dish-meta">
            ${summary(it, revs)}
            <button class="btn-mini" data-name="${esc(it.name)}">${jp ? "レビューを書く" : "Write a review"}</button>
            <button class="btn-add" data-add="${esc(it.name)}">${jp ? "+ 追加" : "+ Add"}</button>
          </div>
          ${preview}${more}
        </div>
        <strong class="price">&yen;${it.price.toLocaleString("en-US")}</strong>
      </li>`;
  }

  function renderList() {
    const reviews = allReviews;
    let items;
    if (query) {
      const q = query.toLowerCase();
      items = allItems.filter((it) => (it.name + " " + it.en + " " + it.jp).toLowerCase().includes(q));
      noteEl.textContent = "";
    } else {
      const c = cats.find((x) => x.id === activeCat);
      items = c.items;
      noteEl.textContent = isJP() ? c.noteJp : c.noteEn;
    }
    listEl.innerHTML = items.length
      ? items.map((it) => itemHTML(it, reviews)).join("")
      : `<li class="empty">${isJP() ? "見つかりませんでした。" : "No dishes found."}</li>`;
  }

  function renderMenu() {
    if (searchEl) searchEl.placeholder = isJP() ? "料理を検索..." : "Search dishes...";
    renderTabs();
    renderList();
  }
  window.renderMenu = renderMenu;

  tabsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (!b) return;
    activeCat = b.dataset.cat;
    query = "";
    if (searchEl) searchEl.value = "";
    renderMenu();
  });

  if (searchEl) {
    searchEl.addEventListener("input", () => {
      query = searchEl.value.trim();
      renderMenu();
    });
  }

  // ---------- Review dialog ----------
  function drawStars() {
    starPicker.innerHTML = [1, 2, 3, 4, 5]
      .map((v) => `<button type="button" class="star${v <= rating ? " on" : ""}" data-v="${v}" aria-label="${v} star">&#9733;</button>`)
      .join("");
  }

  function drawDialogReviews() {
    const revs = allReviews[current.name] || [];
    dlgReviews.innerHTML = revs.length
      ? revs
          .map(
            (r) => `<div class="one-review">
              <div><b>${esc(r.name)}</b> <span class="stars-static">${"&#9733;".repeat(r.rating)}</span> <small class="muted">${esc(r.date || "")}</small></div>
              ${r.text ? `<p>${esc(r.text)}</p>` : ""}
            </div>`
          )
          .join("")
      : `<p class="muted">${isJP() ? "まだレビューはありません。" : "No reviews yet. Be the first!"}</p>`;
  }

  function openDialog(it) {
    current = it;
    rating = 0;
    drawStars();
    dlgTitle.textContent = it.name;
    revName.value = "";
    revText.value = "";
    dlgMsg.textContent = "";
    drawDialogReviews();
    dialog.showModal();
  }

  listEl.addEventListener("click", (e) => {
    const b = e.target.closest(".btn-mini, .see-all, .rev-open");
    if (!b) return;
    const it = allItems.find((x) => x.name === b.dataset.name);
    if (it) openDialog(it);
  });

  starPicker.addEventListener("click", (e) => {
    const b = e.target.closest(".star");
    if (!b) return;
    rating = Number(b.dataset.v);
    drawStars();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!rating) {
      dlgMsg.textContent = isJP() ? "星の数を選んでください。" : "Please choose a star rating.";
      return;
    }
    const review = {
      name: revName.value.trim() || (isJP() ? "ゲスト" : "Guest"),
      rating,
      text: revText.value.trim(),
      date: new Date().toISOString().slice(0, 10),
    };
    if (useCloud) {
      db.collection("reviews")
        .add({ dish: current.name, ...review, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => { dlgMsg.textContent = isJP() ? "ありがとうございます！" : "Thank you for your review!"; })
        .catch((err) => {
          console.error(err);
          dlgMsg.textContent = isJP() ? "送信できませんでした。もう一度お試しください。" : "Could not send. Please try again.";
        });
    } else {
      const all = read(REV_KEY);
      if (!all[current.name]) all[current.name] = [];
      all[current.name].unshift(review);
      write(REV_KEY, all);
      allReviews = all;
      dlgMsg.textContent = isJP() ? "ありがとうございます！" : "Thank you for your review!";
    }
    rating = 0;
    drawStars();
    revName.value = "";
    revText.value = "";
    drawDialogReviews();
    renderList();
  });

  document.getElementById("dlgClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  renderMenu();
})();