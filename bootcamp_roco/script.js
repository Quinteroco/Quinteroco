document.addEventListener("DOMContentLoaded", () => {

  // --- HELPERS ---
  function scrollToElement(el, offset = 40) {
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  // --- Smooth scroll para enlaces tipo #anchor ---
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", function(e) {
      const href = this.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        scrollToElement(target, 40);
      }
    });
  });

  // --- Widget: scroll al formulario ---
  const widget = document.querySelector(".inscribe-widget");
  if (widget) {
    widget.addEventListener("click", () => {
      const formContainer = document.getElementById("form");
      scrollToElement(formContainer, 40);
    });
  }

  // --- FAQ toggle ---
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => q.parentElement.classList.toggle('active'));
  });

  // --- Popup (redes) ---
  const popup = document.getElementById("social-popup");
  function openPopup() { if (popup) popup.classList.add("active"); }
  function closePopup() { if (popup) popup.classList.remove("active"); }

  // cerrar popup al clic en botón(s)
  document.querySelectorAll('#social-popup button').forEach(btn => {
    btn.addEventListener('click', closePopup);
  });
  // cerrar popup si clic fuera del contenido
  if (popup) {
    popup.addEventListener('click', (e) => { if (e.target === popup) closePopup(); });
  }

  // --- Form submit: enviar a Google Sheets y abrir popup ---
  const form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // validación nativa
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = {
        name: form.name.value,
        whatsapp: form.whatsapp.value,
        email: form.email.value,
        age: form.age.value
      };

      try {
        await fetch("https://script.google.com/macros/s/AKfycbzke1VPPxlvrTpYf1XO-dwmjgkTGdkbvbQwGJUztRBLOmngRGvq6X-BV6mstJkY3jCu/exec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

      } catch (err) {
        console.error("Error enviando a Sheets:", err);
      }

      openPopup();
      form.reset();
    });
  }

}); // end DOMContentLoaded
