// -------------------------------------------------------------------------
// Selfies of the World -- Client-side search + lazy fade-in
// -------------------------------------------------------------------------

(function () {
  const search = document.getElementById("search");
  const countEl = document.getElementById("count");
  const figures = document.querySelectorAll(".grid figure");
  const total = figures.length;

  // -- Search / filter ----------------------------------------------------

  let debounceTimer;

  search.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(filter, 150);
  });

  function filter() {
    const term = search.value.toLowerCase().trim();
    let visible = 0;

    for (const fig of figures) {
      const country = fig.dataset.country || "";
      const subject = fig.dataset.subject || "";
      const caption = fig.querySelector("figcaption")?.textContent?.toLowerCase() || "";

      const match =
        !term ||
        country.includes(term) ||
        subject.includes(term) ||
        caption.includes(term);

      fig.hidden = !match;
      if (match) visible++;
    }

    countEl.textContent = visible === total ? total : visible + " of " + total;
  }

  // -- Lazy fade-in with IntersectionObserver ------------------------------

  const images = document.querySelectorAll(".card-img");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "100px", threshold: 0.01 }
    );

    for (const img of images) {
      observer.observe(img);
    }
  } else {
    // Fallback: show all immediately
    for (const img of images) {
      img.classList.add("visible");
    }
  }
})();
