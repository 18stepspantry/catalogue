fetch("products.csv")
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
      // ------------------------------
      html += `
        <tr class="product-row">
          <td class="product-name"><span class="product-name-text">${escapeHTML(product)}</span>${offer ? `<span class="offer-badge" title="${escapeHTML(offer)}">${escapeHTML(offer)}</span>` : ""}</td>
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
