fetch("products.csv", { cache: "no-store" })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Could not load products.csv (${response.status})`);
    }

    return response.text();
  })

  .then(text => {
    const tbody = document.querySelector("#catalogue tbody");
    const searchBox = document.getElementById("search");

    // ------------------------------
    // CSV PARSER
    // Supports quoted commas and escaped quotes.
    // ------------------------------
    function parseCSV(csv) {
      const rows = [];
      let row = [];
      let field = "";
      let inQuotes = false;

      for (let i = 0; i < csv.length; i++) {
        const character = csv[i];

        // Handle quotation marks.
        if (character === '"') {
          // Two quotation marks inside a quoted field = one quotation mark.
          if (inQuotes && csv[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }

          continue;
        }

        // A comma ends a field when outside quotation marks.
        if (character === "," && !inQuotes) {
          row.push(field.trim());
          field = "";
          continue;
        }

        // A line break ends a row when outside quotation marks.
        if (
          (character === "\n" || character === "\r") &&
          !inQuotes
        ) {
          // Treat Windows line endings (\r\n) as one line break.
          if (
            character === "\r" &&
            csv[i + 1] === "\n"
          ) {
            i++;
          }

          row.push(field.trim());
          field = "";

          // Ignore completely blank rows.
          if (row.some(cell => cell !== "")) {
            rows.push(row);
          }

          row = [];
          continue;
        }

        field += character;
      }

      // Add the final row if the file does not end with a line break.
      if (field.length > 0 || row.length > 0) {
        row.push(field.trim());

        if (row.some(cell => cell !== "")) {
          rows.push(row);
        }
      }

      return rows;
    }

    // ------------------------------
    // SAFELY DISPLAY CSV TEXT
    // Prevents product names containing HTML
    // from being interpreted as webpage code.
    // ------------------------------
    function escapeHTML(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    // ------------------------------
    // SLUGIFY CATEGORY NAMES
    // Turns "RAVA/FLOUR/DAL" into "cat-rava-flour-dal"
    // so category rows can be linked to directly.
    // ------------------------------
    function slugify(value) {
      return "cat-" + String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    const rows = parseCSV(text);

    let html = "";
    const categories = [];

    rows.forEach(columns => {
      const product = (columns[0] || "").trim();
      const packSize = (columns[1] || "").trim();
      const status = (columns[2] || "").trim();
      const offer = (columns[3] || "").trim();

      const productLower = product.toLowerCase();

      // ------------------------------
      // IGNORE TITLE AND HEADER ROWS
      // ------------------------------
      if (
        productLower.includes("18 steps") ||
        productLower === "product" ||
        productLower === "product name"
      ) {
        return;
      }

      // ------------------------------
      // CATEGORY ROW
      // A category has text only in column 1.
      // ------------------------------
      if (
        product !== "" &&
        packSize === "" &&
        status === ""
      ) {
        html += `
          <tr class="category" id="${slugify(product)}">
            <td colspan="3">${escapeHTML(product)}</td>
          </tr>
        `;

        categories.push({
          name: product,
          slug: slugify(product)
        });

        return;
      }

      // ------------------------------
      // IGNORE BLANK OR INVALID ROWS
      // A real product needs at least a product name
      // and one other piece of information.
      // ------------------------------
      if (
        product === "" ||
        (packSize === "" && status === "")
      ) {
        return;
      }

      // ------------------------------
      // PRODUCT ROW
      // Three columns:
      // Product | Pack Size | Status
      // A quantity stepper is added for in-stock
      // items only, so customers can build an order.
      // ------------------------------
      const isOutOfStock = status.toLowerCase().includes("out of stock");

      const stepper = isOutOfStock ? "" : `
        <span class="qty-stepper" data-name="${escapeHTML(product)}" data-pack="${escapeHTML(packSize)}">
          <button type="button" class="qty-btn qty-minus" aria-label="Decrease quantity">−</button>
          <span class="qty-value">0</span>
          <button type="button" class="qty-btn qty-plus" aria-label="Increase quantity">+</button>
        </span>
      `;

      html += `
        <tr class="product-row">
          <td class="product-name"><span class="product-name-text">${escapeHTML(product)}</span>${offer ? `<span class="offer-badge" title="${escapeHTML(offer)}">${escapeHTML(offer)}</span>` : ""}${stepper}</td>
          <td>${escapeHTML(packSize)}</td>
          <td>${escapeHTML(status)}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // ------------------------------
    // CATEGORY QUICK-JUMP NAV
    // A row of pill links, one per category,
    // that scroll straight to that section.
    // ------------------------------
    const categoryNav = document.getElementById("categoryNav");

    if (categoryNav && categories.length > 0) {
      categoryNav.innerHTML = categories
        .map(category =>
          `<a href="#${category.slug}" class="category-pill">${escapeHTML(category.name)}</a>`
        )
        .join("");
    }

    const categoryFabList = document.getElementById("categoryFabList");

    if (categoryFabList && categories.length > 0) {
      categoryFabList.innerHTML = categories
        .map(category =>
          `<a href="#${category.slug}">${escapeHTML(category.name)}</a>`
        )
        .join("");
    }

    // ------------------------------
    // JUMP TO CATEGORY ON PAGE LOAD
    // If the page was opened with a #cat-... link
    // (e.g. from the website's category tiles),
    // the browser tries to scroll to it BEFORE this
    // script has built the table, so that automatic
    // scroll silently fails. Do it manually instead,
    // now that the target actually exists.
    // ------------------------------
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    // ============================================================
    // ORDER BUILDER
    // Lets customers pick quantities as they browse, then send
    // the whole list via WhatsApp, Email, or copy it manually.
    // Saved in localStorage so it survives closing the page.
    // ============================================================
    const ORDER_STORAGE_KEY = "catalogueOrder";
    const WHATSAPP_NUMBER = "61478988767";
    const ORDER_EMAIL = "18stepspantryandspices@gmail.com";

    function loadOrder() {
      try {
        const saved = localStorage.getItem(ORDER_STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }

    function saveOrder(order) {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
    }

    let orderItems = loadOrder();

    const orderFabBtn = document.getElementById("orderFabBtn");
    const orderFabCount = document.getElementById("orderFabCount");
    const orderPanel = document.getElementById("orderPanel");
    const orderPanelBody = document.getElementById("orderPanelBody");

    function orderKey(name, pack) {
      return `${name}||${pack}`;
    }

    function totalOrderCount() {
      return Object.values(orderItems).reduce((sum, item) => sum + item.qty, 0);
    }

    function updateOrderBadge() {
      const count = totalOrderCount();

      if (orderFabBtn && orderFabCount) {
        orderFabCount.textContent = count;
        orderFabBtn.classList.toggle("show", count > 0);
      }
    }

    function syncSteppersFromOrder() {
      document.querySelectorAll(".qty-stepper").forEach(stepper => {
        const key = orderKey(stepper.dataset.name, stepper.dataset.pack);
        const qty = orderItems[key] ? orderItems[key].qty : 0;
        stepper.querySelector(".qty-value").textContent = qty;
      });
    }

    function setQty(name, pack, qty) {
      const key = orderKey(name, pack);

      if (qty <= 0) {
        delete orderItems[key];
      } else {
        orderItems[key] = { name, pack, qty };
      }

      saveOrder(orderItems);
      updateOrderBadge();
    }

    // ------------------------------
    // UNIFIED QTY HANDLER
    // One single listener handles every +/- click, whether it's
    // in the main table or inside the open order panel. It always
    // reads/writes the authoritative orderItems state (never the
    // currently-displayed number), then re-syncs every stepper on
    // the page and refreshes the panel if it's open. This avoids
    // the table and panel ever showing different numbers.
    // ------------------------------
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".qty-btn");
      if (!btn) return;

      const stepper = btn.closest(".qty-stepper");
      if (!stepper) return;

      const name = stepper.dataset.name;
      const pack = stepper.dataset.pack;
      const key = orderKey(name, pack);
      let qty = orderItems[key] ? orderItems[key].qty : 0;

      qty = btn.classList.contains("qty-plus") ? qty + 1 : Math.max(0, qty - 1);

      setQty(name, pack, qty);
      syncSteppersFromOrder();

      if (orderPanel && !orderPanel.hidden) {
        renderOrderPanel();
      }
    });

    // Restore any previously saved quantities once the table exists.
    syncSteppersFromOrder();
    updateOrderBadge();

    function buildOrderText() {
      const items = Object.values(orderItems);

      const lines = items.map(item =>
        `- ${item.name}${item.pack ? ` (${item.pack})` : ""} x${item.qty}`
      );

      return `Hi 18 Steps Pantry & Spices, I'd like to order:\n\n${lines.join("\n")}\n\nThank you!`;
    }

    function renderOrderPanel() {
      const items = Object.values(orderItems);

      if (items.length === 0) {
        orderPanelBody.innerHTML = `<p class="order-empty">Your order is empty. Add items using the + buttons in the catalogue.</p>`;
        return;
      }

      const rows = items.map(item => {
        const key = orderKey(item.name, item.pack);
        return `
          <div class="order-row" data-key="${escapeHTML(key)}">
            <div class="order-row-info">
              <span class="order-row-name">${escapeHTML(item.name)}</span>
              ${item.pack ? `<span class="order-row-pack">${escapeHTML(item.pack)}</span>` : ""}
            </div>
            <span class="qty-stepper" data-name="${escapeHTML(item.name)}" data-pack="${escapeHTML(item.pack)}">
              <button type="button" class="qty-btn qty-minus" aria-label="Decrease quantity">−</button>
              <span class="qty-value">${item.qty}</span>
              <button type="button" class="qty-btn qty-plus" aria-label="Increase quantity">+</button>
            </span>
          </div>
        `;
      }).join("");

      orderPanelBody.innerHTML = `
        <div class="order-list">${rows}</div>
        <div class="order-actions">
          <p class="order-send-label">Order via:</p>
          <a class="order-btn order-btn-whatsapp" id="orderSendWhatsapp" href="#" target="_blank" rel="noopener">
            <i class="ti ti-brand-whatsapp" aria-hidden="true"></i> 1. WhatsApp
          </a>
          <p class="order-or">or</p>
          <button type="button" class="order-btn order-btn-copy" id="orderCopyBtn">
            <i class="ti ti-copy" aria-hidden="true"></i> 2. Copy your order
          </button>
          <p class="order-email-hint">...and send it as an email to<br><strong>${ORDER_EMAIL}</strong></p>
          <a class="order-btn order-btn-email" id="orderSendEmail" href="#">
            <i class="ti ti-mail" aria-hidden="true"></i> Open Email
          </a>
          <button type="button" class="order-clear" id="orderClearBtn">Clear order</button>
        </div>
      `;

      const text = buildOrderText();

      const waLink = document.getElementById("orderSendWhatsapp");
      if (waLink) {
        waLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
      }

      const emailLink = document.getElementById("orderSendEmail");
      if (emailLink) {
        emailLink.href = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent("Order from 18 Steps Pantry & Spices website")}&body=${encodeURIComponent(text)}`;
      }

      const copyBtn = document.getElementById("orderCopyBtn");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i> Copied!`;
            setTimeout(() => {
              copyBtn.innerHTML = `<i class="ti ti-copy" aria-hidden="true"></i> 2. Copy your order`;
            }, 1800);
          });
        });
      }

      const clearBtn = document.getElementById("orderClearBtn");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          orderItems = {};
          saveOrder(orderItems);
          updateOrderBadge();
          syncSteppersFromOrder();
          renderOrderPanel();
        });
      }

      // Steppers inside the panel are handled by the same
      // unified listener as the table (see below) - no
      // separate wiring needed here.
    }

    if (orderFabBtn && orderPanel) {
      const openOrderPanel = () => {
        renderOrderPanel();
        orderPanel.hidden = false;
        orderFabBtn.setAttribute("aria-expanded", "true");
      };
      const closeOrderPanel = () => {
        orderPanel.hidden = true;
        orderFabBtn.setAttribute("aria-expanded", "false");
      };

      orderFabBtn.addEventListener("click", () => {
        orderPanel.hidden ? openOrderPanel() : closeOrderPanel();
      });

      document.addEventListener("click", (e) => {
        if (orderPanel.hidden) return;
        if (orderPanel.contains(e.target)) return;
        if (e.target === orderFabBtn || orderFabBtn.contains(e.target)) return;
        if (e.target.closest(".qty-stepper")) return; // adjusting quantity shouldn't close the panel
        closeOrderPanel();
      });

      document.getElementById("orderPanelClose")?.addEventListener("click", closeOrderPanel);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !orderPanel.hidden) closeOrderPanel();
      });
    }

    // ------------------------------
    // SEARCH
    // Searches PRODUCT NAMES ONLY.
    // Category names are not searched.
    // Categories with no matching products
    // are hidden automatically.
    // ------------------------------
    if (searchBox) {
      searchBox.addEventListener("input", function () {
        const searchTerm = this.value
          .trim()
          .toLowerCase();

        const tableRows = [
          ...tbody.querySelectorAll("tr")
        ];

        let activeCategory = null;
        let categoryHasMatch = false;

        tableRows.forEach(row => {
          // When a new category starts, finish checking
          // the previous category.
          if (row.classList.contains("category")) {
            if (activeCategory) {
              activeCategory.style.display =
                categoryHasMatch ? "" : "none";
            }

            activeCategory = row;
            categoryHasMatch = false;

            return;
          }

          const productName =
            row.querySelector(".product-name")
              ?.textContent
              .toLowerCase() || "";

          const matches =
            searchTerm === "" ||
            productName.includes(searchTerm);

          row.style.display =
            matches ? "" : "none";

          if (matches) {
            categoryHasMatch = true;
          }
        });

        // Check the final category after the loop.
        if (activeCategory) {
          activeCategory.style.display =
            categoryHasMatch ? "" : "none";
        }
      });
    }
  })

  .catch(error => {
    console.error("Catalogue error:", error);

    document.querySelector("#catalogue tbody").innerHTML = `
      <tr>
        <td colspan="3">
          Unable to load the catalogue.
        </td>
      </tr>
    `;
  });
