fetch("products.csv")
  .then(response => response.text())
  .then(text => {

    const tbody = document.querySelector("#catalogue tbody");
    const searchBox = document.getElementById("search");

    // ---------- CSV PARSER ----------
    function parseCSV(csv) {
      const rows = [];
      let row = [];
      let field = "";
      let inQuotes = false;

      for (let i = 0; i < csv.length; i++) {
        const c = csv[i];

        if (c === '"') {
          if (inQuotes && csv[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === "," && !inQuotes) {
          row.push(field.trim());
          field = "";
        } else if ((c === "\n" || c === "\r") && !inQuotes) {

          if (c === "\r" && csv[i + 1] === "\n") i++;

          row.push(field.trim());
          field = "";

          if (row.some(col => col !== "")) {
            rows.push(row);
          }

          row = [];
        } else {
          field += c;
        }
      }

      if (field.length || row.length) {
        row.push(field.trim());
        if (row.some(col => col !== "")) {
          rows.push(row);
        }
      }

      return rows;
    }

    const rows = parseCSV(text);

    let html = "";
    let currentCategory = "";

    rows.forEach(cols => {

      const product = (cols[0] || "").trim();
      const size = (cols[1] || "").trim();
      let price = (cols[2] || "").trim();
      const stock = (cols[3] || "").trim();

      // Ignore title row
      if (
        product.toUpperCase().includes("18 STEPS") ||
        product.toLowerCase() === "product name"
      ) {
        return;
      }

      // Category row
      if (
        product &&
        !size &&
        !price &&
        !stock
      ) {

        currentCategory = product;

        html += `
<tr class="category">
    <td colspan="4">${currentCategory}</td>
</tr>
`;

        return;
      }

      // Ignore footer / junk rows
      if (!product) return;

      // Prevent double $
      if (price.startsWith("$$")) {
        while (price.startsWith("$$")) {
          price = price.substring(1);
        }
      }

      html += `
<tr class="product-row">
    <td class="product-name">${product}</td>
    <td>${size}</td>
    <td>${price}</td>
    <td>${stock}</td>
</tr>
`;

    });

    tbody.innerHTML = html;

    // ---------- SEARCH ----------
    searchBox.addEventListener("input", function () {

      const filter = this.value.trim().toLowerCase();

      const allRows = [...tbody.querySelectorAll("tr")];

      let currentCategory = null;
      let categoryHasVisibleProducts = false;

      allRows.forEach(row => {

        if (row.classList.contains("category")) {

          if (currentCategory) {
            currentCategory.style.display =
              categoryHasVisibleProducts ? "" : "none";
          }

          currentCategory = row;
          categoryHasVisibleProducts = false;
          row.style.display = "";

          return;
        }

        const product =
          row.querySelector(".product-name")
             .textContent
             .toLowerCase();

        const visible =
          filter === "" || product.includes(filter);

        row.style.display = visible ? "" : "none";

        if (visible) {
          categoryHasVisibleProducts = true;
        }

      });

      if (currentCategory) {
        currentCategory.style.display =
          categoryHasVisibleProducts ? "" : "none";
      }

    });

  })
  .catch(err => {
    console.error(err);

    document.querySelector("#catalogue tbody").innerHTML =
      `<tr><td colspan="4">Unable to load catalogue.</td></tr>`;
  });
