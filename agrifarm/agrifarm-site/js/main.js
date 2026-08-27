/* ==========================================================================
   Agrifarm PLC — Shared behaviour
   Vanilla JS, no build step, no browser storage APIs (state travels via the
   ?lang= URL parameter so it survives full page navigation between the
   site's separate HTML files).
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     1. Language toggle
     --------------------------------------------------------------------- */
  function getLangFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get("lang") === "am" ? "am" : "en";
  }

  function applyLanguage(lang) {
    var isAm = lang === "am";
    document.body.classList.toggle("lang-am", isAm);
    document.documentElement.setAttribute("lang", isAm ? "am" : "en");

    // Toggle pill state
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      var pressed = btn.getAttribute("data-lang-btn") === lang;
      btn.setAttribute("aria-pressed", String(pressed));
    });

    // Carry the selection through every internal link so it persists
    // across full page loads without needing localStorage/cookies.
    document.querySelectorAll("a[data-internal]").forEach(function (a) {
      var base = a.getAttribute("data-href") || a.getAttribute("href").split("?")[0];
      a.setAttribute("href", isAm ? base + "?lang=am" : base);
    });
  }

  function setLanguage(lang, opts) {
    opts = opts || {};
    applyLanguage(lang);
    if (opts.updateUrl !== false) {
      var url = new URL(window.location.href);
      if (lang === "am") {
        url.searchParams.set("lang", "am");
      } else {
        url.searchParams.delete("lang");
      }
      window.history.replaceState({}, "", url.toString());
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setLanguage(getLangFromUrl(), { updateUrl: false });

    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLanguage(btn.getAttribute("data-lang-btn"));
      });
    });

    /* ---------------------------------------------------------------------
       2. Mobile menu
       --------------------------------------------------------------------- */
    var menuToggle = document.getElementById("menu-toggle");
    var mobileMenu = document.getElementById("mobile-menu");
    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener("click", function () {
        var isOpen = mobileMenu.classList.toggle("is-open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        document.getElementById("icon-menu-open").classList.toggle("hidden", isOpen);
        document.getElementById("icon-menu-close").classList.toggle("hidden", !isOpen);
      });
      mobileMenu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          mobileMenu.classList.remove("is-open");
          menuToggle.setAttribute("aria-expanded", "false");
          document.getElementById("icon-menu-open").classList.remove("hidden");
          document.getElementById("icon-menu-close").classList.add("hidden");
        });
      });
    }

    /* ---------------------------------------------------------------------
       3. Active nav link (based on current filename)
       --------------------------------------------------------------------- */
    var currentPage = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav-link]").forEach(function (link) {
      var target = link.getAttribute("data-nav-link");
      if (target === currentPage) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
    });

    /* ---------------------------------------------------------------------
       4. Scroll reveal
       --------------------------------------------------------------------- */
    var revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && revealEls.length) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
      );
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    }

    /* ---------------------------------------------------------------------
       5. Broken hotlinked photo fallback
       --------------------------------------------------------------------- */
    document.querySelectorAll("img.photo").forEach(function (img) {
      img.addEventListener("error", function () {
        img.classList.add("img-fallback");
        img.src =
          "data:image/svg+xml;utf8," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236FA85E" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
          );
      });
    });

    /* ---------------------------------------------------------------------
       6. Footer year
       --------------------------------------------------------------------- */
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });

    /* ---------------------------------------------------------------------
       6b. Ripple feedback on primary buttons (site-wide)
       Pure CSS/JS echo of the "liquid metal" click ripple — a small dot
       spawns at the tap point and fades out. No canvas, no shader.
       --------------------------------------------------------------------- */
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".btn-primary");
      if (!btn) return;
      var rect = btn.getBoundingClientRect();
      var ripple = document.createElement("span");
      ripple.className = "btn-ripple";
      ripple.style.left = (e.clientX - rect.left) + "px";
      ripple.style.top = (e.clientY - rect.top) + "px";
      var size = Math.max(rect.width, rect.height) * 0.5;
      ripple.style.width = size + "px";
      ripple.style.height = size + "px";
      btn.appendChild(ripple);
      window.setTimeout(function () { ripple.remove(); }, 650);
    });

    /* ---------------------------------------------------------------------
       7. Order form — live "N selected" feedback + floating "Done" tray
       Contact and order forms POST directly to FormSubmit; no JS needed
       for the actual submission. This just gives quick visual feedback,
       since the card highlighting itself is handled by CSS :has().
       --------------------------------------------------------------------- */
    var orderForm = document.getElementById("order-form");
    var orderCountEn = document.getElementById("order-count-en");
    var orderCountAm = document.getElementById("order-count-am");
    var orderSummary = document.querySelector("[data-order-summary]");
    var orderTray = document.getElementById("order-tray");
    var orderTrayCount = document.getElementById("order-tray-count");
    var orderTrayDone = document.getElementById("order-tray-done");

    if (orderForm) {
      var checkboxes = orderForm.querySelectorAll(".order-checkbox");
      var orderSectionEl = document.getElementById("order");
      var checkoutInView = false;

      function getSelectedProducts() {
        return Array.prototype.map.call(
          orderForm.querySelectorAll(".order-checkbox:checked"),
          function (cb) { return cb.value; }
        );
      }

      function updateOrderCount() {
        var selected = getSelectedProducts();
        var n = selected.length;

        if (orderCountEn) orderCountEn.textContent = String(n);
        if (orderCountAm) orderCountAm.textContent = String(n);
        if (orderSummary) orderSummary.classList.toggle("opacity-50", n === 0);

        if (orderTray && orderTrayCount) {
          orderTrayCount.textContent = String(n);
          // Hide once the checkout section itself is on screen — on short
          // phone screens the floating tray would otherwise sit right on
          // top of the Send Order button.
          var show = n > 0 && !checkoutInView;
          orderTray.classList.toggle("hidden", !show);
          orderTray.classList.toggle("flex", show);
        }

        updateOrderTotal();
      }

      if (orderSectionEl && "IntersectionObserver" in window) {
        var checkoutObserver = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              checkoutInView = entry.isIntersecting;
              updateOrderCount();
            });
          },
          { threshold: 0.2 }
        );
        checkoutObserver.observe(orderSectionEl);
      }

      checkboxes.forEach(function (cb) {
        cb.addEventListener("change", updateOrderCount);
      });
      updateOrderCount();
      loadPrices();

      // "Done" — drop the selected product list into the notes field,
      // then jump down to the checkout details.
      if (orderTrayDone) {
        orderTrayDone.addEventListener("click", function () {
          var selected = getSelectedProducts();
          var notes = document.getElementById("order-notes");

          if (notes && selected.length) {
            var isAm = document.body.classList.contains("lang-am");
            var heading = isAm ? "የተመረጡ ምርቶች፦" : "Selected products:";
            var listText = heading + "\n" + selected.map(function (p) { return "• " + p; }).join("\n");

            // Strip a previously auto-generated list so re-clicking Done
            // doesn't stack duplicate copies; keep any manual notes below it.
            var existing = notes.value;
            var otherHeading = isAm ? "Selected products:" : "የተመረጡ ምርቶች፦";
            [heading, otherHeading].forEach(function (marker) {
              if (existing.indexOf(marker) === 0) {
                var split = existing.split("\n\n");
                existing = split.slice(1).join("\n\n");
              }
            });
            existing = existing.trim();

            notes.value = existing ? listText + "\n\n" + existing : listText;
          }

          var orderSection = document.getElementById("order");
          if (orderSection) {
            orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
            var nameField = document.getElementById("order-name");
            if (nameField) {
              window.setTimeout(function () { nameField.focus(); }, 450);
            }
          }
        });
      }

      // Gentle nudge if someone submits with nothing selected and no note.
      orderForm.addEventListener("submit", function (e) {
        var anyChecked = getSelectedProducts().length > 0;
        var notes = orderForm.querySelector("#order-notes");
        var hasNotes = notes && notes.value.trim() !== "";
        var hint = document.getElementById("order-hint");
        if (!anyChecked && !hasNotes) {
          e.preventDefault();
          if (hint) hint.classList.remove("hidden");
          notes && notes.focus();
        }
      });

      /* ---------------------------------------------------------------------
         8. Product quick-view modal
         Tapping a card opens a bigger view instead of toggling directly.
         The modal's Add/Remove button flips the same checkbox the order
         form submits, so nothing about the actual order data changes.
         --------------------------------------------------------------------- */
      var modal = document.getElementById("product-modal");
      var modalBackdrop = document.getElementById("product-modal-backdrop");
      var modalPanel = document.getElementById("product-modal-panel");
      var modalClose = document.getElementById("product-modal-close");
      var modalImage = document.getElementById("product-modal-image");
      var modalTitle = document.getElementById("product-modal-title");
      var modalDesc = document.getElementById("product-modal-desc");
      var modalToggle = document.getElementById("product-modal-toggle");
      var modalRemove = document.getElementById("product-modal-remove");
      var modalQty = document.getElementById("product-modal-qty");
      var modalQtyMinus = document.getElementById("product-modal-qty-minus");
      var modalQtyPlus = document.getElementById("product-modal-qty-plus");
      var activeCheckbox = null;
      var lastTrigger = null;

      // Every checkbox keeps its original product name in data-product,
      // permanently — that's the name we show, translate and search on.
      // The submitted checkbox VALUE becomes "<qty>x <name>" once a
      // quantity is set, e.g. "500x Livestock Ear Tags".
      document.querySelectorAll(".order-checkbox").forEach(function (cb) {
        if (!cb.dataset.product) cb.dataset.product = cb.value;
        if (!cb.dataset.qty) cb.dataset.qty = "1";
      });

      /* ---------------------------------------------------------------------
         8a. Product pricing — fetched from the Netlify Function backing the
         private Telegram price bot (see /netlify/functions/get-prices.js).
         If that function isn't deployed yet, this fails silently and every
         price element just stays hidden — the order flow itself never
         depends on pricing being available.
         --------------------------------------------------------------------- */
      var currentPrices = {};

      function formatETB(amount) {
        var n = Number(amount);
        if (!isFinite(n)) return "";
        return n.toLocaleString("en-US") + " ETB";
      }

      function priceFor(productName) {
        var p = currentPrices && currentPrices[productName];
        return typeof p === "number" ? p : null;
      }

      function applyCardPrices() {
        document.querySelectorAll("[data-price-for]").forEach(function (el) {
          var price = priceFor(el.getAttribute("data-price-for"));
          if (price !== null) {
            el.textContent = formatETB(price);
            el.classList.remove("hidden");
          }
        });
      }

      function loadPrices() {
        fetch("/.netlify/functions/get-prices")
          .then(function (res) { return res.ok ? res.json() : {}; })
          .then(function (prices) {
            currentPrices = prices || {};
            applyCardPrices();
            refreshModalPrice();
            updateOrderTotal();
          })
          .catch(function () {
            /* Function not deployed yet, or offline — no prices shown, nothing breaks. */
          });
      }

      var orderTotalRow = document.getElementById("order-total-row");
      var orderTotalAmount = document.getElementById("order-total-amount");
      var orderTotalHidden = document.getElementById("order-total-hidden");

      function updateOrderTotal() {
        if (!orderTotalRow || !orderTotalAmount) return;
        var checked = orderForm.querySelectorAll(".order-checkbox:checked");
        var total = 0;
        var anyPriced = false;
        checked.forEach(function (cb) {
          var price = priceFor(cb.dataset.product);
          if (price === null) return;
          anyPriced = true;
          var qty = clampQty(cb.dataset.qty || "1");
          total += price * qty;
        });
        if (anyPriced) {
          orderTotalAmount.textContent = formatETB(total);
          if (orderTotalHidden) orderTotalHidden.value = formatETB(total);
          orderTotalRow.classList.remove("hidden");
          orderTotalRow.classList.add("flex");
        } else {
          orderTotalRow.classList.add("hidden");
          orderTotalRow.classList.remove("flex");
          if (orderTotalHidden) orderTotalHidden.value = "";
        }
      }

      function clampQty(n) {
        n = parseInt(n, 10);
        if (!n || n < 1) n = 1;
        if (n > 99999) n = 99999;
        return n;
      }

      var modalPrice = document.getElementById("product-modal-price");

      function refreshModalPrice() {
        if (!modalPrice || !activeCheckbox) return;
        var price = priceFor(activeCheckbox.dataset.product);
        if (price === null) {
          modalPrice.classList.add("hidden");
          return;
        }
        var qty = modalQty ? clampQty(modalQty.value) : 1;
        var lineTotal = price * qty;
        modalPrice.textContent =
          qty > 1
            ? formatETB(price) + " × " + qty + " = " + formatETB(lineTotal)
            : formatETB(price);
        modalPrice.classList.remove("hidden");
      }

      function refreshModalToggleLabel() {
        if (!activeCheckbox || !modalToggle) return;
        var isChecked = activeCheckbox.checked;
        modalToggle.querySelector(".toggle-add").classList.toggle("hidden", isChecked);
        modalToggle.querySelector(".toggle-update").classList.toggle("hidden", !isChecked);
        if (modalRemove) modalRemove.classList.toggle("hidden", !isChecked);
      }

      function openProductModal(cardEl, triggerEl) {
        var img = cardEl.querySelector("img.photo");
        var titleEl = cardEl.querySelector("h3");
        var descEl = cardEl.querySelector("p.text-ink-soft");
        activeCheckbox = cardEl.querySelector(".order-checkbox");
        lastTrigger = triggerEl;

        if (img && modalImage) {
          modalImage.src = img.src;
          modalImage.alt = img.alt;
        }
        if (titleEl && modalTitle) modalTitle.innerHTML = titleEl.innerHTML;
        if (descEl && modalDesc) modalDesc.innerHTML = descEl.innerHTML;
        if (modalQty && activeCheckbox) modalQty.value = clampQty(activeCheckbox.dataset.qty);
        refreshModalToggleLabel();
        refreshModalPrice();

        modal.classList.remove("hidden");
        modal.classList.add("is-visible");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");

        // Two rAFs so the browser commits the display change before the
        // transition classes flip — otherwise it can't animate from.
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            modal.classList.add("is-open");
          });
        });

        window.setTimeout(function () {
          if (modalClose) modalClose.focus();
        }, 260);
      }

      function closeProductModal() {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        window.setTimeout(function () {
          modal.classList.add("hidden");
          modal.classList.remove("is-visible");
        }, 260);
        if (lastTrigger) lastTrigger.focus();
      }

      document.querySelectorAll(".order-card-trigger").forEach(function (trigger) {
        trigger.addEventListener("click", function () {
          var card = trigger.closest(".order-card");
          if (card) openProductModal(card, trigger);
        });
      });

      // Quantity stepper
      if (modalQtyMinus) {
        modalQtyMinus.addEventListener("click", function () {
          if (modalQty) modalQty.value = clampQty((parseInt(modalQty.value, 10) || 1) - 1);
          refreshModalPrice();
        });
      }
      if (modalQtyPlus) {
        modalQtyPlus.addEventListener("click", function () {
          if (modalQty) modalQty.value = clampQty((parseInt(modalQty.value, 10) || 1) + 1);
          refreshModalPrice();
        });
      }
      if (modalQty) {
        modalQty.addEventListener("input", refreshModalPrice);
        modalQty.addEventListener("change", function () {
          modalQty.value = clampQty(modalQty.value);
          refreshModalPrice();
        });
      }

      if (modalToggle) {
        modalToggle.addEventListener("click", function () {
          if (!activeCheckbox) return;
          var qty = clampQty(modalQty ? modalQty.value : 1);
          activeCheckbox.dataset.qty = String(qty);
          activeCheckbox.checked = true;
          activeCheckbox.value = qty + "x " + activeCheckbox.dataset.product;
          activeCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
          refreshModalToggleLabel();
        });
      }

      if (modalRemove) {
        modalRemove.addEventListener("click", function () {
          if (!activeCheckbox) return;
          activeCheckbox.checked = false;
          activeCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
          refreshModalToggleLabel();
        });
      }

      if (modalClose) modalClose.addEventListener("click", closeProductModal);
      if (modalBackdrop) modalBackdrop.addEventListener("click", closeProductModal);

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modal.classList.contains("is-open")) {
          closeProductModal();
        }
      });
    }
  });
})();