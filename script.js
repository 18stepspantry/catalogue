fetch("products.csv", { cache: "no-store" })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Could not load products.csv (${response.status})`);
    }

    return response.text();
  })

  .then(text => {
    const catalogueGrid = document.querySelector("#catalogueGrid");
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

        if (character === '"') {
          if (inQuotes && csv[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }

        if (character === "," && !inQuotes) {
          row.push(field.trim());
          field = "";
          continue;
        }

        if (
          (character === "\n" || character === "\r") &&
          !inQuotes
        ) {
          if (character === "\r" && csv[i + 1] === "\n") {
            i++;
          }

          row.push(field.trim());
          field = "";

          if (row.some(cell => cell !== "")) {
            rows.push(row);
          }

          row = [];
          continue;
        }

        field += character;
      }

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
    // ------------------------------
    function escapeHTML(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function slugify(value) {
      return "cat-" + String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    function productSlug(value) {
      return String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    function formatPrice(value) {
      const num = parseFloat(value);
      if (isNaN(num)) return null;
      return `$${num.toFixed(2)}`;
    }

    function placeholderImage() {
      return `
        <div class="product-image-placeholder" aria-label="Image coming soon">
          <i class="ti ti-camera-off" aria-hidden="true"></i>
          <span>Image coming soon</span>
        </div>
      `;
    }

    const rows = parseCSV(text);
    const categories = [];
    let currentCategory = null;
    let currentProduct = "";
    let currentBrand = "";
    let categoryHTML = "";
    let productCount = 0;

    rows.forEach(columns => {
      let product = (columns[0] || "").trim();
      let brand = (columns[1] || "").trim();
      const packSize = (columns[2] || "").trim();
      const priceRaw = (columns[3] || "").trim();
      const offer = (columns[4] || "").trim();
      // Column F contains only the image filename, e.g. black-rice.jpg.
      // Images are stored under images/products/<category-folder>/.
      const imageFile = (columns[5] || "").trim();

      const productLower = product.toLowerCase();

      // Ignore title/header rows.
      if (
        productLower.includes("18 steps") ||
        productLower === "product" ||
        productLower === "product name"
      ) {
        return;
      }

      // A category has text only in column 1.
      if (
        product !== "" &&
        brand === "" &&
        packSize === "" &&
        priceRaw === "" &&
        offer === ""
      ) {
        if (currentCategory) {
          categoryHTML += `</div></section>`;
        }

        currentCategory = {
          name: product,
          slug: slugify(product)
        };

        categories.push(currentCategory);

        categoryHTML += `
          <section class="product-category" id="${currentCategory.slug}" data-category="${escapeHTML(product.toLowerCase())}">
            <div class="category-heading-row">
              <h2 class="product-category-title">${escapeHTML(product)}</h2>
              <span class="category-product-count" data-category-count>0 products</span>
            </div>
            <div class="product-grid">
        `;

        currentProduct = "";
        currentBrand = "";
        return;
      }

      // Blank Product = continuation row. The product/brand is inherited.
      const isContinuation = product === "";

      if (isContinuation) {
        product = currentProduct;
        if (brand === "") {
          brand = currentBrand;
        }
      }

      if (
        !currentCategory ||
        product === "" ||
        (packSize === "" && priceRaw === "")
      ) {
        return;
      }

      currentProduct = product;
      currentBrand = brand;

      const isOutOfStock = offer.toLowerCase() === "out of stock";
      const price = formatPrice(priceRaw);
      const priceValue = isNaN(parseFloat(priceRaw)) ? 0 : parseFloat(priceRaw);

      let badge = "";
      if (isOutOfStock) {
        badge = `<span class="stock-badge">Out of Stock</span>`;
      } else if (offer) {
        badge = `<span class="offer-badge" title="${escapeHTML(offer)}">${escapeHTML(offer)}</span>`;
      }

      const stepper = isOutOfStock ? `
        <span class="product-out-stock">Out of stock</span>
      ` : `
        <span class="qty-stepper"
              data-name="${escapeHTML(product)}"
              data-brand="${escapeHTML(brand)}"
              data-pack="${escapeHTML(packSize)}"
              data-price="${priceValue}">
          <button type="button" class="qty-btn qty-minus" aria-label="Decrease quantity">−</button>
          <span class="qty-value">0</span>
          <button type="button" class="qty-btn qty-plus" aria-label="Increase quantity">+</button>
        </span>
      `;

      // Stage 3: Column F contains only the image filename.
      // The folder is determined from the category name, so the CSV stays simple.
      // Example: rice + black-rice.jpg -> images/products/rice/black-rice.jpg
      const categoryFolderMap = {
        "RICE": "rice",
        "MILLETS": "millets",
        "RAVA/FLOUR/DAL": "rava-flour-dal",
        "VEGETABLE FRYUMS/PAPADS": "vegetable-fryums-papads",
        "SPICES (WHOLE/GRIND)": "spices",
        "OIL/GHEE": "oil-ghee",
        "MASALA POWDERS": "masala-powders",
        "VERMICELLI": "vermicelli",
        "COFFEE/TEA/DRINKS": "coffee-tea-drinks",
        "SNACKS and SWEETS": "snacks-sweets"
      };

      const categoryFolder = categoryFolderMap[currentCategory.name] || slugify(currentCategory.name).replace(/^cat-/, "");
      const imagePath = imageFile
        ? `images/products/${categoryFolder}/${imageFile}`
        : "";

      const imageHTML = imagePath
        ? `<img class="product-image" src="${escapeHTML(imagePath)}" alt="${escapeHTML(product)}" loading="lazy" onerror="this.hidden=true; this.nextElementSibling.hidden=false;">
           <div class="product-image-placeholder" aria-label="Image coming soon" hidden>
             <i class="ti ti-camera-off" aria-hidden="true"></i>
             <span>Image coming soon</span>
           </div>`
        : placeholderImage();

      // Display-only formatting: add a little breathing room around slashes
      // so long names such as "Karamanialasandalu/Vanpa Alasande Kalu"
      // have natural wrapping points. The original product value is kept
      // unchanged for cart/search/order data.
      const displayProduct = product.replace(/\s*\/\s*/g, " / ");

      categoryHTML += `
        <article class="product-card"
                 data-product="${escapeHTML(product.toLowerCase())}"
                 data-brand="${escapeHTML(brand.toLowerCase())}"
                 data-pack="${escapeHTML(packSize.toLowerCase())}">
          <div class="product-image-wrap">
            ${imageHTML}
            ${badge ? `<div class="product-badge-wrap">${badge}</div>` : ""}
          </div>

          <div class="product-card-body">
            <h3 class="product-card-name">${escapeHTML(displayProduct)}</h3>
            ${brand ? `<p class="product-card-brand">${escapeHTML(brand)}</p>` : ""}
            ${packSize ? `<p class="product-card-pack">${escapeHTML(packSize)}</p>` : ""}

            <div class="product-card-bottom">
              <strong class="product-card-price">${price !== null ? price : ""}</strong>
              ${stepper}
            </div>
          </div>
        </article>
      `;

      productCount++;
    });

    if (currentCategory) {
      categoryHTML += `</div></section>`;
    }

    if (catalogueGrid) {
      catalogueGrid.innerHTML = categoryHTML;

      catalogueGrid.querySelectorAll(".product-category").forEach(section => {
        const count = section.querySelectorAll(".product-card").length;
        const countEl = section.querySelector("[data-category-count]");
        if (countEl) {
          countEl.textContent = `${count} ${count === 1 ? "product" : "products"}`;
        }
      });
    }

    // ------------------------------
    // CATEGORY NAVIGATION
    // Stage 2 uses a permanent desktop sidebar and a
    // hamburger-style drawer on mobile. Both are generated
    // from the same category list in products.csv.
    // ------------------------------
    const categorySidebarList = document.getElementById("categorySidebarList");
    const mobileCategoryList = document.getElementById("mobileCategoryList");

    const categoryLinksHTML = categories
      .map(category =>
        `<a href="#${category.slug}" class="category-link">
          <span>${escapeHTML(category.name)}</span>
          <i class="ti ti-chevron-right" aria-hidden="true"></i>
        </a>`
      )
      .join("");

    if (categorySidebarList && categories.length > 0) {
      categorySidebarList.innerHTML = categoryLinksHTML;
    }

    if (mobileCategoryList && categories.length > 0) {
      mobileCategoryList.innerHTML = categoryLinksHTML;
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
    // ------------------------------
    // SAFE CATEGORY JUMP
    // Move the page vertically to the category without letting
    // the browser horizontally scroll the wide mobile table.
    // ------------------------------
    function jumpToCategory(target) {
      if (!target) return;

      const y =
        target.getBoundingClientRect().top +
        window.scrollY -
        90;

      window.scrollTo({
        top: y,
        behavior: "smooth"
      });
    }

    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) {
        jumpToCategory(target);
      }
    }

    // Category links are generated after the table is built.
    // Handle them explicitly so clicking a category never leaves
    // the five-column table horizontally shifted.
    function handleCategoryClick(event) {
      const link = event.currentTarget;
      const href = link.getAttribute("href") || "";

      if (!href.startsWith("#")) return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();

      if (history.pushState) {
        history.pushState(null, "", href);
      }

      jumpToCategory(target);
    }

    document
      .querySelectorAll("#categorySidebarList a[href^='#'], #mobileCategoryList a[href^='#']")
      .forEach(link => {
        link.addEventListener("click", handleCategoryClick);
      });

    // ------------------------------
    // MOBILE CATEGORY DRAWER
    // ------------------------------
    const mobileCategoryBtn = document.getElementById("mobileCategoryBtn");
    const mobileCategoryDrawer = document.getElementById("mobileCategoryDrawer");
    const mobileCategoryClose = document.getElementById("mobileCategoryClose");

    function closeMobileCategories() {
      if (!mobileCategoryDrawer) return;
      mobileCategoryDrawer.hidden = true;
      mobileCategoryBtn?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("category-drawer-open");
    }

    function openMobileCategories() {
      if (!mobileCategoryDrawer) return;
      mobileCategoryDrawer.hidden = false;
      mobileCategoryBtn?.setAttribute("aria-expanded", "true");
      document.body.classList.add("category-drawer-open");
    }

    mobileCategoryBtn?.addEventListener("click", () => {
      mobileCategoryDrawer?.hidden ? openMobileCategories() : closeMobileCategories();
    });

    mobileCategoryClose?.addEventListener("click", closeMobileCategories);

    mobileCategoryList?.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", closeMobileCategories);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMobileCategories();
    });

    // ============================================================
    // ORDER BUILDER
    // Lets customers pick quantities as they browse, then send
    // the whole list via WhatsApp or a one-click email.
    // Saved in localStorage so it survives closing the page.
    // ============================================================
    const ORDER_STORAGE_KEY = "catalogueOrder";
    const WHATSAPP_NUMBER = "61478988767";
    const WEB3FORMS_ACCESS_KEY = "ea427c5e-4ae4-4457-afdf-edd7e9023e80";

    function loadOrder() {
      try {
        const saved = localStorage.getItem(ORDER_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : {};

        // Older saved carts (from before prices existed) won't
        // have a price field - default it to 0 so the panel
        // doesn't crash trying to format an undefined price.
        Object.values(parsed).forEach(item => {
          if (typeof item.price !== "number" || isNaN(item.price)) {
            item.price = 0;
          }
        });

        return parsed;
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

    function orderKey(name, brand, pack) {
      return `${name}||${brand}||${pack}`;
    }

    function totalOrderCount() {
      return Object.values(orderItems).reduce((sum, item) => sum + item.qty, 0);
    }

    function updateOrderBadge() {
      const count = totalOrderCount();

      if (orderFabBtn && orderFabCount) {
        orderFabCount.textContent = count;

        // Keep the floating cart reliably visible whenever there
        // is at least one item, even if another CSS rule affects
        // the button's display state.
        const hasItems = count > 0;
        orderFabBtn.classList.toggle("show", hasItems);
        orderFabBtn.style.display = hasItems ? "flex" : "none";
        orderFabBtn.setAttribute("aria-hidden", hasItems ? "false" : "true");
      }
    }

    function syncSteppersFromOrder() {
      document.querySelectorAll(".qty-stepper").forEach(stepper => {
        const key = orderKey(stepper.dataset.name, stepper.dataset.brand, stepper.dataset.pack);
        const qty = orderItems[key] ? orderItems[key].qty : 0;
        stepper.querySelector(".qty-value").textContent = qty;
      });
    }

    function setQty(name, brand, pack, qty, price) {
      const key = orderKey(name, brand, pack);

      if (qty <= 0) {
        delete orderItems[key];
      } else {
        const existingPrice = orderItems[key] ? orderItems[key].price : undefined;
        orderItems[key] = {
          name,
          brand,
          pack,
          qty,
          price: price !== undefined ? price : (existingPrice || 0)
        };
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
      const brand = stepper.dataset.brand || "";
      const pack = stepper.dataset.pack;
      const price = parseFloat(stepper.dataset.price) || 0;
      const key = orderKey(name, brand, pack);
      let qty = orderItems[key] ? orderItems[key].qty : 0;

      qty = btn.classList.contains("qty-plus") ? qty + 1 : Math.max(0, qty - 1);

      setQty(name, brand, pack, qty, price);
      syncSteppersFromOrder();

      if (orderPanel && !orderPanel.hidden) {
        renderOrderPanel();
      }
    });

    // Restore any previously saved quantities once the table exists.
    syncSteppersFromOrder();
    updateOrderBadge();

    function calculateOrderTotal() {
      return Object.values(orderItems).reduce((sum, item) => sum + ((item.price || 0) * item.qty), 0);
    }

    function buildOrderText(name, phone) {
      const items = Object.values(orderItems);

      const lines = items.map(item => {
        const lineTotal = ((item.price || 0) * item.qty).toFixed(2);
        const itemLabel = `${item.name}${item.brand ? ` — ${item.brand}` : ""}${item.pack ? ` (${item.pack})` : ""}`;
        return `${item.qty} × ${itemLabel}\n      $${(item.price || 0).toFixed(2)} each = $${lineTotal}`;
      });

      const total = calculateOrderTotal().toFixed(2);

      return `NEW ORDER — 18 Steps Pantry & Spices\n\nCustomer: ${name}\nPhone: ${phone}\n\n——— ITEMS ———\n\n${lines.join("\n\n")}\n\n——————————————\nTOTAL: $${total}\n\nAny discounts or combo deals qualified for will be applied to the final invoice.`;
    }

    function getCustomerInfo() {
      const nameInput = document.getElementById("orderCustomerName");
      const phoneInput = document.getElementById("orderCustomerPhone");
      return {
        name: nameInput ? nameInput.value.trim() : "",
        phone: phoneInput ? phoneInput.value.trim() : ""
      };
    }

    function showOrderFieldError(message) {
      const errorEl = document.getElementById("orderFieldError");
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
    }

    // ------------------------------
    // VALIDATION
    // Only letters/spaces/apostrophes/hyphens for names, and only
    // recognised Australian phone formats for phone numbers. This
    // also doubles as protection against malicious input (e.g.
    // script injection attempts) - anything outside these strict
    // character sets is rejected outright, never processed.
    // ------------------------------
    function isValidName(value) {
      return /^[A-Za-z\u00C0-\u024F' -]{2,60}$/.test(value);
    }

    function isValidPhone(value) {
      const cleaned = value.replace(/[\s-]/g, "");
      return /^(\+?61|0)4\d{8}$/.test(cleaned) || /^(\+?61|0)[2378]\d{8}$/.test(cleaned);
    }

    function validateCustomerInfo(name, phone) {
      if (!name) {
        return { valid: false, message: "Please enter your name." };
      }
      if (!isValidName(name)) {
        return { valid: false, message: "Please enter a valid name (letters only)." };
      }
      if (!phone) {
        return { valid: false, message: "Please enter your phone number." };
      }
      if (!isValidPhone(phone)) {
        return { valid: false, message: "Please enter a valid Australian phone number, e.g. 04xx xxx xxx or +61 4xx xxx xxx." };
      }
      return { valid: true, message: "" };
    }

    function renderOrderPanel() {
      // Preserve anything already typed, so it isn't wiped out
      // if the panel re-renders while the customer is mid-typing
      // (e.g. they tap + on another product from the table).
      const existingNameInput = document.getElementById("orderCustomerName");
      const existingPhoneInput = document.getElementById("orderCustomerPhone");
      const preservedName = existingNameInput ? existingNameInput.value : "";
      const preservedPhone = existingPhoneInput ? existingPhoneInput.value : "";

      const items = Object.values(orderItems);

      if (items.length === 0) {
        orderPanelBody.innerHTML = `<p class="order-empty">Your order is empty. Add items using the + buttons in the catalogue.</p>`;
        return;
      }

      const rows = items.map(item => {
        const key = orderKey(item.name, item.brand || "", item.pack);
        const lineTotal = ((item.price || 0) * item.qty).toFixed(2);
        return `
          <div class="order-row" data-key="${escapeHTML(key)}">
            <div class="order-row-info">
              <span class="order-row-name">${escapeHTML(item.name)}</span>
              ${item.brand ? `<span class="order-row-brand">${escapeHTML(item.brand)}</span>` : ""}
              ${item.pack ? `<span class="order-row-pack">${escapeHTML(item.pack)}</span>` : ""}
              <span class="order-row-price">$${(item.price || 0).toFixed(2)} each</span>
            </div>
            <div class="order-row-right">
              <span class="qty-stepper" data-name="${escapeHTML(item.name)}" data-brand="${escapeHTML(item.brand || "")}" data-pack="${escapeHTML(item.pack)}" data-price="${item.price}">
                <button type="button" class="qty-btn qty-minus" aria-label="Decrease quantity">−</button>
                <span class="qty-value">${item.qty}</span>
                <button type="button" class="qty-btn qty-plus" aria-label="Increase quantity">+</button>
              </span>
              <span class="order-row-subtotal">$${lineTotal}</span>
            </div>
          </div>
        `;
      }).join("");

      const total = calculateOrderTotal().toFixed(2);

      orderPanelBody.innerHTML = `
        <div class="order-list">${rows}</div>
        <p class="order-disclaimer">Any discounts or combo deals you qualify for will be applied to your final invoice — the total below doesn't include them yet.</p>
        <div class="order-total-row">
          <span>Total</span>
          <span>$${total}</span>
        </div>
        <div class="order-customer-fields">
          <label class="order-field-label" for="orderCustomerName">Name <span class="order-required">*</span></label>
          <input type="text" id="orderCustomerName" class="order-input" placeholder="Your name" maxlength="60" value="${escapeHTML(preservedName)}">
          <label class="order-field-label" for="orderCustomerPhone">Phone Number <span class="order-required">*</span></label>
          <input type="tel" id="orderCustomerPhone" class="order-input" placeholder="Your phone number" inputmode="tel" maxlength="20" value="${escapeHTML(preservedPhone)}">
          <p class="order-field-error" id="orderFieldError" hidden></p>
        </div>
        <div class="order-actions">
          <button type="button" class="order-btn order-btn-send" id="orderSendNow">
            <i class="ti ti-send" aria-hidden="true"></i> 1. Submit Order
          </button>
          <p class="order-send-hint">We'll receive your order by email right away.</p>
          <p class="order-or">or</p>
          <button type="button" class="order-btn order-btn-whatsapp" id="orderSendWhatsapp">
            <i class="ti ti-brand-whatsapp" aria-hidden="true"></i> 2. WhatsApp
          </button>
          <button type="button" class="order-clear" id="orderClearBtn">Clear order</button>
        </div>
      `;

      const waBtn = document.getElementById("orderSendWhatsapp");
      if (waBtn) {
        waBtn.addEventListener("click", () => {
          const { name, phone } = getCustomerInfo();
          const check = validateCustomerInfo(name, phone);
          if (!check.valid) {
            showOrderFieldError(check.message);
            return;
          }
          const text = buildOrderText(name, phone);
          window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank");
        });
      }

      const sendBtn = document.getElementById("orderSendNow");
      if (sendBtn) {
        sendBtn.addEventListener("click", async (e) => {
          // This stops the submit button from being treated as a
          // click outside the order panel. It does NOT block the
          // +/- buttons, which use the separate document-level handler.
          e.stopPropagation();

          const { name, phone } = getCustomerInfo();
          const check = validateCustomerInfo(name, phone);
          if (!check.valid) {
            showOrderFieldError(check.message);
            return;
          }

          const text = buildOrderText(name, phone);
          const originalLabel = sendBtn.innerHTML;

          sendBtn.disabled = true;
          sendBtn.innerHTML = `<i class="ti ti-loader-2 order-spin" aria-hidden="true"></i> Sending...`;

          try {
            const response = await fetch("https://api.web3forms.com/submit", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
              },
              body: JSON.stringify({
                access_key: WEB3FORMS_ACCESS_KEY,
                subject: "New order - 18 Steps Pantry & Spices website",
                name: name,
                phone: phone,
                message: text
              })
            });

            let result = {};
            try {
              result = await response.json();
            } catch {
              result = {};
            }

            console.log("Web3Forms response:", response.status, result);

            if (response.ok && result.success) {
              orderItems = {};
              saveOrder(orderItems);
              updateOrderBadge();
              syncSteppersFromOrder();

              orderPanelBody.innerHTML = `
                <p class="order-success">
                  <i class="ti ti-circle-check" aria-hidden="true"></i>
                  Order sent!<br>
                  <span>Thank you — we've received your order and will be in touch shortly.</span>
                </p>
              `;
            } else {
              throw new Error(
                result.message || `Web3Forms returned HTTP ${response.status}.`
              );
            }
          } catch (err) {
            console.error("Order submission error:", err);
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalLabel;
            showOrderFieldError(
              `Order could not be sent. ${err.message || "Please try again."}`
            );
          }
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
    // Searches product name, brand and pack size.
    // Categories with no matching products are hidden automatically.
    // ------------------------------
    if (searchBox) {
      searchBox.addEventListener("input", function () {
        const searchTerm = this.value.trim().toLowerCase();

        document.querySelectorAll(".product-category").forEach(section => {
          let visibleCount = 0;

          section.querySelectorAll(".product-card").forEach(card => {
            const haystack = [
              card.dataset.product || "",
              card.dataset.brand || "",
              card.dataset.pack || ""
            ].join(" ");

            const matches = searchTerm === "" || haystack.includes(searchTerm);
            card.hidden = !matches;

            if (matches) visibleCount++;
          });

          section.hidden = visibleCount === 0;

          const countEl = section.querySelector("[data-category-count]");
          if (countEl) {
            countEl.textContent = searchTerm
              ? `${visibleCount} ${visibleCount === 1 ? "product" : "products"}`
              : `${section.querySelectorAll(".product-card").length} ${section.querySelectorAll(".product-card").length === 1 ? "product" : "products"}`;
          }
        });
      });
    }
  })

  .catch(error => {
    console.error("Catalogue error:", error);

    const catalogueGrid = document.querySelector("#catalogueGrid");
    if (catalogueGrid) {
      catalogueGrid.innerHTML = `
        <div class="catalogue-error">
          Unable to load the catalogue.
        </div>
      `;
    }
  });

// Keep the floating Categories button attached directly to <body> so
// its fixed position is always relative to the viewport, never the
// catalogue layout. This prevents it from drifting/disappearing when
// the page is scrolled or when content changes.
(function keepMobileCategoryButtonInViewport(){
  const btn = document.getElementById("mobileCategoryBtn");
  if (btn && btn.parentElement !== document.body) {
    document.body.appendChild(btn);
  }

  // Start every page at the left edge. This also clears any horizontal
  // position left behind by an earlier version of the catalogue.
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
})();
